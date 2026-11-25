export function emptyEvaluationAnswer() {
    return { score: "", descriptive_answer: "" };
  }
  
  export function restoreEvaluationDraft(questions, draft, idField = "item_id") {
    const saved = new Map(
      (Array.isArray(draft?.responses) ? draft.responses : []).map(response => [
        Number(response.item_id),
        response
      ])
    );
  
    const responses = Object.fromEntries(
      questions.map(question => {
        const itemId = question[idField];
        const previous = saved.get(Number(itemId));
  
        return [
          itemId,
          {
            score: previous?.score ?? "",
            descriptive_answer: previous?.descriptive_answer ?? ""
          }
        ];
      })
    );
  
    return {
      responses,
      feedback: draft?.feedback ?? "",
      scope_of_improvement: draft?.scope_of_improvement ?? ""
    };
  }
  
  export function buildEvaluationResponses(questions, responses, idField = "item_id", onlyAnswered = false) {
    return questions.flatMap(question => {
      const itemId = question[idField];
      const answer = responses[itemId] || emptyEvaluationAnswer();
  
      if (question.question_type === "descriptive") {
        const text = String(answer.descriptive_answer ?? "").trim();
        if (!text && onlyAnswered) return [];
        return [{ item_id: itemId, descriptive_answer: text }];
      }
  
      if (answer.score === "" || answer.score === null || answer.score === undefined) {
        return onlyAnswered ? [] : [{ item_id: itemId, score: null }];
      }
  
      return [{ item_id: itemId, score: Number(answer.score) }];
    });
  }
  
  export function validateEvaluation(questions, responses, idField = "item_id", requireFeedback = false, feedback = "", scope = "") {
    if (!questions.length) return "No questions are available for submission.";
  
    for (const question of questions) {
      const answer = responses[question[idField]] || emptyEvaluationAnswer();
  
      if (question.question_type === "descriptive") {
        if (!String(answer.descriptive_answer ?? "").trim()) {
          return "Please answer all descriptive questions before submission.";
        }
        continue;
      }
  
      if (answer.score === "" || answer.score === null || answer.score === undefined) {
        return "Please rate all objective questions before submission.";
      }
  
      const score = Number(answer.score);
      const max = Number(question.max_marks);
  
      if (!Number.isInteger(score) || !Number.isInteger(max) || score < 0 || score > max) {
        return `Objective scores must be whole numbers between 0 and ${max}.`;
      }
    }
  
    if (requireFeedback && !feedback.trim()) return "Please add feedback before submission.";
    if (requireFeedback && !scope.trim()) return "Please add scope of improvement before submission.";
  
    return null;
  }
  
  export function getEvaluationError(data, fallback) {
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
    if (data?.error && typeof data.error === "object") return JSON.stringify(data.error);
    return fallback;
  }