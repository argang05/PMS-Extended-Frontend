export const SCORING_ENGINES = ["performance", "potential", "ppi", "ninebox", "appraisal"];

export const SCORING_ENGINE_LABELS = {
  performance: "Performance Score",
  potential: "Potential Score",
  ppi: "Past Performance Index",
  ninebox: "Nine-Box Placement",
  appraisal: "Appraisal Recommendation"
};

export const READINESS_STATUS = {
  LOADING: "loading",
  UNAVAILABLE: "unavailable",
  BLOCKED: "blocked",
  READY: "ready",
  OUTDATED: "outdated",
  CURRENT: "current"
};

export class ScoringReadinessError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ScoringReadinessError";
    this.status = status;
    this.data = data;
  }
}

export function formatReadinessRequirement(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatReadinessRequirement).filter(Boolean).join("; ");
  if (typeof value === "object") {
    const reason = value.reason ?? value.message ?? value.detail ?? value.error;
    const question = value.question_text ?? value.question;
    const evaluator = value.evaluator_type ?? value.evaluator;
    const category = value.category_name ?? value.category;
    const context = [question, evaluator, category].map(formatReadinessRequirement).filter(Boolean);
    if (reason !== undefined) {
      return [...context, formatReadinessRequirement(reason)].filter(Boolean).join(" — ");
    }
    return Object.entries(value).map(([key, item]) => {
      const formatted = formatReadinessRequirement(item);
      return formatted ? `${key.replaceAll("_", " ")}: ${formatted}` : "";
    }).filter(Boolean).join("; ");
  }
  return String(value);
}

export function normalizeRequirements(requirements) {
  const values = Array.isArray(requirements) ? requirements : requirements == null ? [] : [requirements];
  return [...new Set(values.map(formatReadinessRequirement).filter(Boolean))];
}

export function getReadinessError(error, fallback = "Unable to load scoring readiness.") {
  const data = error?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const message = data.error ?? data.detail ?? data.message ?? data.non_field_errors;
    if (message) return formatReadinessRequirement(message) || fallback;
    if (data.missing_requirements) {
      const requirements = normalizeRequirements(data.missing_requirements);
      if (requirements.length) return requirements.join("; ");
    }
  }
  return error?.message || fallback;
}

function validateQuestionnaireId(questionnaireId) {
  const id = String(questionnaireId ?? "");
  if (!/^[1-9]\d*$/.test(id)) {
    throw new ScoringReadinessError("A valid questionnaire ID is required.", 400);
  }
  return id;
}

function validateEngineState(state, engine) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new ScoringReadinessError(`Missing readiness information for ${SCORING_ENGINE_LABELS[engine]}.`, 502);
  }
  for (const field of ["exists", "can_calculate", "is_current"]) {
    if (typeof state[field] !== "boolean") {
      throw new ScoringReadinessError(`Invalid ${field} value for ${SCORING_ENGINE_LABELS[engine]}.`, 502);
    }
  }
  if (state.is_current && (!state.exists || !state.can_calculate)) {
    throw new ScoringReadinessError(`Inconsistent readiness information for ${SCORING_ENGINE_LABELS[engine]}.`, 502);
  }
  return state;
}

export function normalizeEngineReadiness(state, engine) {
  validateEngineState(state, engine);
  const calculationBlockers = normalizeRequirements(state.calculation_blockers);
  const freshnessBlockers = normalizeRequirements(state.freshness_blockers);
  const missingRequirements = normalizeRequirements([
    ...normalizeRequirements(state.missing_requirements),
    ...calculationBlockers,
    ...freshnessBlockers
  ]);
  return {
    ...state,
    exists: state.exists,
    can_calculate: state.can_calculate,
    is_current: state.is_current,
    is_ready: state.is_current,
    calculation_blockers: calculationBlockers,
    freshness_blockers: freshnessBlockers,
    missing_requirements: missingRequirements
  };
}

