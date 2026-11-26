import { formatReadinessRequirement, normalizeRequirements } from "@/lib/scoring/readinessAPI";

export const RESULT_ENGINE_MAP = {
  score: "performance",
  ppi: "ppi",
  potential: "potential",
  ninebox: "ninebox",
  appraisal: "appraisal"
};

export const ENGINE_RESULT_MAP = {
  performance: "score",
  potential: "potential",
  ppi: "ppi",
  ninebox: "ninebox",
  appraisal: "appraisal"
};

export const RESULT_KEYS = ["score", "ppi", "potential", "ninebox", "appraisal"];

const RESULT_REQUIRED_FIELDS = {
  score: ["system_final_score", "final_effective_score"],
  ppi: ["ppi_score"],
  potential: ["final_potential_score"],
  ninebox: ["box_label", "ppi_score", "potential_score"],
  appraisal: ["suggested_appraisal_percent", "final_effective_appraisal_percent"]
};

export class ScoringAPIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ScoringAPIError";
    this.status = status;
    this.data = data;
  }
}

export function getScoringError(data, fallback = "Something went wrong.") {
  if (typeof data === "string" && data.trim()) return data;
  for (const key of ["message", "error", "detail", "non_field_errors"]) {
    const value = data?.[key];
    if (value !== undefined && value !== null) {
      const message = formatReadinessRequirement(value);
      if (message) return message;
    }
  }
  const requirements = normalizeRequirements(data?.missing_requirements);
  if (requirements.length) return requirements.join("; ");
  if (data && typeof data === "object") {
    const entry = Object.entries(data).find(([key]) => !["code", "dependent_results", "current_revision"].includes(key));
    if (entry) return `${entry[0]}: ${formatReadinessRequirement(entry[1])}`;
  }
  return fallback;
}

export function createScoringAPI(accessToken) {
  return async function api(path, method = "GET", payload, signal) {
    if (!accessToken) throw new ScoringAPIError("Authentication is required.", 401, null);
    const authorization = accessToken.startsWith("Bearer ") ? accessToken : `Bearer ${accessToken}`;
    const headers = { Authorization: authorization, Accept: "application/json" };
    const options = { method, headers, cache: "no-store", signal };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(path, options);
    const raw = await response.text();
    let data = {};
    if (raw) {
      try { data = JSON.parse(raw); }
      catch {
        if (!response.ok) throw new ScoringAPIError(raw, response.status, raw);
        throw new ScoringAPIError("Invalid response received from server.", 502, raw);
      }
    }
    if (!response.ok) throw new ScoringAPIError(getScoringError(data, `Request failed (${response.status}).`), response.status, data);
    return data;
  };
}

export function getPreferencePath(type, id) {
  return type === "performance" ? `/api/scoring/descriptive-preference/${id}` : `/api/scoring/potential/descriptive/${id}/preference`;
}

export function getPreferencePayload(type, enabled, confirmed = false) {
  return {
    [type === "performance" ? "descriptive_scoring_enabled" : "is_enabled"]: enabled,
    confirm_invalidation: confirmed
  };
}

export function normalizeScoringPreference(type, data) {
  const preference = data?.preference ?? data;
  const enabled = type === "performance" ? preference?.descriptive_scoring_enabled : preference?.is_enabled;
  if (typeof enabled !== "boolean") throw new Error(`Invalid ${type} descriptive scoring preference received.`);
  return {
    ...preference, type, enabled,
    hasDescriptiveQuestions: preference.has_descriptive_questions === true,
    hasDependentResults: preference.has_dependent_results === true || Object.values(preference.dependent_results || {}).some(Boolean),
    dependentResults: preference.dependent_results || {},
    readiness: preference.readiness || null,
    objectiveWeight: preference.effective_objective_component_weight ?? null,
    descriptiveWeight: preference.effective_descriptive_component_weight ?? null
  };
}

export function requiresInvalidationConfirmation(error) {
  if (error?.status !== 409) return false;
  return [
    "invalidation_confirmation_required",
    "potential_invalidation_confirmation_required"
  ].includes(String(error.data?.code || ""));
}

