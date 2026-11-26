"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createScoringAPI } from "@/lib/scoring/scoringConsoleUtils";
import {
  RESET_SCOPE, buildResetSelection, getResetSelectionKey,
  buildResetPreviewPath, normalizeResetPreview, normalizeResetExecution,
  synchronizePMSResetCache
} from "@/lib/reset/resetUtils";

export default function usePMSReset(accessToken, authorized) {
  const queryClient = useQueryClient();
  const api = useMemo(() => createScoringAPI(accessToken), [accessToken]);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [scope, setScope] = useState(RESET_SCOPE.CYCLE);
  const [reason, setReason] = useState("");
  const [cycles, setCycles] = useState([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [cyclesError, setCyclesError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [synchronizing, setSynchronizing] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState("");
  const [synchronizationError, setSynchronizationError] = useState("");
  const contextVersion = useRef(0);
  const selectionVersion = useRef(0);
  const cycleRequest = useRef(null);
  const previewRequest = useRef(null);
  const operationRef = useRef(null);
  const confirmationRef = useRef(null);
  const previewRef = useRef(null);
  const mountedRef = useRef(false);
  const busy = loadingPreview || executing || synchronizing;
  const locked = busy || Boolean(confirmation);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cycleRequest.current?.abort();
      previewRequest.current?.abort();
    };
  }, []);

  const loadCycles = useCallback(async () => {
    if (!accessToken || !authorized) return;
    cycleRequest.current?.abort();
    const controller = new AbortController();
    const version = contextVersion.current;
    cycleRequest.current = controller;
    setLoadingCycles(true);
    setCyclesError("");
    try {
      const data = await api("/api/admin/cycles/list", "GET", undefined, controller.signal);
      if (!Array.isArray(data?.results)) throw new Error("Invalid review cycle response.");
      if (!mountedRef.current || version !== contextVersion.current || cycleRequest.current !== controller) return;
      const rows = data.results;
      setCycles(rows);
      setCycleId(previous => rows.some(cycle => String(cycle.id) === previous)
        ? previous : String(rows.find(cycle => cycle.is_active)?.id || rows[0]?.id || ""));
    } catch (error) {
      if (error.name === "AbortError" || version !== contextVersion.current || cycleRequest.current !== controller) return;
      setCycles([]);
      setCycleId("");
      setCyclesError(error.message || "Unable to load review cycles.");
    } finally {
      if (mountedRef.current && version === contextVersion.current && cycleRequest.current === controller) {
        cycleRequest.current = null;
        setLoadingCycles(false);
      }
    }
  }, [accessToken, authorized, api]);

  useEffect(() => {
    contextVersion.current++;
    selectionVersion.current++;
    previewRequest.current?.abort();
    cycleRequest.current?.abort();
    previewRef.current = null;
    confirmationRef.current = null;
    setEmployeeNumber("");
    setCycleId("");
    setScope(RESET_SCOPE.CYCLE);
    setReason("");
    setCycles([]);
    setPreview(null);
    setConfirmation(null);
    setExecutionResult(null);
    setPreviewError("");
    setExecutionError("");
    setSynchronizationError("");
    setCyclesError("");
    setLoadingPreview(false);
    if (accessToken && authorized) loadCycles();
    else setLoadingCycles(false);
    return () => {
      contextVersion.current++;
      cycleRequest.current?.abort();
      previewRequest.current?.abort();
    };
  }, [accessToken, authorized, loadCycles]);

  function clearPreview() {
    selectionVersion.current++;
    previewRequest.current?.abort();
    previewRequest.current = null;
    previewRef.current = null;
    confirmationRef.current = null;
    setPreview(null);
    setConfirmation(null);
    setPreviewError("");
    setExecutionError("");
    setLoadingPreview(false);
  }

  function changeSelection(field, value) {
    if (operationRef.current || confirmationRef.current) return;
    clearPreview();
    if (field === "employeeNumber") setEmployeeNumber(value);
    else if (field === "cycleId") setCycleId(value);
    else if (field === "scope") setScope(value);
  }

  function changeReason(value) {
    if (operationRef.current || confirmationRef.current) return;
    setReason(value);
  }

  function currentSelection() {
    return buildResetSelection(employeeNumber, cycleId, scope);
  }

  function isActiveContext(version) {
    return mountedRef.current && version === contextVersion.current;
  }

  async function loadPreview() {
    if (!authorized || !accessToken || operationRef.current || confirmationRef.current || previewRequest.current) return;
    let selection;
    try {
      selection = currentSelection();
    } catch (error) {
      toast.error(error.message);
      return;
    }
    clearPreview();
    const version = contextVersion.current;
    const selectionRevision = selectionVersion.current;
    const controller = new AbortController();
    previewRequest.current = controller;
    setLoadingPreview(true);
    try {
      const response = await api(buildResetPreviewPath(selection), "GET", undefined, controller.signal);
      const data = normalizeResetPreview(response, selection);
      if (!isActiveContext(version) || selectionRevision !== selectionVersion.current || previewRequest.current !== controller) return;
      previewRef.current = data;
      setPreview(data);
      if (data.safe_to_reset) toast.success("Reset preview loaded successfully.");
      else toast.warning("No resettable PMS data was found.");
    } catch (error) {
      if (error.name === "AbortError" || !isActiveContext(version) || selectionRevision !== selectionVersion.current) return;
      setPreviewError(error.message || "Unable to load reset preview.");
      toast.error(error.message || "Unable to load reset preview.");
    } finally {
      if (isActiveContext(version) && previewRequest.current === controller) {
        previewRequest.current = null;
        setLoadingPreview(false);
      }
    }
  }

  function requestReset() {
    if (!authorized || !accessToken || operationRef.current || confirmationRef.current || previewRequest.current) return;
    const data = previewRef.current;
    if (!data?.safe_to_reset) return toast.error("Nothing is available to reset.");
    try {
      const selection = currentSelection();
      if (getResetSelectionKey(selection) !== data.selectionKey) {
        clearPreview();
        return toast.error("Selection has changed. Generate a new preview.");
      }
      const config = {
        preview: data,
        selection: { ...selection },
        reason: reason.trim() || "Admin reset via console",
        contextVersion: contextVersion.current,
        selectionVersion: selectionVersion.current
      };
      confirmationRef.current = config;
      setConfirmation(config);
    } catch (error) {
      toast.error(error.message);
    }
  }

  function cancelReset() {
    if (operationRef.current) return;
    confirmationRef.current = null;
    setConfirmation(null);
  }

  async function confirmReset() {
    const config = confirmationRef.current;
    if (!config || !authorized || !accessToken || operationRef.current) return;
    if (config.contextVersion !== contextVersion.current || config.selectionVersion !== selectionVersion.current || previewRef.current !== config.preview) {
      cancelReset();
      clearPreview();
      return toast.error("Reset preview has expired. Generate a new preview.");
    }
    const operation = Symbol("pms-reset");
    operationRef.current = operation;
    const version = contextVersion.current;
    setExecuting(true);
    setExecutionError("");
    setSynchronizationError("");
    setExecutionResult(null);
    let resetCommitted = false;
    let resetAttempted = false;
    try {
      await queryClient.cancelQueries();
      if (!isActiveContext(version)) return;
      resetAttempted = true;
      const response = await api("/api/admin/reset/execute", "POST", {
        ...config.selection,
        reason: config.reason
      });
      resetCommitted = true;
      const result = normalizeResetExecution(response, config.selection);
      if (isActiveContext(version)) {
        setExecutionResult(result);
        setPreview(null);
        previewRef.current = null;
        setEmployeeNumber("");
        setReason("");
        setCycleId(String(cycles.find(cycle => cycle.is_active)?.id || cycles[0]?.id || ""));
        setExecuting(false);
        setSynchronizing(true);
        toast.success(response.message || "PMS reset completed successfully.");
      }
      try {
        await synchronizePMSResetCache(queryClient);
      } catch (error) {
        if (isActiveContext(version)) {
          setSynchronizationError(error.message || "Unable to refresh PMS caches.");
          toast.warning("Reset completed, but some frontend data could not be refreshed.");
        }
      }
    } catch (error) {
      if (isActiveContext(version)) {
        setExecutionError(resetCommitted
          ? "The reset request succeeded, but its response could not be verified. Refresh the PMS state before attempting another reset."
          : error.message || "Unable to confirm whether the PMS reset completed.");
        setPreview(null);
        previewRef.current = null;
        toast.error(resetCommitted ? "Reset response could not be verified." : error.message || "Reset request failed.");
      }
      if (resetAttempted) {
        try {
          await synchronizePMSResetCache(queryClient);
        } catch (refreshError) {
          if (isActiveContext(version)) setSynchronizationError(refreshError.message || "Unable to refresh PMS data.");
        }
      }
    } finally {
      if (operationRef.current === operation) {
        operationRef.current = null;
        confirmationRef.current = null;
        if (mountedRef.current) {
          setExecuting(false);
          setSynchronizing(false);
          setConfirmation(null);
        }
      }
    }
  }

  async function retrySynchronization() {
    if (operationRef.current || confirmationRef.current) return;
    const operation = Symbol("pms-refresh");
    const version = contextVersion.current;
    operationRef.current = operation;
    setSynchronizing(true);
    setSynchronizationError("");
    try {
      await synchronizePMSResetCache(queryClient);
      if (isActiveContext(version)) toast.success("PMS data refreshed successfully.");
    } catch (error) {
      if (isActiveContext(version)) {
        setSynchronizationError(error.message || "Unable to refresh PMS data.");
        toast.error("PMS data refresh failed.");
      }
    } finally {
      if (operationRef.current === operation) {
        operationRef.current = null;
        if (mountedRef.current) setSynchronizing(false);
      }
    }
  }

  return {
    employeeNumber, cycleId, scope, reason, cycles, loadingCycles, cyclesError,
    preview, previewError, loadingPreview, confirmation, executing, synchronizing,
    executionResult, executionError, synchronizationError, busy, locked,
    changeSelection, changeReason, loadCycles, loadPreview, requestReset,
    cancelReset, confirmReset, retrySynchronization,
    dismissResult: () => setExecutionResult(null)
  };
}