export function normalizeScoringReadiness(data, questionnaireId) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ScoringReadinessError("Invalid scoring readiness response.", 502, data);
  }
  const expectedId = validateQuestionnaireId(questionnaireId);
  if (String(data.questionnaire_id) !== expectedId) {
    throw new ScoringReadinessError("Readiness response belongs to another questionnaire.", 502, data);
  }
  const engines = Object.fromEntries(SCORING_ENGINES.map(engine => [
    engine, normalizeEngineReadiness(data[engine], engine)
  ]));
  const release = data.analytics_release;
  if (!release || typeof release.can_release !== "boolean" || typeof release.is_released_to_employee !== "boolean" || typeof release.can_unrelease !== "boolean") {
    throw new ScoringReadinessError("Invalid analytics release readiness response.", 502, data);
  }
  const preference = data.performance_preference;
  if (!preference || typeof preference.descriptive_scoring_enabled !== "boolean") {
    throw new ScoringReadinessError("Invalid Performance descriptive scoring preference.", 502, data);
  }
  return {
    ...data,
    ...engines,
    missing_requirements: normalizeRequirements(data.missing_requirements),
    all_missing_requirements: normalizeRequirements(data.all_missing_requirements),
    analytics_release: {
      ...release,
      missing_requirements: normalizeRequirements(release.missing_requirements)
    },
    performance_preference: preference
  };
}

export async function fetchScoringReadiness(accessToken, questionnaireId, signal) {
  const id = validateQuestionnaireId(questionnaireId);
  if (!accessToken) {
    throw new ScoringReadinessError("Authentication is required.", 401);
  }
  const authorization = accessToken.startsWith("Bearer ") ? accessToken : `Bearer ${accessToken}`;
  const response = await fetch(`/api/scoring/readiness/${id}`, {
    method: "GET",
    headers: { Authorization: authorization, Accept: "application/json" },
    cache: "no-store",
    signal
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      if (response.ok) throw new ScoringReadinessError("The server returned an invalid readiness response.", 502);
      data = raw;
    }
  }
  if (!response.ok) {
    const error = new ScoringReadinessError(`Readiness request failed (${response.status}).`, response.status, data);
    error.message = getReadinessError(error);
    throw error;
  }
  return normalizeScoringReadiness(data, id);
}

export function getEngineReadinessStatus(state, loading = false) {
  if (loading) return READINESS_STATUS.LOADING;
  if (!state) return READINESS_STATUS.UNAVAILABLE;
  if (state.is_current) return READINESS_STATUS.CURRENT;
  if (!state.can_calculate) return READINESS_STATUS.BLOCKED;
  if (state.exists) return READINESS_STATUS.OUTDATED;
  return READINESS_STATUS.READY;
}

export function getEngineReadinessLabel(status) {
  return {
    loading: "Checking readiness",
    unavailable: "Readiness unavailable",
    blocked: "Prerequisites incomplete",
    ready: "Ready to calculate",
    outdated: "Recalculation required",
    current: "Up to date"
  }[status] ?? "Unknown";
}

export function getEngineReadinessSummary(state, loading = false) {
  const status = getEngineReadinessStatus(state, loading);
  return {
    status,
    label: getEngineReadinessLabel(status),
    exists: state?.exists === true,
    canCalculate: !loading && state?.can_calculate === true,
    isCurrent: !loading && state?.is_current === true,
    calculationBlockers: normalizeRequirements(state?.calculation_blockers),
    freshnessBlockers: normalizeRequirements(state?.freshness_blockers),
    missingRequirements: normalizeRequirements(state?.missing_requirements)
  };
}

export function getAnalyticsReleaseSummary(readiness, loading = false) {
  const release = readiness?.analytics_release;
  return {
    available: Boolean(release) && !loading,
    isReleased: release?.is_released_to_employee === true,
    isCurrent: !loading && release?.release_is_current === true,
    canRelease: !loading && release?.can_release === true,
    canUnrelease: !loading && release?.can_unrelease === true,
    missingRequirements: normalizeRequirements(release?.missing_requirements)
  };
}

export function getScoringProgress(readiness) {
  const engines = SCORING_ENGINES.map(engine => readiness?.[engine]);
  const total = engines.length;
  const calculated = engines.filter(state => state?.exists === true).length;
  const current = engines.filter(state => state?.is_current === true).length;
  const calculable = engines.filter(state => state?.can_calculate === true).length;
  const blocked = engines.filter(state => state?.can_calculate === false).length;
  const outdated = engines.filter(state => state?.exists === true && state?.is_current === false).length;
  return {
    total, calculated, current, calculable, blocked, outdated,
    percentage: Math.round((current / total) * 100)
  };
}