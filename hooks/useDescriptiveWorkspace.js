"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createDescriptiveAPI, requiresInvalidationConfirmation, isDescriptiveConflict } from "@/lib/descriptive/descriptiveAPI";
import {
  normalizeQuestionnaireList, normalizePreference, normalizePerformanceWorkspace,
  normalizePotentialWorkspace, createDescriptiveDrafts, isDescriptiveDraftChanged,
  buildDescriptiveScorePayload, getDescriptiveProgress, findCorrespondingQuestionnaire,
  getDependencyLabels, DESCRIPTIVE_MODES
} from "@/lib/descriptive/descriptiveUtils";

const emptyFilters = { cycle_id: "", employee_id: "", status: "" };
const emptyQuestionFilters = { evaluator: "", scoring: "", search: "" };

export function useDescriptiveWorkspace(accessToken, isAdmin) {
  const queryClient = useQueryClient();
  const api = useMemo(() => createDescriptiveAPI(accessToken), [accessToken]);
  const [mode, setMode] = useState("performance");
  const [initialized, setInitialized] = useState(false);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [questionFilters, setQuestionFilters] = useState(emptyQuestionFilters);
  const [workspace, setWorkspace] = useState(null);
  const [preference, setPreference] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [originalDrafts, setOriginalDrafts] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loadingList, setLoadingList] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingPreference, setLoadingPreference] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [preferenceError, setPreferenceError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [requiresReload, setRequiresReload] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const listVersion = useRef(0);
  const workspaceVersion = useRef(0);
  const historyVersion = useRef(0);
  const operationRef = useRef(false);
  const confirmationRef = useRef(null);
  const confirmingRef = useRef(false);
  const pendingMatchRef = useRef(null);
  const activeRef = useRef({ mode: "performance", id: "" });
  const mountedRef = useRef(true);

  const questions = useMemo(() => workspace?.questions || [], [workspace]);
  const changedQuestions = useMemo(() => questions.filter(question =>
    isDescriptiveDraftChanged(drafts[question.key], originalDrafts[question.key])
  ), [questions, drafts, originalDrafts]);
  const changedKeys = useMemo(() => new Set(changedQuestions.map(question => question.key)), [changedQuestions]);
  const progress = useMemo(() => getDescriptiveProgress(questions), [questions]);
  const dirty = changedQuestions.length > 0;
  const scoringEnabled = preference?.enabled === true && !preferenceError && !loadingPreference;
  const operationLocked = busy || loadingWorkspace || loadingPreference || Boolean(confirmation) || confirmationLoading;
  const controlsLocked = operationLocked || !scoringEnabled || conflict || requiresReload || Boolean(workspaceError);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      listVersion.current++;
      workspaceVersion.current++;
      historyVersion.current++;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialMode = params.get("type") === "potential" ? "potential" : "performance";
    const rawId = params.get(initialMode === "potential" ? "assessment_id" : "questionnaire_id");
    const id = rawId && /^\d+$/.test(rawId) && Number(rawId) > 0 ? rawId : "";
    activeRef.current = { mode: initialMode, id };
    setMode(initialMode);
    setSelectedId(id);
    setInitialized(true);
  }, []);

  const updateURL = useCallback((targetMode, id) => {
    const url = new URL(window.location.href);
    url.searchParams.set("type", targetMode);
    url.searchParams.delete("questionnaire_id");
    url.searchParams.delete("assessment_id");
    if (id) url.searchParams.set(targetMode === "potential" ? "assessment_id" : "questionnaire_id", id);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const clearWorkspace = useCallback(() => {
    setWorkspace(null);
    setPreference(null);
    setDrafts({});
    setOriginalDrafts({});
    setWorkspaceError("");
    setPreferenceError("");
    setConflict(false);
    setRequiresReload(false);
    setExpanded({});
    setHistory([]);
    setHistoryOpen(false);
    setHistoryError("");
    setHistoryLoading(false);
    historyVersion.current++;
  }, []);

  const applySelection = useCallback((id, record = null, targetMode = activeRef.current.mode) => {
    const normalizedId = String(id || "");
    workspaceVersion.current++;
    activeRef.current = { mode: targetMode, id: normalizedId };
    clearWorkspace();
    setSelectedId(normalizedId);
    setSelectedRecord(record);
    setQuestionFilters(emptyQuestionFilters);
    setLoadingPreference(Boolean(normalizedId));
    setLoadingWorkspace(Boolean(normalizedId));
    updateURL(targetMode, normalizedId);
  }, [clearWorkspace, updateURL]);

  const acceptWorkspace = useCallback((normalized, preserveDrafts = false, savedKeys = []) => {
    const values = createDescriptiveDrafts(normalized.questions);
    const saved = new Set(savedKeys);
    setWorkspace(normalized);
    setPreference(normalized.preference);
    setOriginalDrafts(previousOriginal => {
      setDrafts(previousDrafts => {
        if (!preserveDrafts) return values;
        const next = { ...values };
        normalized.questions.forEach(question => {
          const key = question.key;
          if (!saved.has(key) && isDescriptiveDraftChanged(previousDrafts[key], previousOriginal[key])) {
            next[key] = previousDrafts[key];
          }
        });
        return next;
      });
      return values;
    });
    setWorkspaceError("");
    setPreferenceError("");
    setConflict(false);
    setRequiresReload(false);
  }, []);

  const loadQuestionnaires = useCallback(async (signal) => {
    if (!accessToken || !isAdmin || !initialized) return;
    const targetMode = mode;
    const version = ++listVersion.current;
    const current = () => mountedRef.current && !signal?.aborted && version === listVersion.current && activeRef.current.mode === targetMode;
    setLoadingList(true);
    setListError("");
    try {
      const raw = await api[targetMode].getQuestionnaires(appliedFilters, signal);
      if (!current()) return;
      const items = normalizeQuestionnaireList(raw, targetMode);
      setQuestionnaires(items);
      if (pendingMatchRef.current) {
        const previous = pendingMatchRef.current;
        pendingMatchRef.current = null;
        const match = findCorrespondingQuestionnaire(items, previous, targetMode);
        if (match) applySelection(match.id, match, targetMode);
        else toast.info(`No corresponding ${DESCRIPTIVE_MODES[targetMode]} questionnaire was found.`);
      } else {
        const selected = items.find(item => item.id === activeRef.current.id);
        if (selected) setSelectedRecord(selected);
      }
    } catch (error) {
      if (!current() || error.name === "AbortError") return;
      setListError(error.message);
      toast.error(error.message);
    } finally {
      if (current()) setLoadingList(false);
    }
  }, [accessToken, isAdmin, initialized, mode, api, appliedFilters, applySelection]);

  const loadWorkspace = useCallback(async (id, targetMode, options = {}) => {
    if (!id || !accessToken || !isAdmin) return null;
    const { signal, preserveDrafts = false, savedKeys = [] } = options;
    const version = ++workspaceVersion.current;
    const current = () => mountedRef.current && !signal?.aborted &&
      version === workspaceVersion.current && activeRef.current.mode === targetMode && activeRef.current.id === String(id);
    setLoadingPreference(true);
    setLoadingWorkspace(true);
    setPreferenceError("");
    setWorkspaceError("");
    try {
      let normalized;
      if (targetMode === "potential") {
        const data = await api.potential.getWorkspace(id, signal);
        if (!current()) return null;
        normalized = normalizePotentialWorkspace(data);
        setLoadingPreference(false);
      } else {
        let pref;
        try {
          pref = normalizePreference(await api.performance.getPreference(id, signal), "performance");
        } catch (error) {
          if (current()) {
            setPreference(null);
            setPreferenceError(error.message);
          }
          throw error;
        }
        if (!current()) return null;
        setPreference(pref);
        setLoadingPreference(false);
        if (!pref.enabled) {
          normalized = {
            mode: "performance", id: String(id), questionnaire_id: String(id),
            preference: pref, questions: [], readiness: null
          };
        } else {
          const data = await api.performance.getWorkspace(id, signal);
          if (!current()) return null;
          normalized = normalizePerformanceWorkspace(data, pref, id);
        }
      }
      if (!current()) return null;
      acceptWorkspace(normalized, preserveDrafts, savedKeys);
      return normalized;
    } catch (error) {
      if (!current() || error.name === "AbortError") return null;
      setWorkspaceError(error.message);
      if (targetMode === "potential") setPreferenceError(error.message);
      return null;
    } finally {
      if (current()) {
        setLoadingPreference(false);
        setLoadingWorkspace(false);
      }
    }
  }, [accessToken, isAdmin, api, acceptWorkspace]);

  useEffect(() => {
    if (!initialized || !accessToken || !isAdmin) return;
    const controller = new AbortController();
    loadQuestionnaires(controller.signal);
    return () => {
      controller.abort();
      listVersion.current++;
    };
  }, [initialized, accessToken, isAdmin, loadQuestionnaires]);

  useEffect(() => {
    if (!initialized || !accessToken || !isAdmin || !selectedId) {
      setLoadingPreference(false);
      setLoadingWorkspace(false);
      return;
    }
    const controller = new AbortController();
    loadWorkspace(selectedId, mode, { signal: controller.signal });
    return () => {
      controller.abort();
      workspaceVersion.current++;
    };
  }, [initialized, accessToken, isAdmin, selectedId, mode, loadWorkspace]);

  useEffect(() => {
    if (!dirty && !busy) return;
    const handler = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, busy]);

  function openConfirmation(config) {
    if (confirmationRef.current || confirmingRef.current || operationRef.current) return;
    const value = { ...config, mode: activeRef.current.mode, id: activeRef.current.id };
    confirmationRef.current = value;
    setConfirmation(value);
  }

  function closeConfirmation() {
    if (confirmingRef.current) return;
    confirmationRef.current = null;
    setConfirmation(null);
  }

  async function handleConfirmation() {
    const config = confirmationRef.current;
    if (!config || confirmingRef.current || operationRef.current) return;
    if (config.mode !== activeRef.current.mode || config.id !== activeRef.current.id) {
      closeConfirmation();
      return toast.error("Questionnaire selection has changed.");
    }
    confirmingRef.current = true;
    setConfirmationLoading(true);
    confirmationRef.current = null;
    setConfirmation(null);
    try { await config.action(); }
    catch (error) { toast.error(error.message || "Unable to complete operation."); }
    finally {
      confirmingRef.current = false;
      setConfirmationLoading(false);
    }
  }

  function guardUnsaved(action, title = "Discard Unsaved Changes?", description) {
    if (operationLocked || operationRef.current || confirmationRef.current) return;
    if (!dirty) return action();
    openConfirmation({
      title,
      description: description || `You have unsaved changes across ${changedQuestions.length} descriptive question(s). Continuing will discard these changes. Previously saved scores will not be affected.`,
      confirmText: "Discard & Continue",
      cancelText: "Keep Editing",
      variant: "warning",
      action
    });
  }

  function selectQuestionnaire(id) {
    const targetId = String(id);
    if (targetId === selectedId) return;
    const record = questionnaires.find(item => item.id === targetId) || null;
    guardUnsaved(() => applySelection(targetId, record, mode));
  }

  function switchMode(targetMode) {
    if (!DESCRIPTIVE_MODES[targetMode] || targetMode === mode) return;
    guardUnsaved(() => {
      const previous = selectedRecord || (workspace ? {
        questionnaire_id: workspace.questionnaire_id,
        employee_id: String(workspace.employee?.id ?? ""),
        review_cycle_id: String(workspace.review_cycle_id ?? "")
      } : null);
      pendingMatchRef.current = previous;
      listVersion.current++;
      setQuestionnaires([]);
      setListError("");
      setLoadingList(true);
      setFilters(emptyFilters);
      setAppliedFilters(emptyFilters);
      applySelection("", null, targetMode);
      setMode(targetMode);
    }, `Switch to ${DESCRIPTIVE_MODES[targetMode]} Scoring?`);
  }

  function applyFilters() {
    if (operationLocked || operationRef.current) return;
    setAppliedFilters({ ...filters });
  }

  function refreshWorkspace() {
    if (!selectedId) return;
    guardUnsaved(async () => {
      const result = await loadWorkspace(selectedId, mode);
      if (result) toast.success("Latest descriptive workspace loaded.");
      else toast.error("Unable to refresh descriptive workspace.");
    }, "Refresh Descriptive Responses?");
  }

  function updateDraft(key, field, value) {
    if (controlsLocked || operationRef.current || confirmationRef.current) return;
    const question = questions.find(item => item.key === key);
    if (!question?.can_score) return;
    setDrafts(previous => ({
      ...previous,
      [key]: { ...previous[key], [field]: value }
    }));
  }

  function discardDrafts() {
    guardUnsaved(() => setDrafts(originalDrafts));
  }

  async function invalidateQueries(targetMode) {
    const roots = targetMode === "potential"
      ? [["potential"], ["scoring"], ["analytics"]]
      : [["scoring"], ["analytics"], ["evaluations"], ["questionnaires"]];
    await Promise.allSettled(roots.map(queryKey => queryClient.invalidateQueries({ queryKey })));
  }

  async function executeMutation(config, confirmed = false) {
    if (operationRef.current || !config.id) return;
    if (activeRef.current.mode !== config.mode || activeRef.current.id !== config.id) return toast.error("Questionnaire selection has changed.");
    operationRef.current = true;
    setBusy(true);
    setPendingAction(config.action);
    let confirmationConfig = null;
    const current = () => mountedRef.current && activeRef.current.mode === config.mode && activeRef.current.id === config.id;
    try {
      let result;
      if (config.mode === "potential") {
        if (!config.revision) throw new Error("Assessment revision is unavailable. Refresh before continuing.");
        result = config.action === "clear"
          ? await api.potential.clearScores(config.id, config.itemIds, config.revision, confirmed)
          : await api.potential.saveScores(config.id, config.scores, config.revision, confirmed);
      } else {
        const latestPreference = normalizePreference(await api.performance.getPreference(config.id), "performance");
        if (!current()) return;
        setPreference(latestPreference);
        if (!latestPreference.enabled) throw new Error("Performance descriptive scoring has been disabled.");
        result = await api.performance.saveScores(config.id, config.scores);
      }
      if (!current()) return;
      let refreshed = null;
      if (config.mode === "potential" && result.workspace) {
        try {
          refreshed = normalizePotentialWorkspace(result.workspace);
          acceptWorkspace(refreshed, true, config.keys);
        } catch {
          refreshed = null;
        }
      }
      if (!refreshed) refreshed = await loadWorkspace(config.id, config.mode, { preserveDrafts: true, savedKeys: config.keys });
      if (!current()) return;
      if (!refreshed) {
        setRequiresReload(true);
        toast.warning("Changes were saved, but the latest workspace could not be loaded. Refresh before continuing.");
      } else {
        toast.success(result.message || "Descriptive scores saved successfully.");
      }
      if (result.invalidation?.invalidated) toast.info("Dependent scoring results were invalidated and must be recalculated.");
      setHistory([]);
      setHistoryOpen(false);
      historyVersion.current++;
      await invalidateQueries(config.mode);
    } catch (error) {
      if (!current()) return;
      if (config.mode === "potential" && requiresInvalidationConfirmation(error) && !confirmed) {
        const labels = getDependencyLabels(error.data?.dependent_results);
        confirmationConfig = {
          title: "Invalidate Existing Scoring Results?",
          description: `This change affects previously calculated Potential-dependent results.${labels.length ? `\n\nAffected results:\n${labels.join("\n")}` : ""}\n\nAffected results will require recalculation. Performance and PPI scores will remain unchanged.`,
          confirmText: "Confirm & Continue",
          cancelText: "Cancel",
          variant: "warning",
          action: () => executeMutation(config, true)
        };
      } else if (config.mode === "potential" && isDescriptiveConflict(error)) {
        setConflict(true);
        toast.error("Descriptive scoring data has changed. Your drafts are preserved. Refresh before saving again.");
      } else {
        toast.error(error.message || "Unable to save descriptive scores.");
      }
    } finally {
      operationRef.current = false;
      if (current()) {
        setBusy(false);
        setPendingAction("");
      }
    }
    if (confirmationConfig && current()) {
      const value = { ...confirmationConfig, mode: config.mode, id: config.id };
      confirmationRef.current = value;
      setConfirmation(value);
    }
  }

  function saveQuestions(targetQuestions, bulk = false) {
    if (controlsLocked || operationRef.current || confirmationRef.current || !targetQuestions.length) return;
    try {
      const scores = buildDescriptiveScorePayload(mode, targetQuestions, drafts);
      if (!scores.length) return toast.info("No changes to save.");
      const config = {
        action: "save", mode, id: selectedId,
        revision: preference?.revision,
        scores, keys: targetQuestions.map(question => question.key)
      };
      if (bulk) {
        openConfirmation({
          title: "Save Consolidated Scores?",
          description: `Save consolidated scores for ${targetQuestions.length} ${DESCRIPTIVE_MODES[mode]} descriptive question(s)?`,
          confirmText: "Save All Scores",
          cancelText: "Cancel",
          variant: "info",
          action: () => executeMutation(config)
        });
      } else executeMutation(config);
    } catch (error) { toast.error(error.message); }
  }

  function clearQuestionScores(question) {
    if (mode !== "potential" || controlsLocked || !question.has_saved_marks || !question.can_score) return;
    openConfirmation({
      title: "Clear Saved Descriptive Score?",
      description: "The saved marks and remarks for this question will be removed from all applicable manager responses. The original written evaluations will remain unchanged.",
      confirmText: "Clear Score",
      cancelText: "Cancel",
      variant: "warning",
      action: () => executeMutation({
        action: "clear", mode, id: selectedId,
        revision: preference?.revision,
        itemIds: [question.questionnaire_item_id],
        keys: [question.key]
      })
    });
  }

  async function loadHistory() {
    if (mode !== "potential" || !selectedId || historyLoading) return;
    const id = selectedId;
    const version = ++historyVersion.current;
    const current = () => mountedRef.current && version === historyVersion.current && activeRef.current.mode === "potential" && activeRef.current.id === id;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const data = await api.potential.getHistory(id);
      if (current()) setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
      if (current()) setHistoryError(error.message);
    } finally {
      if (current()) setHistoryLoading(false);
    }
  }

  return {
    mode, initialized, questionnaires, selectedId, selectedRecord,
    filters, setFilters, questionFilters, setQuestionFilters,
    workspace, preference, questions, drafts, expanded, setExpanded,
    changedQuestions, changedKeys, progress, dirty, scoringEnabled,
    loadingList, loadingWorkspace, loadingPreference, busy,
    listError, workspaceError, preferenceError, conflict, requiresReload,
    operationLocked, controlsLocked, pendingAction,
    confirmation, confirmationLoading, handleConfirmation, closeConfirmation,
    history, historyOpen, setHistoryOpen, historyLoading, historyError, loadHistory,
    switchMode, selectQuestionnaire, applyFilters, refreshWorkspace,
    refreshQuestionnaires: () => loadQuestionnaires(),
    updateDraft, discardDrafts, clearQuestionScores,
    saveQuestion: question => saveQuestions([question]),
    saveAll: () => saveQuestions(changedQuestions, true),
    guardUnsaved
  };
}