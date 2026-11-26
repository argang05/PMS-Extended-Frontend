"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchCurrentQuestionnaire, saveQuestionnaireDraft, submitQuestionnaire } from "@/services/questionnaire";
import { emptyEvaluationAnswer, restoreEvaluationDraft, buildEvaluationResponses, validateEvaluation, getEvaluationError } from "@/lib/evaluationDraft";

export const PERFORMANCE_ROLES = {
  self: { label: "Self", title: "Self Questionnaire", summary: "Self Summary", idKey: "id" },
  rm: { label: "Reporting Manager", title: "RM Review Questionnaire", summary: "Manager Summary", idKey: "item_id" },
  skip: { label: "Skip-Level Manager", title: "Skip-Level Review Questionnaire", summary: "Skip-Level Summary", idKey: "item_id" },
  peer: { label: "Peer", title: "Peer Review Questionnaire", summary: "Peer Summary", idKey: "item_id" }
};

function emptyAnswer() {
  return { ...emptyEvaluationAnswer(), score: "", descriptive_answer: "", is_not_applicable: false };
}

function normalizeAnswer(answer) {
  return {
    score: answer?.score === null || answer?.score === undefined ? "" : String(answer.score),
    descriptive_answer: answer?.descriptive_answer || "",
    is_not_applicable: Boolean(answer?.is_not_applicable)
  };
}

function normalizeResponses(questions, responses, idKey) {
  return Object.fromEntries(questions.map(question => [
    question[idKey], normalizeAnswer(responses?.[question[idKey]])
  ]));
}

function signature(responses, feedback, scope) {
  return JSON.stringify({
    responses: Object.fromEntries(Object.entries(responses || {}).sort(([a], [b]) => Number(a) - Number(b))),
    feedback: feedback || "",
    scope: scope || ""
  });
}

export function getPerformanceCategory(question) {
  const category = String(question?.category || "").toLowerCase();
  const type = String(question?.category_type || "").toLowerCase();
  if (type === "behavioral" || category.includes("behavior") || category.includes("behaviour") || category.includes("skillset")) return "behavioral";
  if (type === "performance" || category.includes("performance")) return "performance";
  return "additional";
}

export function formatPerformanceQuestion(text, employeeName, role) {
  if (!text || role === "self") return text || "";
  const target = employeeName || "this employee";
  return text
    .replace(/^On a scale of 1-10,\s*how effectively do I\s+/i, `On a scale of 1-10, how effectively does ${target} `)
    .replace(/^On a scale of 1–10,\s*how effectively do I\s+/i, `On a scale of 1–10, how effectively does ${target} `)
    .replace(/\bdo I\b/gi, `does ${target}`)
    .replace(/\bmy\b/gi, `${target}'s`)
    .replace(/\bme\b/gi, target)
    .replace(/\bI\b/g, target);
}

export function validatePerformanceAnswer(question, answer, role, required = true) {
  const value = answer || emptyAnswer();
  if (role === "peer" && value.is_not_applicable) return null;
  if (question.question_type === "descriptive") {
    if (required && !String(value.descriptive_answer || "").trim()) return "Please provide a written response.";
    return null;
  }
  if (value.score === "" || value.score === null || value.score === undefined) {
    return required ? "Please select a rating." : null;
  }
  const score = Number(value.score);
  const max = Number(question.max_marks ?? 10);
  if (!Number.isInteger(score) || score < 0 || score > max) return `Select a valid rating between 0 and ${max}.`;
  return null;
}

function buildPeerResponses(questions, responses, onlyAnswered) {
  return questions.flatMap(question => {
    const answer = responses[question.item_id] || emptyAnswer();
    if (answer.is_not_applicable) return [{ item_id: question.item_id, is_not_applicable: true }];
    if (question.question_type === "descriptive") {
      const text = String(answer.descriptive_answer || "").trim();
      if (!text && onlyAnswered) return [];
      return [{ item_id: question.item_id, descriptive_answer: text }];
    }
    if (answer.score === "" || answer.score === null || answer.score === undefined) {
      return onlyAnswered ? [] : [{ item_id: question.item_id, score: null }];
    }
    return [{ item_id: question.item_id, score: Number(answer.score) }];
  });
}

