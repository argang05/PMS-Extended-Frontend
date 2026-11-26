"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  normalizePotentialEvaluation, normalizePotentialResponses,
  buildPotentialEvaluationPayload, potentialResponsesChanged,
  getPotentialEvaluationProgress, getPotentialEvaluationState, getPotentialError
} from "@/lib/potential/evaluationUtils";

async function requestPotential(path, accessToken, method = "GET", body, signal) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const options = { method, headers, cache: "no-store", signal };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`/api/scoring/potential/${path}`, options);
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { data = { error: raw || "Invalid server response." }; }
  if (!response.ok) {
    const error = new Error(getPotentialError(data));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function usePotentialEvaluation(accessToken, assessmentId, evaluator) {
  const queryClient = useQueryClient();
  const [assessment, setAssessment] = useState(null);
  const [responses, setResponses] = useState({});
  const [originalResponses, setOriginalResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const operationRef = useRef(false);
  const requestVersion = useRef(0);
  const mountedRef = useRef(true);
  const contextRef = useRef("");
  const contextKey = `${assessmentId}:${evaluator}:${accessToken}`;
  contextRef.current = contextKey;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const acceptAssessment = useCallback(data => {
    const normalized = normalizePotentialEvaluation(data);
    if (!normalized.id) normalized.id = Number(assessmentId);
    const answers = normalizePotentialResponses(normalized, evaluator);
    setAssessment(normalized);
    setResponses(answers);
    setOriginalResponses(answers);
    setValidationErrors({});
    setConflict(false);
    setRequiresReload(false);
    return normalized;
  }, [assessmentId, evaluator]);

  const fetchAssessment = useCallback(async signal => {
    let data = await requestPotential(`evaluations/${assessmentId}`, accessToken, "GET", undefined, signal);
    const normalized = normalizePotentialEvaluation(data);
    if (normalized.requires_preparation) {
      await requestPotential(`evaluations/${assessmentId}/prepare`, accessToken, "POST", undefined, signal);
      data = await requestPotential(`evaluations/${assessmentId}`, accessToken, "GET", undefined, signal);
    }
    return data;
  }, [accessToken, assessmentId]);

  const loadAssessment = useCallback(async signal => {
    if (!accessToken || !assessmentId) return null;
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const data = await fetchAssessment(signal);
      if (signal?.aborted || version !== requestVersion.current || !mountedRef.current) return null;
      return acceptAssessment(data);
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError" || version !== requestVersion.current) return null;
      if (mountedRef.current) setError(error.message || "Unable to load Potential evaluation.");
      return null;
    } finally {
      if (mountedRef.current && !signal?.aborted && version === requestVersion.current) setLoading(false);
    }
  }, [accessToken, assessmentId, fetchAssessment, acceptAssessment]);

  useEffect(() => {
    const controller = new AbortController();
    setAssessment(null);
    setResponses({});
    setOriginalResponses({});
    setValidationErrors({});
    setConflict(false);
    setRequiresReload(false);
    loadAssessment(controller.signal);
    return () => {
      controller.abort();
      requestVersion.current++;
    };
  }, [loadAssessment]);

  const dirty = useMemo(() => potentialResponsesChanged(responses, originalResponses), [responses, originalResponses]);
  const state = useMemo(() => getPotentialEvaluationState(assessment, evaluator), [assessment, evaluator]);
  const progress = useMemo(() => getPotentialEvaluationProgress(assessment?.questions, responses), [assessment, responses]);
  const busy = Boolean(pendingAction);
  const editable = state.canEvaluate && !busy && !loading && !conflict && !requiresReload;

  useEffect(() => {
    if (!dirty && !busy) return;
    const handler = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, busy]);

  const updateResponse = useCallback((questionId, value) => {
    if (!editable || operationRef.current) return;
    setResponses(previous => ({ ...previous, [questionId]: value }));
    setValidationErrors(previous => {
      if (!previous[questionId]) return previous;
      const next = { ...previous };
      delete next[questionId];
      return next;
    });
  }, [editable]);

  const invalidateEvaluationQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["potential"] });
  };

  const execute = async submitting => {
    if (!editable || operationRef.current) return null;
    operationRef.current = true;
    setPendingAction(submitting ? "submit" : "save");
    setError("");
    const operationContext = contextKey;
    const isCurrent = () => mountedRef.current && contextRef.current === operationContext;
    try {
      const payload = buildPotentialEvaluationPayload(assessment, responses, submitting);
      if (!submitting && !payload.responses.length) throw new Error("Answer at least one question before saving a draft.");
      const path = submitting ? `evaluations/${assessmentId}/submit` : `${evaluator}/save`;
      const result = await requestPotential(path, accessToken, "POST", payload);
      if (!isCurrent()) return null;
      if (submitting) {
        setOriginalResponses(responses);
        setAssessment(previous => ({
          ...previous,
          is_submitted: true,
          can_evaluate: false,
          ...(evaluator === "rm" ? { rm_submitted: true } : { skip_submitted: true })
        }));
        await invalidateEvaluationQueries().catch(() => {});
        return { success: true, submitted: true, data: result };
      }
      try {
        const latest = await fetchAssessment();
        if (!isCurrent()) return null;
        acceptAssessment(latest);
        await invalidateEvaluationQueries().catch(() => {});
        return { success: true, submitted: false, data: result };
      } catch (refreshError) {
        if (!isCurrent()) return null;
        setRequiresReload(true);
        setOriginalResponses(responses);
        return { success: true, submitted: false, requiresReload: true, data: result };
      }
    } catch (error) {
      if (!isCurrent()) return null;
      if (error.status === 409) setConflict(true);
      setError(error.message || "Unable to complete Potential evaluation.");
      throw error;
    } finally {
      operationRef.current = false;
      if (isCurrent()) setPendingAction(null);
    }
  };

  const discardChanges = () => {
    if (busy || conflict || requiresReload) return;
    setResponses(originalResponses);
    setValidationErrors({});
    setError("");
  };

  return {
    assessment, responses, originalResponses, loading, busy, editable,
    error, conflict, requiresReload, dirty, progress, state,
    pendingAction, validationErrors, setValidationErrors,
    updateResponse, discardChanges,
    saveDraft: () => execute(false),
    submit: () => execute(true),
    reload: () => loadAssessment()
  };
}