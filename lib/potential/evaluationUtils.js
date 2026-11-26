export function getPotentialQuestionId(question) {
    return Number(question.questionnaire_item_id ?? question.id);
  }
  
  export function normalizePotentialEvaluation(data) {
    const assessment = data?.assessment ?? data?.evaluation ?? data;
    if (!assessment || typeof assessment !== "object") throw new Error("Invalid Potential evaluation response.");
    const questions = assessment.questions ?? assessment.items ?? [];
    if (!Array.isArray(questions)) throw new Error("Invalid Potential questionnaire questions.");
    return {
      ...assessment,
      id: assessment.id ?? assessment.assessment_id,
      employee_name: assessment.employee_name ?? assessment.employee?.full_name ?? "",
      review_cycle_name: assessment.review_cycle_name ?? assessment.review_cycle?.name ?? "",
      revision: assessment.revision ?? assessment.updated_at,
      questions: [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(question => ({
        ...question,
        questionnaire_item_id: getPotentialQuestionId(question),
        parameter_id: Number(question.parameter_id),
        question_text: question.question_text_snapshot ?? question.question_text ?? "",
        question_type: question.question_type_snapshot ?? question.question_type ?? "objective",
        max_marks: Number(question.max_marks_snapshot ?? question.max_marks ?? 10),
        category_name: question.category_name_snapshot ?? question.category_name ?? "Uncategorized"
      }))
    };
  }
  
  export function normalizePotentialResponses(assessment, evaluator) {
    const responses = assessment?.responses ?? {};
    const normalized = {};
    for (const question of assessment?.questions ?? []) {
      const id = getPotentialQuestionId(question);
      let response;
      if (Array.isArray(responses)) {
        response = responses.find(item =>
          (!item.evaluator_type || item.evaluator_type === evaluator) &&
          (Number(item.questionnaire_item_id) === id ||
            (!item.questionnaire_item_id && Number(item.parameter_id) === question.parameter_id))
        );
      } else {
        response = responses[id] ?? responses[question.parameter_id];
        if (response?.evaluator_type && response.evaluator_type !== evaluator) response = undefined;
      }
      if (question.question_type === "descriptive") {
        normalized[id] = {
          descriptive_answer: typeof response === "string" ? response : response?.descriptive_answer ?? ""
        };
      } else {
        const score = typeof response === "number" || typeof response === "string" ? response : response?.score;
        normalized[id] = { score: score === null || score === undefined ? "" : String(score) };
      }
    }
    return normalized;
  }
  
  export function validatePotentialAnswer(question, response, required = true) {
    const id = getPotentialQuestionId(question);
    if (!Number.isInteger(id) || id < 1) return "Invalid questionnaire item. Reload the assessment.";
    if (question.question_type === "descriptive") {
      const answer = String(response?.descriptive_answer ?? "").trim();
      if (!answer && required) return "Please provide a descriptive answer.";
      return null;
    }
    if (question.question_type !== "objective") return "Unsupported question type.";
    const raw = response?.score;
    if (raw === "" || raw === null || raw === undefined || String(raw).trim() === "") {
      return required ? "Please enter a score." : null;
    }
    const score = Number(raw);
    const maxMarks = Number(question.max_marks);
    if (!Number.isFinite(maxMarks) || maxMarks <= 0) return "Invalid maximum marks.";
    if (!Number.isFinite(score)) return "Please enter a valid numerical score.";
    if (score < 0 || score > maxMarks) return `Score must be between 0 and ${maxMarks}.`;
    return null;
  }
  
  export function hasPotentialAnswer(question, response) {
    if (question.question_type === "descriptive") return Boolean(String(response?.descriptive_answer ?? "").trim());
    return response?.score !== "" && response?.score !== null && response?.score !== undefined && String(response.score).trim() !== "";
  }
  
  export function validatePotentialEvaluation(questions, responses, submitting = false) {
    const errors = {};
    for (const question of questions) {
      const id = getPotentialQuestionId(question);
      const error = validatePotentialAnswer(question, responses[id], submitting);
      if (error) errors[id] = error;
    }
    return errors;
  }
  
  export function buildPotentialEvaluationPayload(assessment, responses, submitting = false) {
    if (!assessment?.id) throw new Error("Invalid Potential assessment.");
    if (!assessment.questions?.length) throw new Error("This questionnaire contains no questions.");
    if (!assessment.revision) throw new Error("Assessment revision is unavailable. Reload before continuing.");
    const errors = validatePotentialEvaluation(assessment.questions, responses, submitting);
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    const answers = assessment.questions.filter(question =>
      submitting || hasPotentialAnswer(question, responses[getPotentialQuestionId(question)])
    ).map(question => {
      const id = getPotentialQuestionId(question);
      const response = responses[id];
      return question.question_type === "descriptive"
        ? { questionnaire_item_id: id, descriptive_answer: String(response.descriptive_answer).trim() }
        : { questionnaire_item_id: id, score: Number(response.score) };
    });
    return {
      assessment_id: Number(assessment.id),
      revision: assessment.revision,
      responses: answers
    };
  }
  
  export function getPotentialEvaluationProgress(questions = [], responses = {}) {
    let answered = 0, objective = 0, descriptive = 0, objectiveAnswered = 0, descriptiveAnswered = 0;
    for (const question of questions) {
      const valid = !validatePotentialAnswer(question, responses[getPotentialQuestionId(question)], true);
      if (valid) answered++;
      if (question.question_type === "descriptive") {
        descriptive++;
        if (valid) descriptiveAnswered++;
      } else {
        objective++;
        if (valid) objectiveAnswered++;
      }
    }
    return {
      total: questions.length, answered, objective, descriptive,
      objectiveAnswered, descriptiveAnswered,
      remaining: questions.length - answered,
      percentage: questions.length ? Math.round(answered / questions.length * 100) : 0
    };
  }
  
  export function potentialResponsesChanged(current, original) {
    const normalize = responses => JSON.stringify(Object.keys(responses || {}).sort((a, b) => Number(a) - Number(b)).map(id => {
      const response = responses[id];
      return [id, response?.descriptive_answer !== undefined
        ? String(response.descriptive_answer).trim()
        : response?.score === "" || response?.score === null || response?.score === undefined
          ? "" : String(Number(response.score))];
    }));
    return normalize(current) !== normalize(original);
  }
  
  export function getPotentialEvaluationState(assessment, evaluator) {
    const submitted = Boolean(assessment?.is_submitted || (evaluator === "rm" ? assessment?.rm_submitted : assessment?.skip_submitted));
    const expectedStatus = evaluator === "rm" ? "pending_rm" : "pending_skip";
    const correctStage = assessment?.status === expectedStatus;
    const published = assessment?.is_published !== false;
    const correctEvaluator = !assessment?.evaluator_type || assessment.evaluator_type === evaluator;
    const canEvaluate = Boolean(
      assessment && published && correctEvaluator && !submitted &&
      correctStage && assessment.can_evaluate !== false
    );
    return { submitted, canEvaluate, published, correctStage, correctEvaluator };
  }
  
  export function getPotentialError(data, fallback = "Potential evaluation request failed.") {
    if (typeof data === "string") return data;
    if (!data || typeof data !== "object") return fallback;
    for (const field of ["detail", "error", "message", "non_field_errors"]) {
      if (typeof data[field] === "string") return data[field];
      if (Array.isArray(data[field])) return data[field].join(" ");
    }
    const messages = Object.entries(data).flatMap(([field, value]) => {
      if (typeof value === "string") return [`${field}: ${value}`];
      if (Array.isArray(value)) return value.map(item => typeof item === "string" ? `${field}: ${item}` : "");
      return [];
    }).filter(Boolean);
    return messages.length ? messages.join(" ") : fallback;
  }