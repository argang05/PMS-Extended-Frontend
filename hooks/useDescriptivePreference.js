"use client";
import { useCallback, useEffect, useRef, useState } from "react";

function getError(data, fallback) {
  if (Array.isArray(data?.error)) return data.error.join(", ");
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  return fallback;
}

export default function useDescriptivePreference(questionnaireId, accessToken) {
  const id = questionnaireId ? String(questionnaireId) : "";
  const activeId = useRef(id);
  const requestVersion = useRef(0);
  const savingRef = useRef(false);
  const [state, setState] = useState({
    id: "",
    data: null,
    loading: false,
    saving: false,
    error: null
  });

  activeId.current = id;

  const request = useCallback(async (targetId, method = "GET", enabled) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const options = { method, headers, cache: "no-store" };
    if (method === "PUT") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify({
        descriptive_scoring_enabled: enabled
      });
    }
    const response = await fetch(
      `/api/scoring/descriptive-preference/${targetId}`,
      options
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(getError(data, "Unable to process descriptive scoring preference."));
    }
    if (typeof data.descriptive_scoring_enabled !== "boolean") {
      throw new Error("Invalid descriptive scoring preference received.");
    }
    return data;
  }, [accessToken]);

  const refresh = useCallback(async () => {
    if (!id || !accessToken || savingRef.current) return null;
    const version = ++requestVersion.current;
    setState(previous => ({
      id,
      data: previous.id === id ? previous.data : null,
      loading: true,
      saving: false,
      error: null
    }));
    try {
      const data = await request(id);
      if (activeId.current === id && requestVersion.current === version) {
        setState({ id, data, loading: false, saving: false, error: null });
      }
      return data;
    } catch (error) {
      if (activeId.current === id && requestVersion.current === version) {
        setState({
          id,
          data: null,
          loading: false,
          saving: false,
          error: error.message
        });
      }
      return null;
    }
  }, [id, accessToken, request]);

  useEffect(() => {
    if (id && accessToken) refresh();
    else {
      requestVersion.current++;
      setState({
        id: "",
        data: null,
        loading: false,
        saving: false,
        error: null
      });
    }
    return () => { requestVersion.current++; };
  }, [id, accessToken, refresh]);

  const update = useCallback(async enabled => {
    if (!id || !accessToken) throw new Error("Select a questionnaire first.");
    if (savingRef.current) throw new Error("A preference update is already in progress.");
    savingRef.current = true;
    const version = ++requestVersion.current;
    setState(previous => ({
      ...previous,
      id,
      saving: true,
      error: null
    }));
    try {
      const data = await request(id, "PUT", Boolean(enabled));
      if (activeId.current === id && requestVersion.current === version) {
        setState({ id, data, loading: false, saving: false, error: null });
      }
      return data;
    } catch (error) {
      if (activeId.current === id && requestVersion.current === version) {
        setState(previous => ({
          ...previous,
          loading: false,
          saving: false,
          error: error.message
        }));
      }
      throw error;
    } finally {
      savingRef.current = false;
    }
  }, [id, accessToken, request]);

  const current = state.id === id;

  return {
    preference: current ? state.data : null,
    enabled: current && state.data?.descriptive_scoring_enabled === true,
    ready: current && !!state.data && !state.loading && !state.saving && !state.error,
    loading: !!id && (!current || state.loading),
    saving: current && state.saving,
    error: current ? state.error : null,
    refresh,
    update
  };
}