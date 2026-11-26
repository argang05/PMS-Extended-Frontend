"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createScoringAPI, getPreferencePath, getPreferencePayload,
  normalizeScoringPreference, getPreferenceReadiness, getPotentialCalculationReadiness
} from "@/lib/scoring/scoringConsoleUtils";

const emptyState = () => ({ data: null, loading: false, saving: false, error: "" });
const initialStates = () => ({ performance: emptyState(), potential: emptyState() });

export default function useScoringPreferences(accessToken, questionnaireId, assessmentId) {
  const api = useMemo(() => createScoringAPI(accessToken), [accessToken]);
  const contextKey = `${questionnaireId || ""}:${assessmentId || ""}:${accessToken || ""}`;
  const ids = useMemo(() => ({ performance: questionnaireId, potential: assessmentId }), [questionnaireId, assessmentId]);
  const [store, setStore] = useState(() => ({ contextKey: null, states: initialStates() }));
  const versionRef = useRef(0);
  const contextRef = useRef(null);
  const controllersRef = useRef({});
  const operationsRef = useRef({});

  const updateState = useCallback((type, changes, version) => {
    if (version !== versionRef.current) return;
    setStore(previous => {
      if (previous.contextKey !== contextKey || version !== versionRef.current) return previous;
      return {
        ...previous,
        states: {
          ...previous.states,
          [type]: { ...previous.states[type], ...changes }
        }
      };
    });
  }, [contextKey]);

  const loadPreference = useCallback(async (type, version = versionRef.current) => {
    const id = ids[type];
    if (!id || !accessToken || version !== versionRef.current || contextRef.current !== contextKey) return null;
    if (operationsRef.current[type]) return null;
    controllersRef.current[type]?.abort();
    const controller = new AbortController();
    controllersRef.current[type] = controller;
    updateState(type, { loading: true, error: "" }, version);
    try {
      const response = await api(getPreferencePath(type, id), "GET", undefined, controller.signal);
      const preference = normalizeScoringPreference(type, response);
      if (version !== versionRef.current || controllersRef.current[type] !== controller) return null;
      updateState(type, { data: preference, error: "" }, version);
      return preference;
    } catch (error) {
      if (error.name !== "AbortError" && version === versionRef.current && controllersRef.current[type] === controller) {
        updateState(type, { data: null, error: error.message || "Unable to load preference." }, version);
      }
      return null;
    } finally {
      if (controllersRef.current[type] === controller) {
        delete controllersRef.current[type];
        updateState(type, { loading: false }, version);
      }
    }
  }, [ids, accessToken, contextKey, api, updateState]);

  useEffect(() => {
    const version = ++versionRef.current;
    contextRef.current = contextKey;
    operationsRef.current = {};
    setStore({ contextKey, states: initialStates() });
    if (accessToken && questionnaireId) loadPreference("performance", version);
    if (accessToken && assessmentId) loadPreference("potential", version);
    return () => {
      versionRef.current++;
      contextRef.current = null;
      Object.values(controllersRef.current).forEach(controller => controller.abort());
      controllersRef.current = {};
      operationsRef.current = {};
    };
  }, [contextKey, accessToken, questionnaireId, assessmentId, loadPreference]);

  const savePreference = useCallback(async (type, enabled, confirmed = false) => {
    const id = ids[type];
    if (!id || !accessToken) throw new Error("No assessment selected.");
    if (typeof enabled !== "boolean") throw new Error("Invalid scoring preference.");
    if (contextRef.current !== contextKey) throw new Error("Employee selection has changed.");
    if (operationsRef.current[type]) throw new Error("A preference update is already in progress.");
    const version = versionRef.current;
    const operation = Symbol(type);
    operationsRef.current[type] = operation;
    controllersRef.current[type]?.abort();
    delete controllersRef.current[type];
    updateState(type, { saving: true, loading: false, error: "" }, version);
    try {
      const response = await api(getPreferencePath(type, id), "PUT", getPreferencePayload(type, enabled, confirmed));
      if (version !== versionRef.current || contextRef.current !== contextKey) return { stale: true };
      const preference = normalizeScoringPreference(type, response);
      updateState(type, { data: preference, error: "" }, version);
      return {
        stale: false, preference,
        changed: response.changed === true,
        invalidation: response.invalidation || null,
        message: response.message
      };
    } catch (error) {
      if (version !== versionRef.current || contextRef.current !== contextKey) return { stale: true };
      throw error;
    } finally {
      if (operationsRef.current[type] === operation) {
        delete operationsRef.current[type];
        updateState(type, { saving: false }, version);
      }
    }
  }, [ids, accessToken, contextKey, api, updateState]);

  const refreshPreference = useCallback(type => {
    if (operationsRef.current[type] || contextRef.current !== contextKey) return Promise.resolve(null);
    return loadPreference(type);
  }, [loadPreference, contextKey]);

  const refreshAllPreferences = useCallback(() => Promise.allSettled([
    refreshPreference("performance"), refreshPreference("potential")
  ]), [refreshPreference]);

  const currentStates = store.contextKey === contextKey ? store.states : initialStates();
  return {
    performance: currentStates.performance,
    potential: currentStates.potential,
    performanceReady: getPreferenceReadiness(currentStates.performance),
    potentialReady: getPreferenceReadiness(currentStates.potential),
    potentialCalculationReady: getPotentialCalculationReadiness(currentStates.potential),
    saving: currentStates.performance.saving || currentStates.potential.saving,
    savePreference, refreshPreference, refreshAllPreferences
  };
}