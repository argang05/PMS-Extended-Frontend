export class DescriptiveAPIError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = "DescriptiveAPIError";
      this.status = status;
      this.data = data;
    }
  }
  
  export function getDescriptiveError(data, fallback = "Descriptive scoring request failed.") {
    if (typeof data === "string") return data;
    if (!data || typeof data !== "object") return fallback;
    for (const key of ["message", "detail", "error", "non_field_errors"]) {
      if (typeof data[key] === "string") return data[key];
      if (Array.isArray(data[key])) return data[key].map(String).join(", ");
    }
    const entry = Object.entries(data).find(([key, value]) => value && !["results", "responses", "dependent_results", "current_revision", "code"].includes(key));
    return entry ? `${entry[0]}: ${Array.isArray(entry[1]) ? entry[1].join(", ") : JSON.stringify(entry[1])}` : fallback;
  }
  
  export function requiresInvalidationConfirmation(error) {
    return error?.status === 409 && (
      error.data?.code === "invalidation_confirmation_required" ||
      Boolean(error.data?.dependent_results)
    );
  }
  
  export function isDescriptiveConflict(error) {
    return error?.status === 409 && !requiresInvalidationConfirmation(error);
  }
  
  function normalizeList(data) {
    if (Array.isArray(data)) return data;
    for (const key of ["results", "questionnaires", "assessments", "items"]) {
      if (Array.isArray(data?.[key])) return data[key];
    }
    throw new Error("Invalid questionnaire list received from server.");
  }
  
  function buildQuery(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") params.set(key, String(value).trim());
    });
    return params.size ? `?${params}` : "";
  }
  
  export function createDescriptiveAPI(accessToken) {
    async function request(path, method = "GET", payload, signal) {
      if (!accessToken) throw new Error("Authentication is required.");
      const headers = { Authorization: `Bearer ${accessToken}` };
      const options = { method, headers, cache: "no-store", signal };
      if (payload !== undefined) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
      }
      const response = await fetch(path, options);
      const raw = await response.text();
      let data;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { data = { error: raw || "Invalid server response." }; }
      if (!response.ok) throw new DescriptiveAPIError(getDescriptiveError(data, `Request failed (${response.status}).`), response.status, data);
      return data;
    }
    const potentialBase = "/api/scoring/potential";
    return {
      performance: {
        getQuestionnaires: async (filters = {}, signal) => normalizeList(await request(`/api/admin/questionnaires${buildQuery(filters)}`, "GET", undefined, signal)),
        getPreference: (id, signal) => request(`/api/scoring/descriptive-preference/${id}`, "GET", undefined, signal),
        getWorkspace: (id, signal) => request(`/api/evaluations/admin/descriptive-responses/${id}`, "GET", undefined, signal),
        saveScores: (id, scores) => request("/api/evaluations/admin/descriptive-score/bulk-save", "POST", { scores })
      },
      potential: {
        getQuestionnaires: async (filters = {}, signal) => normalizeList(await request(`${potentialBase}/questionnaires${buildQuery(filters)}`, "GET", undefined, signal)),
        getPreference: (id, signal) => request(`${potentialBase}/descriptive/${id}/preference`, "GET", undefined, signal),
        getWorkspace: (id, signal) => request(`${potentialBase}/descriptive/${id}/workspace`, "GET", undefined, signal),
        getReadiness: (id, signal) => request(`${potentialBase}/descriptive/${id}/readiness`, "GET", undefined, signal),
        saveScores: (id, scores, revision, confirmInvalidation = false) => request(`${potentialBase}/descriptive/${id}/bulk-save`, "POST", {
          scores, revision, confirm_invalidation: confirmInvalidation
        }),
        clearScores: (id, itemIds, revision, confirmInvalidation = false) => request(`${potentialBase}/descriptive/${id}/clear-scores`, "POST", {
          questionnaire_item_ids: itemIds, revision, confirm_invalidation: confirmInvalidation
        }),
        getHistory: (id, signal) => request(`${potentialBase}/descriptive/${id}/history`, "GET", undefined, signal)
      }
    };
  }