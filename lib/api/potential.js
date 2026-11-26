const BASE = "/api/scoring/potential";

export class PotentialAPIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "PotentialAPIError";
    this.status = status;
    this.data = data;
  }
}

function extractError(data, fallback) {
  if (data === null || data === undefined) return fallback;
  if (typeof data === "string") return data || fallback;
  if (typeof data !== "object") return String(data);
  if (Array.isArray(data)) return data.map(item => extractError(item, fallback)).join("; ") || fallback;
  for (const key of ["message", "error", "detail", "non_field_errors"]) {
    if (data[key]) return extractError(data[key], fallback);
  }
  const entries = Object.entries(data).filter(([key]) =>
    !["code", "current_revision", "dependent_results", "missing_requirements"].includes(key)
  );
  return entries.length
    ? entries.map(([key, value]) => `${key.replaceAll("_", " ")}: ${extractError(value, fallback)}`).join("; ")
    : fallback;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) value.forEach(item => query.append(key, String(item)));
    else query.set(key, String(value));
  });
  return query.size ? `?${query.toString()}` : "";
}

export function createPotentialAPI(accessToken) {
  async function request(path, { method = "GET", body, params, signal } = {}) {
    if (!accessToken) throw new PotentialAPIError("Authentication required.", 401, null);
    const authorization = /^Bearer\s/i.test(accessToken) ? accessToken : `Bearer ${accessToken}`;
    const headers = { Authorization: authorization, Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${BASE}/${path}${buildQuery(params)}`, {
      method, headers, cache: "no-store", credentials: "same-origin", signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = text; }
    }
    if (!response.ok) {
      throw new PotentialAPIError(
        extractError(data, `Request failed (${response.status}).`),
        response.status, data
      );
    }
    return data;
  }
  const get = (path, params, signal) => request(path, { params, signal });
  const post = (path, body) => request(path, { method: "POST", body });
  const put = (path, body) => request(path, { method: "PUT", body });
  const patch = (path, body) => request(path, { method: "PATCH", body });
  const remove = path => request(path, { method: "DELETE" });
  return {
    questionBank: {
      getCategories: signal => get("question-bank/categories", {}, signal),
      createCategory: body => post("question-bank/categories", body),
      updateCategory: (id, body) => patch(`question-bank/categories/${id}`, body),
      deleteCategory: id => remove(`question-bank/categories/${id}`),
      getQuestions: (params, signal) => get("question-bank/questions", params, signal),
      getQuestion: (id, signal) => get(`question-bank/questions/${id}`, {}, signal),
      createQuestion: body => post("question-bank/questions", body),
      updateQuestion: (id, body) => patch(`question-bank/questions/${id}`, body),
      deleteQuestion: id => remove(`question-bank/questions/${id}`),
      bulkCreate: body => post("question-bank/questions/bulk-create", body),
      bulkConfigure: body => post("question-bank/questions/bulk-configure", body),
      bulkDelete: body => post("question-bank/questions/bulk-delete", body),
      getTargetingOptions: signal => get("question-bank/targeting/options", {}, signal),
      previewTargeting: body => post("question-bank/targeting/preview", body),
      getQuestionTargeting: (id, signal) => get(`question-bank/questions/${id}/targeting-preview`, {}, signal),
      getStats: signal => get("question-bank/stats", {}, signal)
    },
    questionnaires: {
      getOptions: signal => get("questionnaires/options", {}, signal),
      getQuestionnaires: (params, signal) => get("questionnaires", params, signal),
      getQuestionnaire: (id, signal) => get(`questionnaires/${id}`, {}, signal),
      createQuestionnaire: body => post("questionnaires", body),
      getAvailableQuestions: (id, params, signal) => get(`questionnaires/${id}/available-questions`, params, signal),
      saveDraft: (id, body) => put(`questionnaires/${id}/save`, body),
      synchronize: (id, body) => post(`questionnaires/${id}/sync`, body),
      reset: (id, body) => post(`questionnaires/${id}/reset`, body),
      copy: (id, body) => post(`questionnaires/${id}/copy`, body),
      publish: (id, body) => post(`questionnaires/${id}/publish`, {
        ...body,
        confirm_reset: body?.confirm_reset === true
      })
    },
    evaluations: {
      getAssessments: (params, signal) => get("evaluations", params, signal),
      getAssessment: (id, signal) => get(`evaluations/${id}`, {}, signal),
      prepareAssessment: id => post(`evaluations/${id}/prepare`),
      submitAssessment: (id, body) => post(`evaluations/${id}/submit`, body),
      saveDraft: (id, evaluator, body) => {
        if (!["rm", "skip"].includes(evaluator)) throw new Error("Invalid Potential evaluator.");
        return post(`${evaluator}/save`, { ...body, assessment_id: id });
      }
    },
    descriptive: {
      getPreference: (id, signal) => get(`descriptive/${id}/preference`, {}, signal),
      setPreference: (id, enabled, confirmInvalidation = false) =>
        put(`descriptive/${id}/preference`, {
          is_enabled: enabled,
          confirm_invalidation: confirmInvalidation
        }),
      getWorkspace: (id, signal) => get(`descriptive/${id}/workspace`, {}, signal),
      getReadiness: (id, signal) => get(`descriptive/${id}/readiness`, {}, signal),
      saveScore: (id, body) => post(`descriptive/${id}/score`, body),
      saveScores: (id, body) => post(`descriptive/${id}/bulk-save`, body),
      clearScores: (id, body) => post(`descriptive/${id}/clear-scores`, body),
      getHistory: (id, signal) => get(`descriptive/${id}/history`, {}, signal)
    },
    scoring: {
      calculate: id => post(`calculate/${id}`),
      getResult: (id, signal) => get(`result/${id}`, {}, signal)
    }
  };
}

export function isPotentialConflict(error) {
  return error?.status === 409;
}

export function requiresPotentialResetConfirmation(error) {
  return isPotentialConflict(error) && error.data?.code === "potential_reset_required";
}

export function requiresPotentialInvalidationConfirmation(error) {
  return isPotentialConflict(error) && !requiresPotentialResetConfirmation(error) && (
    error.data?.code === "invalidation_confirmation_required" ||
    Boolean(error.data?.dependent_results)
  );
}

export function isPotentialRevisionConflict(error) {
  return isPotentialConflict(error) &&
    !requiresPotentialResetConfirmation(error) &&
    !requiresPotentialInvalidationConfirmation(error);
}