export function usePerformanceEvaluation(accessToken, role, routeId = null) {
  const config = PERFORMANCE_ROLES[role];
  const idKey = config.idKey;
  const contextKey = `${role}:${routeId || "current"}:${accessToken || ""}`;
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const operationRef = useRef(null);
  const loadSequence = useRef(0);
  const [assessment, setAssessment] = useState(null);
  const [responses, setResponses] = useState({});
  const [feedback, setFeedback] = useState("");
  const [scope, setScope] = useState("");
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState("");
  const [requiresReload, setRequiresReload] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const api = useCallback(async (path, method = "GET", payload) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const options = { method, headers, cache: "no-store" };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(path, options);
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("Invalid response received from server.");
    }
    if (!response.ok) {
      const error = new Error(getEvaluationError(data, `Request failed (${response.status}).`));
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }, [accessToken]);

  const fetchAssessment = useCallback(async () => {
    let data, draft, submitted;
    if (role === "self") {
      data = await fetchCurrentQuestionnaire(accessToken);
      draft = data?.draft;
      submitted = Boolean(data?.status && data.status !== "draft");
    } else {
      if (!routeId) throw new Error("Invalid questionnaire ID.");
      data = await api(`/api/evaluations/${role}/review-form/${routeId}`);
      if (role === "peer") {
        draft = await api(`/api/evaluations/peer/my-draft/${routeId}`);
        const status = draft?.peer_status || data?.peer_status;
        submitted = ["completed", "submitted"].includes(status);
      } else {
        draft = data?.draft;
        submitted = data?.review_status === "submitted";
      }
    }
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    const restored = restoreEvaluationDraft(questions, draft, idKey);
    const restoredResponses = normalizeResponses(questions, restored.responses, idKey);
    if (role === "peer" && Array.isArray(draft?.responses)) {
      draft.responses.forEach(response => {
        const key = response.item_id;
        if (Object.prototype.hasOwnProperty.call(restoredResponses, key)) restoredResponses[key] = normalizeAnswer(response);
      });
    }
    return {
      assessment: {
        id: role === "self" ? data?.questionnaire_id : Number(routeId),
        employee_name: data?.employee_name || "",
        department: data?.department || "",
        review_cycle: data?.review_cycle_name || data?.review_cycle?.name || (typeof data?.review_cycle === "string" ? data.review_cycle : ""),
        submitted,
        questions
      },
      responses: restoredResponses,
      feedback: restored.feedback || "",
      scope: restored.scope_of_improvement || ""
    };
  }, [accessToken, role, routeId, idKey, api]);

  const acceptSnapshot = useCallback(snapshot => {
    setAssessment(snapshot.assessment);
    setResponses(snapshot.responses);
    setFeedback(snapshot.feedback);
    setScope(snapshot.scope);
    setOriginal({ responses: snapshot.responses, feedback: snapshot.feedback, scope: snapshot.scope });
    setValidationErrors({});
    setRequiresReload(false);
    setError("");
  }, []);

  const reload = useCallback(async () => {
    if (!accessToken) return false;
    const sequence = ++loadSequence.current;
    const context = contextKey;
    setLoading(true);
    setError("");
    try {
      const snapshot = await fetchAssessment();
      if (contextRef.current !== context || sequence !== loadSequence.current) return false;
      acceptSnapshot(snapshot);
      return true;
    } catch (error) {
      if (contextRef.current === context && sequence === loadSequence.current) {
        setError(error.message || "Unable to load questionnaire.");
        setRequiresReload(true);
      }
      return false;
    } finally {
      if (contextRef.current === context && sequence === loadSequence.current) setLoading(false);
    }
  }, [accessToken, contextKey, fetchAssessment, acceptSnapshot]);

  useEffect(() => {
    setAssessment(null);
    setResponses({});
    setFeedback("");
    setScope("");
    setOriginal(null);
    setPendingAction(null);
    setValidationErrors({});
    setRequiresReload(false);
    operationRef.current = null;
    reload();
    return () => { loadSequence.current += 1; };
  }, [contextKey, reload]);

  const questions = assessment?.questions || [];
  const busy = Boolean(pendingAction);
  const submitted = Boolean(assessment?.submitted);
  const editable = Boolean(assessment?.id) && !submitted && !loading && !busy && !requiresReload;

  const dirty = useMemo(() => {
    if (!original || submitted) return false;
    return signature(responses, feedback, scope) !== signature(original.responses, original.feedback, original.scope);
  }, [responses, feedback, scope, original, submitted]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const handler = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, busy]);

  const progress = useMemo(() => {
    const total = questions.length;
    let answered = 0, objective = 0, descriptive = 0, objectiveAnswered = 0, descriptiveAnswered = 0, notApplicable = 0;
    questions.forEach(question => {
      const answer = responses[question[idKey]];
      const valid = !validatePerformanceAnswer(question, answer, role, true);
      const isDescriptive = question.question_type === "descriptive";
      if (valid) answered++;
      if (role === "peer" && answer?.is_not_applicable) notApplicable++;
      if (isDescriptive) {
        descriptive++;
        if (valid) descriptiveAnswered++;
      } else {
        objective++;
        if (valid) objectiveAnswered++;
      }
    });
    return {
      total, answered, unanswered: total - answered,
      percentage: total ? Math.round(answered / total * 100) : 0,
      objective, descriptive, objectiveAnswered, descriptiveAnswered, notApplicable,
      summaryComplete: Boolean(feedback.trim() && scope.trim())
    };
  }, [questions, responses, feedback, scope, role, idKey]);

  function updateResponse(id, patch) {
    if (!editable) return;
    setResponses(previous => ({ ...previous, [id]: { ...(previous[id] || emptyAnswer()), ...patch } }));
    setValidationErrors(previous => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }

  function updateFeedback(value) {
    if (!editable) return;
    setFeedback(value);
    setValidationErrors(previous => {
      const next = { ...previous };
      delete next.feedback;
      return next;
    });
  }

  function updateScope(value) {
    if (!editable) return;
    setScope(value);
    setValidationErrors(previous => {
      const next = { ...previous };
      delete next.scope;
      return next;
    });
  }

  function discardChanges() {
    if (!original || busy || requiresReload) return false;
    setResponses(original.responses);
    setFeedback(original.feedback);
    setScope(original.scope);
    setValidationErrors({});
    setError("");
    return true;
  }

  function validate(final = true) {
    const errors = {};
    questions.forEach(question => {
      const id = question[idKey];
      const error = validatePerformanceAnswer(question, responses[id], role, final);
      if (error) errors[id] = error;
    });
    if (final && ["self", "peer"].includes(role)) {
      if (!feedback.trim()) errors.feedback = "Please provide feedback.";
      if (!scope.trim()) errors.scope = "Please provide scope of improvement.";
    }
    if (final && !questions.length) errors.general = "There are no questions available for submission.";
    if (final && role !== "peer" && !Object.keys(errors).length) {
      const existingError = role === "self"
        ? validateEvaluation(questions, responses, idKey, true, feedback, scope)
        : validateEvaluation(questions, responses, idKey);
      if (existingError) errors.general = existingError;
    }
    setValidationErrors(errors);
    return errors;
  }

  function buildPayload(final) {
    return {
      questionnaire_id: assessment.id,
      feedback: final && role !== "self" ? feedback.trim() : feedback,
      scope_of_improvement: final && role !== "self" ? scope.trim() : scope,
      responses: role === "peer"
        ? buildPeerResponses(questions, responses, !final)
        : buildEvaluationResponses(questions, responses, idKey, !final)
    };
  }

  async function persist(final) {
    if (!editable || operationRef.current) return { success: false };
    const errors = validate(final);
    if (Object.keys(errors).length) return { success: false, validationErrors: errors };
    const operation = Symbol(final ? "submit" : "save");
    const context = contextKey;
    operationRef.current = operation;
    setPendingAction(final ? "submit" : "save");
    setError("");
    try {
      const payload = buildPayload(final);
      let result;
      if (role === "self") {
        result = final
          ? await submitQuestionnaire(accessToken, payload)
          : await saveQuestionnaireDraft(accessToken, payload);
      } else {
        result = await api(`/api/evaluations/${role}/${final ? "submit" : "save-draft"}`, "POST", payload);
      }
      if (contextRef.current !== context) return { success: false };
      if (final) {
        setAssessment(previous => ({ ...previous, submitted: true }));
        setOriginal({ responses, feedback, scope });
        return { success: true, message: result?.message || "Evaluation submitted successfully." };
      }
      try {
        const snapshot = await fetchAssessment();
        if (contextRef.current !== context) return { success: false };
        acceptSnapshot(snapshot);
        return { success: true, message: result?.message || "Draft saved successfully." };
      } catch {
        if (contextRef.current === context) {
          setOriginal({ responses, feedback, scope });
          setRequiresReload(true);
        }
        return { success: true, requiresReload: true };
      }
    } catch (error) {
      if (contextRef.current === context) {
        setError(error.message || "Unable to save evaluation.");
        if (error.status === 409) setRequiresReload(true);
      }
      throw error;
    } finally {
      if (operationRef.current === operation) {
        operationRef.current = null;
        setPendingAction(null);
      }
    }
  }

  return {
    assessment, questions, responses, feedback, scope, config, idKey,
    progress, loading, busy, submitted, editable, dirty, error,
    requiresReload, pendingAction, validationErrors,
    updateResponse, updateFeedback, updateScope, discardChanges,
    validate, reload, saveDraft: () => persist(false), submit: () => persist(true)
  };
}