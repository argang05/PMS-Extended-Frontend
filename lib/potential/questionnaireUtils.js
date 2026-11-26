export function getParameterId(item) {
  return Number(item.parameter_id ?? item.parameter?.id ?? item.parameter ?? item.id);
}

export function normalizeQuestionnaire(data) {
  const questionnaire = data?.questionnaire ?? data?.assessment ?? data;
  if (!questionnaire?.id) throw new Error("Invalid Potential questionnaire response.");
  return questionnaire;
}

export function normalizeQuestionnaireItems(items = []) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((item, index) => ({
    ...item,
    parameter_id: getParameterId(item),
    question_text: item.question_text_snapshot || item.question_text || item.parameter?.question_text || "",
    question_type: item.question_type_snapshot || item.question_type || item.parameter?.question_type || "objective",
    category_name: item.category_name_snapshot || item.category_name || item.parameter?.category_name || "Uncategorized",
    max_marks: item.max_marks_snapshot ?? item.max_marks ?? item.parameter?.max_marks ?? 10,
    weightage: item.weightage ?? item.default_weightage ?? 1,
    source: item.source || "manual",
    order: index + 1
  }));
}

export function normalizeAvailableQuestions(data) {
  const questions = Array.isArray(data) ? data : data?.results ?? data?.questions ?? [];
  const automaticIds = new Set((data?.automatic_parameter_ids || []).map(Number));
  const assignedIds = new Set((data?.assigned_parameter_ids || []).map(Number));
  const excludedIds = new Set((data?.excluded_parameter_ids || []).map(Number));
  return questions.map(question => {
    const parameterId = getParameterId(question);
    return {
      ...question,
      parameter_id: parameterId,
      question_text: question.question_text || "",
      question_type: question.question_type || "objective",
      category_name: question.category_name || question.category?.name || "Uncategorized",
      max_marks: question.max_marks ?? 10,
      default_weightage: question.default_weightage ?? question.weightage ?? 1,
      is_automatic: Array.isArray(data?.automatic_parameter_ids) ? automaticIds.has(parameterId) : Boolean(question.is_automatic),
      is_assigned: Array.isArray(data?.assigned_parameter_ids) ? assignedIds.has(parameterId) : Boolean(question.is_assigned),
      is_excluded: Array.isArray(data?.excluded_parameter_ids) ? excludedIds.has(parameterId) : Boolean(question.is_excluded)
    };
  });
}

export function getExcludedParameterIds(questionnaire) {
  if (Array.isArray(questionnaire.excluded_parameter_ids)) {
    return [...new Set(questionnaire.excluded_parameter_ids.map(Number))];
  }
  return [...new Set((questionnaire.customizations || [])
    .filter(item => item.action === "exclude")
    .map(getParameterId))];
}

export function createQuestionnaireDraft(questionnaire) {
  return {
    questionnaireId: questionnaire.id,
    revision: questionnaire.revision ?? questionnaire.updated_at,
    items: normalizeQuestionnaireItems(questionnaire.items || []),
    excludedParameterIds: getExcludedParameterIds(questionnaire)
  };
}

export function isQuestionnaireLocked(questionnaire) {
  if (!questionnaire) return false;
  return Boolean(questionnaire.is_locked ?? questionnaire.locked ?? false);
}

export function hasPendingCustomization(questionnaire) {
  return Boolean(questionnaire?.has_customization_draft ?? questionnaire?.has_pending_draft ?? false);
}

export function getQuestionnaireActivation(questionnaire) {
  if (!questionnaire?.is_published) {
    return {
      label: "Not Active",
      className: "bg-gray-100 text-gray-600",
      description: "No active questionnaire is currently available for evaluation."
    };
  }
  if (questionnaire.activation_type === "customized") {
    return {
      label: "Customized & Active",
      className: "bg-blue-50 text-blue-700",
      description: "Managers are evaluating the published customized questionnaire."
    };
  }
  return {
    label: "Automatically Active",
    className: "bg-emerald-50 text-emerald-700",
    description: "Managers can evaluate the automatically configured questionnaire without manual publication."
  };
}

export function reorderItems(items) {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}

export function moveQuestion(items, fromId, toId) {
  const fromIndex = items.findIndex(item => item.parameter_id === Number(fromId));
  const toIndex = items.findIndex(item => item.parameter_id === Number(toId));
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return reorderItems(next);
}

export function includeQuestion(draft, question) {
  if (!draft || question.is_active === false) return draft;
  const parameterId = getParameterId(question);
  if (!Number.isInteger(parameterId) || parameterId < 1) return draft;
  if (draft.items.some(item => item.parameter_id === parameterId)) return draft;
  const item = {
    ...question,
    parameter_id: parameterId,
    weightage: question.default_weightage ?? question.weightage ?? 1,
    source: question.is_automatic ? "automatic" : "manual",
    order: draft.items.length + 1
  };
  return {
    ...draft,
    items: [...draft.items, item],
    excludedParameterIds: draft.excludedParameterIds.filter(id => id !== parameterId)
  };
}

export function excludeQuestion(draft, parameterId) {
  if (!draft) return draft;
  const id = Number(parameterId);
  const item = draft.items.find(question => question.parameter_id === id);
  if (!item) return draft;
  const excluded = new Set(draft.excludedParameterIds);
  if (item.source === "automatic" || item.is_automatic) excluded.add(id);
  return {
    ...draft,
    items: reorderItems(draft.items.filter(question => question.parameter_id !== id)),
    excludedParameterIds: [...excluded]
  };
}

