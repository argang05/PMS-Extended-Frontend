export const DESCRIPTIVE_MODES = {
    performance: "Performance",
    potential: "Potential"
  };
  
  export const REVIEW_STATUSES = {
    performance: ["draft", "self_submitted", "under_rm_review", "rm_reviewed", "under_skip_review", "skip_reviewed", "under_peer_review", "completed"],
    potential: ["draft", "pending_rm", "pending_skip", "completed"]
  };
  
  export const READINESS_LABELS = {
    evaluation_pending: "Awaiting Manager Evaluations",
    legacy_reconciliation_required: "Legacy Response Reconciliation Required",
    objective_only: "Objective-Only Scoring",
    responses_incomplete: "Incomplete Evaluator Responses",
    no_descriptive_questions: "No Descriptive Questions",
    descriptive_scoring_pending: "Descriptive Scoring Pending",
    ready: "Ready for Potential Calculation"
  };
  
  export function formatText(value) {
    return String(value || "").replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
  }
  
  export function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }
  
  export function getEmployeeName(employee) {
    if (!employee) return "";
    if (typeof employee === "string") return employee;
    if (typeof employee !== "object") return "";
    return employee.full_name || employee.employee_name || employee.name || `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  }
  
  export function evaluatorLabel(type) {
    return {
      self: "Self Evaluation",
      rm: "Reporting Manager",
      skip: "Skip-Level Manager",
      peer: "Peer Reviewer"
    }[type] || formatText(type);
  }
  
  export function normalizeQuestionnaireList(data, mode) {
    return data.map(item => {
      const employee = item.employee && typeof item.employee === "object" ? item.employee : {};
      const cycle = item.review_cycle && typeof item.review_cycle === "object" ? item.review_cycle : {};
      const id = mode === "potential" ? item.assessment_id ?? item.id : item.questionnaire_id ?? item.id;
      const questionnaireId = mode === "performance" ? id : item.employee_questionnaire_id ?? item.employee_questionnaire?.id ?? item.employee_questionnaire ?? item.questionnaire_id;
      return {
        ...item,
        id: id == null ? "" : String(id),
        questionnaire_id: questionnaireId == null ? "" : String(questionnaireId),
        assessment_id: mode === "potential" ? String(id ?? "") : String(item.potential_assessment_id ?? ""),
        employee_id: String(item.employee_id ?? employee.id ?? (typeof item.employee === "number" ? item.employee : "")),
        employee_number: item.employee_number ?? employee.employee_number ?? "",
        employee_name: item.employee_name || getEmployeeName(employee) || "Employee",
        department: item.department || employee.department || "",
        review_cycle_id: String(item.review_cycle_id ?? cycle.id ?? (typeof item.review_cycle === "number" ? item.review_cycle : "")),
        review_cycle_name: item.review_cycle_name || cycle.name || (typeof item.review_cycle === "string" ? item.review_cycle : ""),
        status: item.status || "draft",
        question_count: item.question_count ?? item.item_count ?? item.total_questions ?? item.items_count ?? null,
        preference_enabled: mode === "performance" ? item.descriptive_scoring_enabled : item.is_descriptive_scoring_enabled ?? item.preference?.is_enabled
      };
    }).filter(item => item.id);
  }
  
  export function findCorrespondingQuestionnaire(items, selected, targetMode) {
    if (!selected) return null;
    if (selected.questionnaire_id) {
      const match = items.find(item => item.questionnaire_id === selected.questionnaire_id);
      if (match) return match;
    }
    if (targetMode === "potential" && selected.assessment_id) {
      const match = items.find(item => item.id === selected.assessment_id);
      if (match) return match;
    }
    if (selected.employee_id && selected.review_cycle_id) {
      return items.find(item => item.employee_id === selected.employee_id && item.review_cycle_id === selected.review_cycle_id) || null;
    }
    return null;
  }
  
  export function normalizePreference(data, mode) {
    const preference = data?.preference ?? data;
    const enabled = mode === "potential" ? preference?.is_enabled : preference?.descriptive_scoring_enabled;
    if (typeof enabled !== "boolean") throw new Error(`Invalid ${mode} descriptive scoring preference.`);
    return {
      ...preference,
      enabled,
      revision: preference.revision ?? null,
      readiness: preference.readiness ?? null,
      has_dependent_results: Boolean(preference.has_dependent_results),
      dependent_results: preference.dependent_results ?? {}
    };
  }
  
  function normalizeResponse(response) {
    return {
      ...response,
      id: response.response_id ?? response.id,
      evaluator_type: response.evaluator_type,
      submitted_by: getEmployeeName(response.submitted_by),
      descriptive_answer: response.descriptive_answer ?? "",
      admin_score: response.admin_score ?? null,
      admin_remarks: response.admin_remarks ?? ""
    };
  }
  
  function getPerformanceQuestionKey(response) {
    const id = response.question_id ?? response.questionnaire_item_id ?? response.item_id;
    return id != null ? `performance:${id}` : `performance:text:${String(response.question || "").trim()}:${response.category || ""}:${response.category_type || ""}`;
  }
  
  function getConsolidatedState(responses, maxMarks) {
    if (!responses.length) return { score: "", remarks: "", is_scored: false, has_conflict: false };
    const marked = responses.filter(response => response.admin_score != null);
    if (!marked.length) return { score: "", remarks: "", is_scored: false, has_conflict: false };
    const first = marked[0];
    const sameScore = responses.every(response => response.admin_score != null && Number(response.admin_score) === Number(first.admin_score));
    const sameRemarks = responses.every(response => String(response.admin_remarks || "") === String(first.admin_remarks || ""));
    const validScore = Number.isInteger(Number(first.admin_score)) && Number(first.admin_score) >= 1 && Number(first.admin_score) <= maxMarks;
    return {
      score: sameScore ? String(first.admin_score) : "",
      remarks: sameRemarks ? first.admin_remarks || "" : "",
      is_scored: sameScore && sameRemarks && validScore,
      has_conflict: !sameScore || !sameRemarks || !validScore
    };
  }
  
  export function normalizePerformanceWorkspace(data, preference, id) {
    if (!Array.isArray(data?.responses)) throw new Error("Invalid Performance descriptive responses.");
    const groups = new Map();
    data.responses.filter(response => !response.is_not_applicable).forEach(raw => {
      const key = getPerformanceQuestionKey(raw);
      const response = normalizeResponse(raw);
      if (!groups.has(key)) groups.set(key, {
        key,
        questionnaire_item_id: raw.questionnaire_item_id ?? raw.question_id ?? raw.item_id ?? null,
        question_text: raw.question || raw.question_text || "",
        category_name: raw.category || "Uncategorized",
        category_type: raw.category_type || "",
        responses: [],
        max_marks: 10,
        responses_complete: true,
        can_score: true
      });
      const group = groups.get(key);
      const maximum = Number(raw.max_marks);
      group.max_marks = Number.isInteger(maximum) && maximum > 0 ? Math.min(group.max_marks, maximum) : 0;
      group.responses.push(response);
    });
    const questions = [...groups.values()].map(group => ({
      ...group,
      ...getConsolidatedState(group.responses, group.max_marks),
      has_saved_marks: group.responses.some(response => response.admin_score != null)
    }));
    return {
      mode: "performance",
      id: String(id),
      questionnaire_id: String(id),
      employee_name: data.employee_name || getEmployeeName(data.employee),
      review_cycle_name: data.review_cycle_name || data.review_cycle || "",
      preference,
      questions,
      readiness: null
    };
  }
  
  export function normalizePotentialWorkspace(data) {
    if (!data?.assessment_id || !Array.isArray(data.questions)) throw new Error("Invalid Potential descriptive workspace.");
    const preference = normalizePreference(data.preference, "potential");
    const questions = data.questions.map(question => ({
      ...question,
      key: `potential:${question.questionnaire_item_id}`,
      questionnaire_item_id: Number(question.questionnaire_item_id),
      question_text: question.question_text || "",
      category_name: question.category_name || "Uncategorized",
      category_type: "",
      max_marks: Math.min(10, Number(question.max_marks)),
      responses: (question.responses || []).map(normalizeResponse),
      score: question.score == null ? "" : String(question.score),
      remarks: question.remarks || "",
      is_scored: question.is_scored === true,
      has_conflict: question.has_conflict === true,
      responses_complete: question.responses_complete === true,
      can_score: question.can_score === true,
      has_saved_marks: (question.responses || []).some(response => response.admin_score != null)
    }));
    return {
      ...data,
      mode: "potential",
      id: String(data.assessment_id),
      questionnaire_id: String(data.employee_questionnaire_id ?? ""),
      employee_name: getEmployeeName(data.employee),
      review_cycle_name: data.review_cycle_name || "",
      preference,
      readiness: preference.readiness,
      questions
    };
  }
  
  export function createDescriptiveDrafts(questions = []) {
    return Object.fromEntries(questions.map(question => [
      question.key, {
        score: question.score == null ? "" : String(question.score),
        remarks: question.remarks || "",
        resolve_conflict: false
      }
    ]));
  }
  
  export function validateDescriptiveScore(question, draft) {
    if (!question.can_score) return "Required evaluator responses are incomplete.";
    if (!draft || draft.score === "" || draft.score == null) return "Consolidated score is required.";
    const maximum = Number(question.max_marks);
    if (!Number.isInteger(maximum) || maximum < 1) return "Invalid maximum marks. Refresh the workspace.";
    const score = Number(draft.score);
    if (!Number.isInteger(score) || score < 1 || score > maximum) return `Score must be a whole number between 1 and ${maximum}.`;
    if (question.has_conflict && !draft.resolve_conflict) return "Confirm the consolidated marks and remarks to resolve conflicting scores.";
    return null;
  }
  
  export function isDescriptiveDraftChanged(draft, original) {
    if (!draft || !original) return false;
    return String(draft.score) !== String(original.score) ||
      String(draft.remarks || "") !== String(original.remarks || "") ||
      Boolean(draft.resolve_conflict) !== Boolean(original.resolve_conflict);
  }
  
  export function buildDescriptiveScorePayload(mode, questions, drafts) {
    const scores = [];
    for (const question of questions) {
      const draft = drafts[question.key];
      const error = validateDescriptiveScore(question, draft);
      if (error) throw new Error(`"${question.question_text}": ${error}`);
      const score = Number(draft.score);
      const remarks = String(draft.remarks || "").trim();
      if (mode === "potential") {
        if (!Number.isInteger(question.questionnaire_item_id) || question.questionnaire_item_id < 1) throw new Error("Invalid Potential questionnaire item.");
        scores.push({ questionnaire_item_id: question.questionnaire_item_id, score, remarks });
      } else {
        question.responses.forEach(response => {
          if (!Number.isInteger(Number(response.id)) || Number(response.id) < 1) throw new Error("Invalid Performance response ID.");
          if (response.admin_score == null || Number(response.admin_score) !== score || String(response.admin_remarks || "") !== remarks) {
            scores.push({ response_id: Number(response.id), score, remarks });
          }
        });
      }
    }
    return scores;
  }
  
  export function getDescriptiveProgress(questions = []) {
    const total = questions.length;
    const scored = questions.filter(question => question.is_scored && question.responses_complete).length;
    return {
      total,
      scored,
      pending: total - scored,
      conflicts: questions.filter(question => question.has_conflict).length,
      incomplete: questions.filter(question => !question.responses_complete).length,
      responses: questions.reduce((sum, question) => sum + question.responses.length, 0),
      percentage: total ? Math.round(scored / total * 100) : 0
    };
  }
  
  export function filterDescriptiveQuestions(questions, filters = {}) {
    const search = String(filters.search || "").trim().toLowerCase();
    return questions.filter(question => {
      if (filters.evaluator && !question.responses.some(response => response.evaluator_type === filters.evaluator)) return false;
      if (filters.scoring === "scored" && !question.is_scored) return false;
      if (filters.scoring === "pending" && question.is_scored) return false;
      if (filters.scoring === "conflict" && !question.has_conflict) return false;
      if (filters.scoring === "incomplete" && question.responses_complete) return false;
      if (search && ![
        question.question_text, question.category_name, question.category_type,
        ...question.responses.flatMap(response => [response.descriptive_answer, response.submitted_by])
      ].join(" ").toLowerCase().includes(search)) return false;
      return true;
    });
  }
  
  export function getDependencyLabels(dependencies = {}) {
    const labels = {
      performance_score: "Performance Score",
      potential_score: "Potential Score",
      ppi: "Past Performance Index",
      ninebox: "Nine-Box Placement",
      appraisal: "Appraisal Recommendation",
      analytics_release: "Released Employee Analytics",
      cached_potential: "Cached Potential Score",
      cached_ninebox: "Cached Nine-Box Placement"
    };
    return Object.entries(dependencies).filter(([, value]) => value === true).map(([key]) => labels[key] || formatText(key));
  }