export function getDescriptiveWorkspaceLink(type, id) {
  return type === "performance"
    ? `/admin-console/descriptive-scoring?type=performance&questionnaire_id=${encodeURIComponent(id)}`
    : `/admin-console/descriptive-scoring?type=potential&assessment_id=${encodeURIComponent(id)}`;
}

export function formatScoringWeight(weight) {
  if (weight === null || weight === undefined || weight === "" || !Number.isFinite(Number(weight))) return "—";
  return `${Number((Number(weight) * 100).toFixed(2))}%`;
}

export function formatDependencyName(key) {
  const labels = {
    performance_score: "Performance Score",
    potential_score: "Potential Score",
    ppi: "Past Performance Index",
    ninebox: "9-Box Placement",
    appraisal: "Appraisal Recommendation",
    analytics_release: "Analytics Release",
    cached_potential: "Cached Potential Score",
    cached_ninebox: "Cached 9-Box Placement"
  };
  return labels[key] || String(key).replaceAll("_", " ").replace(/\b\w/g, value => value.toUpperCase());
}

export function getAffectedResultKeys(type) {
  return type === "performance" ? ["score", "ppi", "ninebox", "appraisal"] : ["potential", "ninebox", "appraisal"];
}

export function getPreferenceReadiness(state) {
  return Boolean(state?.data && typeof state.data.enabled === "boolean" && !state.loading && !state.saving && !state.error);
}

export function getPotentialCalculationReadiness(state) {
  return getPreferenceReadiness(state) && state.data.readiness?.ready_for_calculation === true;
}

export function getPotentialReadinessLabel(readiness) {
  const labels = {
    evaluation_pending: "Manager Evaluations Pending",
    legacy_reconciliation_required: "Legacy Reconciliation Required",
    objective_only: "Ready — Objective Only",
    responses_incomplete: "Responses Incomplete",
    no_descriptive_questions: "No Descriptive Questions",
    descriptive_scoring_pending: "Descriptive Marks Pending",
    ready: "Ready for Calculation"
  };
  return labels[readiness?.readiness_status] || "Readiness Unavailable";
}

export function isCurrentResult(key, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.is_current === false || data.readiness?.is_current === false || data.readiness?.is_ready === false) return false;
  const fields = RESULT_REQUIRED_FIELDS[key];
  if (!fields) return false;
  return fields.every(field => {
    const value = data[field];
    if (field === "box_label") return typeof value === "string" && Boolean(value.trim());
    return value !== null && value !== undefined && value !== "" && typeof value !== "boolean" && Number.isFinite(Number(value));
  });
}

export function resultPath(key, id, assessmentId) {
  return {
    score: `/api/scoring/result/${id}`,
    ppi: `/api/scoring/ppi/result/${id}`,
    potential: `/api/scoring/potential/result/${assessmentId}`,
    ninebox: `/api/scoring/ninebox/result/${id}`,
    appraisal: `/api/scoring/appraisal/result/${id}`
  }[key];
}

export function calculationPath(key, id, assessmentId) {
  return {
    score: `/api/scoring/calculate/${id}`,
    ppi: `/api/scoring/ppi/calculate/${id}`,
    potential: `/api/scoring/potential/calculate/${assessmentId}`,
    ninebox: `/api/scoring/ninebox/generate/${id}`,
    appraisal: `/api/scoring/appraisal/generate/${id}`
  }[key];
}

export function getEngineBlockers(engine) {
  if (!engine) return ["Readiness has not been verified."];
  if (engine.canCalculate) return engine.isCurrent ? [] : normalizeRequirements(engine.freshnessBlockers);
  return normalizeRequirements(engine.calculationBlockers?.length ? engine.calculationBlockers : engine.missingRequirements);
}

export function formatMissingRequirement(requirement) {
  return formatReadinessRequirement(requirement);
}

export function emptyResults() {
  return Object.fromEntries(RESULT_KEYS.map(key => [key, null]));
}

export function emptyVisibility() {
  return Object.fromEntries(RESULT_KEYS.map(key => [key, false]));
}