export function updateQuestionWeightage(draft, parameterId, weightage) {
  return {
    ...draft,
    items: draft.items.map(item => item.parameter_id === Number(parameterId)
      ? { ...item, weightage }
      : item)
  };
}

export function resetQuestionWeightage(draft, parameterId, availableQuestions = []) {
  const item = draft.items.find(question => question.parameter_id === Number(parameterId));
  const original = availableQuestions.find(question => question.parameter_id === Number(parameterId));
  const weightage = original?.default_weightage ?? item?.default_weightage;
  if (weightage === undefined) return draft;
  return updateQuestionWeightage(draft, parameterId, weightage);
}

export function validateQuestionnaireDraft(draft, { publishing = false } = {}) {
  const errors = [];
  if (!draft?.questionnaireId) return ["Select a Potential questionnaire."];
  if (!draft.revision) errors.push("Questionnaire revision is missing. Reload the questionnaire.");
  if (draft.items.length > 1000) errors.push("A questionnaire cannot contain more than 1000 questions.");
  if (draft.excludedParameterIds.length > 1000) errors.push("A questionnaire cannot contain more than 1000 exclusions.");
  const included = new Set();
  for (const item of draft.items) {
    const id = Number(item.parameter_id);
    const weightage = Number(item.weightage);
    if (!Number.isInteger(id) || id < 1) errors.push("An invalid question is present.");
    if (included.has(id)) errors.push(`Duplicate question #${id}.`);
    included.add(id);
    if (!Number.isFinite(weightage) || weightage <= 0) errors.push(`Question #${id} requires a positive weightage.`);
    if (item.is_active === false) errors.push(`Question #${id} is inactive or unavailable. Remove it before continuing.`);
  }
  if (draft.excludedParameterIds.some(id => included.has(Number(id)))) {
    errors.push("A question cannot be included and excluded simultaneously.");
  }
  if (publishing && !draft.items.length) errors.push("Add questions before publishing.");
  if (publishing && !draft.items.some(item => item.question_type === "objective")) {
    errors.push("At least one objective question is required before publication.");
  }
  return errors;
}

export function buildQuestionnaireDraftPayload(draft) {
  const errors = validateQuestionnaireDraft(draft);
  if (errors.length) throw new Error(errors.join(" "));
  return {
    revision: draft.revision,
    items: draft.items.map(item => ({
      parameter_id: Number(item.parameter_id),
      weightage: Number(item.weightage)
    })),
    excluded_parameter_ids: [...new Set(draft.excludedParameterIds.map(Number))]
  };
}

function draftSignature(draft) {
  if (!draft) return "";
  return JSON.stringify({
    items: draft.items.map(item => [
      Number(item.parameter_id),
      String(item.weightage).trim() === "" ? "" : Number(item.weightage)
    ]),
    excluded: [...draft.excludedParameterIds].map(Number).sort((a, b) => a - b)
  });
}

export function hasQuestionnaireChanges(draft, original) {
  return draftSignature(draft) !== draftSignature(original);
}

export function getQuestionnaireStats(items = []) {
  return {
    total: items.length,
    objective: items.filter(item => item.question_type === "objective").length,
    descriptive: items.filter(item => item.question_type === "descriptive").length,
    automatic: items.filter(item => item.source === "automatic").length,
    manual: items.filter(item => item.source === "manual").length,
    totalWeightage: items.reduce((total, item) => {
      const weightage = Number(item.weightage);
      return total + (Number.isFinite(weightage) && weightage > 0 ? weightage : 0);
    }, 0)
  };
}

export function filterBuilderQuestions(questions, filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  return questions.filter(question => {
    if (search && ![
      question.question_text, question.category_name, question.parameter_id
    ].join(" ").toLowerCase().includes(search)) return false;
    if (filters.type && filters.type !== "all" && question.question_type !== filters.type) return false;
    if (filters.category && filters.category !== "all" && question.category_name !== filters.category) return false;
    if (filters.source && filters.source !== "all" && question.source !== filters.source) return false;
    return true;
  });
}

export function getQuestionnaireStatus(status) {
  const statuses = {
    draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
    pending_rm: { label: "Pending RM Evaluation", className: "bg-amber-50 text-amber-700" },
    pending_skip: { label: "Pending Skip Evaluation", className: "bg-blue-50 text-blue-700" },
    completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700" }
  };
  return statuses[status] || {
    label: status || "Draft",
    className: "bg-gray-100 text-gray-700"
  };
}

export function getPotentialResetImpact(data = {}) {
  const labels = {
    potential_score: "Calculated Potential Score",
    ninebox: "Nine-Box Placement",
    appraisal: "Appraisal Recommendation",
    analytics_release: "Released Employee Analytics",
    cached_potential: "Cached Potential Score",
    cached_ninebox: "Cached Nine-Box Placement"
  };
  const affectedResults = Object.entries(data.dependent_results || {})
    .filter(([, affected]) => Boolean(affected))
    .map(([key]) => labels[key] || key.replaceAll("_", " "));
  if (data.descriptive_calculated) affectedResults.push("Potential Descriptive Score");
  return {
    responseCount: Number(data.response_count || 0),
    rmResponseCount: Number(data.rm_response_count || 0),
    skipResponseCount: Number(data.skip_response_count || 0),
    rmSubmitted: Boolean(data.rm_submitted),
    skipSubmitted: Boolean(data.skip_submitted),
    reportingManager: data.reporting_manager || null,
    skipLevelManager: data.skip_level_manager || null,
    affectedResults: [...new Set(affectedResults)]
  };
}