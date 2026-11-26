"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAuth } from "@/app/context/AuthContext";
import { toast } from "sonner";
import { Plus, RefreshCw, Copy, Trash2, ArrowUp, ArrowDown, Save, Search, RotateCcw, Eye, Lock, GripVertical, CheckCircle2, X, AlertCircle, Loader2 } from "lucide-react";

const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#F6490D]";
const primaryClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F6490D] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const dangerClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50";
const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const initialQuestion = { question_text: "", category_id: "", question_type: "objective", max_marks: "10", default_weightage: "1", target_mode: "manual", department: "", departments: [], employee_ids: [], excluded_employee_ids: [], is_active: true };
const emptyFilters = { cycle: "", employee: "", status: "" };
const same = (a, b) => String(a) === String(b);
const validDetails = data => data && typeof data === "object" && Array.isArray(data.questions) && Array.isArray(data.excluded_question_ids) && typeof data.is_editable === "boolean" && data.status !== undefined;
const validQuestion = q => q && q.id != null && typeof q.question_text === "string" && q.question_type && q.is_active !== undefined && q.target_mode !== undefined && q.default_weightage !== undefined && q.category !== undefined;
const orderedQuestionIds = data => [...(data?.questions || [])].sort((a, b) => Number(a.order) - Number(b.order)).map(q => q.item_id);
const weightageMap = data => Object.fromEntries((data?.questions || []).map(q => [q.item_id, String(q.weightage)]));
const countUpdate = (rows, id, count) => (rows || []).map(q => same(q.questionnaire_id, id) ? { ...q, question_count: count } : q);
const statusUpdate = (rows, id, data) => (rows || []).map(q => same(q.questionnaire_id, id) ? { ...q, status: data.status, is_editable: data.is_editable, self_review_submitted: data.self_review_submitted, edit_lock_message: data.edit_lock_message, question_count: data.questions?.length ?? q.question_count } : q);
const defaultLockMessage = "This employee has submitted their self-review. Questionnaire changes are locked for this review cycle. To make changes, request a PMS reset from the administrator and inform the employee.";

function getError(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  const entry = data && typeof data === "object" ? Object.entries(data).find(([key, value]) => !["results", "questionnaire"].includes(key) && value) : null;
  if (!entry) return fallback;
  const [key, value] = entry;
  return `${key}: ${Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : JSON.stringify(value)}`;
}

async function request(path, token, method = "GET", payload, signal) {
  const headers = { Authorization: `Bearer ${token}` };
  const options = { method, headers, cache: "no-store", signal };
  if (payload !== undefined) { headers["Content-Type"] = "application/json"; options.body = JSON.stringify(payload); }
  const response = await fetch(path, options);
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error("Unexpected response from the server."); }
  if (!response.ok) throw new Error(getError(data, `Request failed (${response.status}).`));
  return data;
}

function Section({ title, description, children, actions }) {
  return <section className={cardClass}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-semibold text-[#111827]">{title}</h2>{description && <p className="mt-1 text-sm text-gray-500">{description}</p>}</div>
      {actions}
    </div>
    <div className="mt-5">{children}</div>
  </section>;
}

function StatusBadge({ status, editable }) {
  return <div className="flex flex-wrap gap-2">
    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-700">{(status || "Unknown").replaceAll("_", " ")}</span>
    {typeof editable === "boolean" && <span className={`rounded-full px-3 py-1 text-xs font-medium ${editable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{editable ? "Editable" : "Editing Locked"}</span>}
  </div>;
}

function getCategoryTab(category, categoryType) {
  const name = String(typeof category === "object" ? category?.name || "" : category || "").toLowerCase();
  const type = String(categoryType || (typeof category === "object" ? category?.category_type : "") || "").toLowerCase();
  if (["behavioral", "behavioural"].includes(type) || ["behaviour", "behavior", "skillset"].some(v => name.includes(v))) return "behavioural";
  if (type === "performance" || name.includes("performance")) return "performance";
  return "other";
}

function temporaryItem(question, details) {
  return {
    item_id: `temporary-${question.id}`, question_id: question.id,
    question_text: question.question_text, category: question.category?.name || "",
    category_type: question.category?.category_type || "", question_type: question.question_type,
    max_marks: question.max_marks ?? 10, weightage: question.default_weightage ?? 1,
    source: "manual", order: Math.max(0, ...(details?.questions || []).map(q => Number(q.order) || 0)) + 1, pending: true
  };
}

export default function AdminQuestionnairesPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const questionKey = useMemo(() => ["admin-questions", accessToken], [accessToken]);
  const categoryKey = useMemo(() => ["admin-question-categories", accessToken], [accessToken]);
  const cycleKey = useMemo(() => ["admin-cycles", accessToken], [accessToken]);
  const listKey = useMemo(() => ["admin-questionnaires", accessToken], [accessToken]);
  const detailKey = useCallback(id => ["admin-questionnaire", accessToken, String(id)], [accessToken]);

  const [selectedId, setSelectedId] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createCycleId, setCreateCycleId] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [copySourceId, setCopySourceId] = useState("");
  const [weightages, setWeightages] = useState({});
  const [orderedItems, setOrderedItems] = useState([]);
  const [dragOver, setDragOver] = useState(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ ...initialQuestion });
  const [targetOptions, setTargetOptions] = useState({ departments: [], employees: [] });
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeDepartment, setEmployeeDepartment] = useState("");
  const [targetOptionsLoading, setTargetOptionsLoading] = useState(false);

  const dragRef = useRef(null);
  const busyRef = useRef(false);
  const selectedIdRef = useRef("");
  const draftWeightagesRef = useRef({});
  const syncedIdRef = useRef("");
  const targetRequestRef = useRef(0);
  const bankScrollRef = useRef(null);

  const api = useCallback((path, method = "GET", payload, signal) => request(path, accessToken, method, payload, signal), [accessToken]);
  selectedIdRef.current = selectedId;

  const questionQuery = useQuery({
    queryKey: questionKey,
    queryFn: async ({ signal }) => { const data = await api("/api/admin/questions", "GET", undefined, signal); if (!Array.isArray(data.results)) throw new Error("Invalid Question Bank response."); return data.results; },
    enabled: !!accessToken, staleTime: 300000
  });
  const categoryQuery = useQuery({
    queryKey: categoryKey,
    queryFn: async ({ signal }) => { const data = await api("/api/admin/question-categories", "GET", undefined, signal); if (!Array.isArray(data.results)) throw new Error("Invalid categories response."); return data.results; },
    enabled: !!accessToken, staleTime: 600000
  });
  const cycleQuery = useQuery({
    queryKey: cycleKey,
    queryFn: async ({ signal }) => { const data = await api("/api/admin/cycles", "GET", undefined, signal); if (!Array.isArray(data.results)) throw new Error("Invalid cycles response."); return data.results; },
    enabled: !!accessToken, staleTime: 600000
  });
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: async ({ signal }) => { const data = await api("/api/admin/questionnaires", "GET", undefined, signal); if (!Array.isArray(data.results)) throw new Error("Invalid questionnaires response."); return data.results; },
    enabled: !!accessToken, staleTime: 120000
  });
  const detailsQuery = useQuery({
    queryKey: detailKey(selectedId),
    queryFn: async ({ signal }) => {
      const data = await api(`/api/admin/questionnaires/${selectedId}`, "GET", undefined, signal);
      if (!validDetails(data)) throw new Error("Invalid questionnaire details response.");
      if (data.questionnaire_id != null && !same(data.questionnaire_id, selectedId)) throw new Error("Server returned details for a different questionnaire.");
      return data;
    },
    enabled: !!accessToken && !!selectedId, staleTime: 60000
  });

  const questions = questionQuery.data || [];
  const categories = categoryQuery.data || [];
  const cycles = cycleQuery.data || [];
  const allQuestionnaires = listQuery.data || [];
  const details = detailsQuery.data || null;
  const loading = listQuery.isPending;
  const referenceLoading = questionQuery.isPending;
  const detailsLoading = !!selectedId && detailsQuery.isPending;
  const editable = details?.is_editable === true;

  const questionnaires = useMemo(() => allQuestionnaires.filter(q => {
    if (appliedFilters.cycle && !same(q.review_cycle_id, appliedFilters.cycle)) return false;
    if (appliedFilters.employee && !String(q.employee_number || "").toLowerCase().includes(appliedFilters.employee)) return false;
    if (appliedFilters.status && q.status !== appliedFilters.status) return false;
    return true;
  }), [allQuestionnaires, appliedFilters]);

  const selectedSummary = useMemo(() => allQuestionnaires.find(q => same(q.questionnaire_id, selectedId)), [allQuestionnaires, selectedId]);
  const includedIds = useMemo(() => new Set((details?.questions || []).map(q => String(q.question_id))), [details]);
  const excludedIds = useMemo(() => new Set((details?.excluded_question_ids || []).map(String)), [details]);

  const allSortedQuestions = useMemo(() => {
    const items = [...(details?.questions || [])].sort((a, b) => Number(a.order) - Number(b.order));
    if (!items.length) return [];
    if (!orderDirty) return items;
    const lookup = new Map(items.map(item => [String(item.item_id), item]));
    const ordered = orderedItems.map(id => lookup.get(String(id))).filter(Boolean);
    const existingIds = new Set(ordered.map(item => String(item.item_id)));
    return [...ordered, ...items.filter(item => !existingIds.has(String(item.item_id)))];
  }, [details, orderedItems, orderDirty]);

  const sortedQuestions = useMemo(() => activeTab === "all" ? allSortedQuestions : allSortedQuestions.filter(q => getCategoryTab(q.category, q.category_type) === activeTab), [allSortedQuestions, activeTab]);

  const tabCounts = useMemo(() => ({
    all: allSortedQuestions.length,
    performance: allSortedQuestions.filter(q => getCategoryTab(q.category, q.category_type) === "performance").length,
    behavioural: allSortedQuestions.filter(q => getCategoryTab(q.category, q.category_type) === "behavioural").length
  }), [allSortedQuestions]);

  const bankQuestions = useMemo(() => {
    const term = questionSearch.trim().toLowerCase();
    return questions.filter(q => {
      if (!q.is_active || (activeTab !== "all" && getCategoryTab(q.category) !== activeTab)) return false;
      const assigned = includedIds.has(String(q.id)), excluded = excludedIds.has(String(q.id));
      if (term && !String(q.id).includes(term) && !String(q.question_text || "").toLowerCase().includes(term)) return false;
      if (typeFilter && q.question_type !== typeFilter) return false;
      if (targetFilter && q.target_mode !== targetFilter) return false;
      if (assignmentFilter === "assigned" && !assigned) return false;
      if (assignmentFilter === "available" && (assigned || excluded)) return false;
      if (assignmentFilter === "excluded" && !excluded) return false;
      return true;
    });
  }, [questions, includedIds, excludedIds, questionSearch, typeFilter, targetFilter, assignmentFilter, activeTab]);

  const bankVirtualizer = useVirtualizer({
    count: bankQuestions.length,
    getScrollElement: () => bankScrollRef.current,
    estimateSize: () => 205,
    overscan: 5,
    getItemKey: index => bankQuestions[index]?.id ?? index,
    measureElement: element => element?.getBoundingClientRect().height ?? 205
  });
  const virtualBankItems = bankVirtualizer.getVirtualItems();

  useEffect(() => {
    bankScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    bankVirtualizer.scrollToOffset(0);
  }, [questionSearch, typeFilter, assignmentFilter, targetFilter, activeTab, selectedId]);

  useEffect(() => {
    const id = String(selectedId || "");
    const selectionChanged = syncedIdRef.current !== id;
    if (selectionChanged) {
      syncedIdRef.current = id;
      draftWeightagesRef.current = {};
      setOrderDirty(false);
      setDragOver(null);
      setCopySourceId("");
    }
    if (!id || !details) {
      if (selectionChanged || !id) {
        setOrderedItems([]);
        setWeightages({});
      }
      return;
    }
    if (!selectionChanged && (busy || orderDirty)) return;
    const persisted = weightageMap(details);
    const drafts = Object.fromEntries(Object.entries(draftWeightagesRef.current).filter(([itemId]) => itemId in persisted));
    draftWeightagesRef.current = drafts;
    setOrderedItems(orderedQuestionIds(details));
    setWeightages({ ...persisted, ...drafts });
  }, [details, selectedId, busy, orderDirty]);

  useEffect(() => {
    const errors = [questionQuery.error, categoryQuery.error, cycleQuery.error, listQuery.error, detailsQuery.error].filter(Boolean);
    if (errors.length) toast.error(errors[0].message);
  }, [questionQuery.error, categoryQuery.error, cycleQuery.error, listQuery.error, detailsQuery.error]);

  useEffect(() => {
    if (!accessToken) {
      queryClient.removeQueries({ queryKey: ["admin-questionnaires"] });
      queryClient.removeQueries({ queryKey: ["admin-questionnaire"] });
      queryClient.removeQueries({ queryKey: ["admin-cycles"] });
      setSelectedId("");
    }
  }, [accessToken, queryClient]);

  const invalidate = useCallback((key, active = false) => queryClient.invalidateQueries({ queryKey: key, refetchType: active ? "active" : "none" }), [queryClient]);
  const loadQuestionnaires = useCallback(() => queryClient.refetchQueries({ queryKey: listKey, type: "active" }, { throwOnError: true }), [queryClient, listKey]);
  const refreshReferenceData = useCallback(() => Promise.all([
    queryClient.refetchQueries({ queryKey: questionKey, type: "active" }, { throwOnError: true }),
    queryClient.refetchQueries({ queryKey: categoryKey, type: "active" }, { throwOnError: true }),
    queryClient.refetchQueries({ queryKey: cycleKey, type: "active" }, { throwOnError: true })
  ]), [queryClient, questionKey, categoryKey, cycleKey]);

  const fetchAuthoritativeDetails = useCallback(async id => {
    const key = detailKey(id);
    await queryClient.cancelQueries({ queryKey: key, exact: true });
    const data = await api(`/api/admin/questionnaires/${id}`);
    if (!validDetails(data)) throw new Error("Server returned incomplete questionnaire details.");
    if (data.questionnaire_id != null && !same(data.questionnaire_id, id)) throw new Error("Server returned details for a different questionnaire.");
    queryClient.setQueryData(key, data);
    queryClient.setQueryData(listKey, rows => Array.isArray(rows) ? statusUpdate(rows, id, data) : rows);
    return data;
  }, [api, queryClient, detailKey, listKey]);

  const reconcileDetails = useCallback(async id => {
    try { return await fetchAuthoritativeDetails(id); }
    catch {
      await invalidate(detailKey(id));
      toast.warning("Change saved, but latest questionnaire details could not be loaded. Use Refresh to synchronize.");
      return null;
    }
  }, [fetchAuthoritativeDetails, invalidate, detailKey]);

  const reconcileList = useCallback(async () => {
    try { await loadQuestionnaires(); }
    catch { await invalidate(listKey); toast.warning("Change saved, but questionnaire list synchronization is pending."); }
  }, [loadQuestionnaires, invalidate, listKey]);

  async function beginWrite(id, optimistic) {
    busyRef.current = true; setBusy(true);
    const key = detailKey(id);
    await Promise.all([queryClient.cancelQueries({ queryKey: key, exact: true }), queryClient.cancelQueries({ queryKey: listKey, exact: true })]);
    const snapshot = queryClient.getQueryData(key);
    const listSnapshot = queryClient.getQueryData(listKey);
    if (optimistic && snapshot) {
      const next = optimistic(snapshot);
      queryClient.setQueryData(key, next);
      queryClient.setQueryData(listKey, rows => countUpdate(rows, id, next.questions?.length || 0));
    }
    return { snapshot, listSnapshot };
  }

  function rollbackWrite(id, saved) {
    if (saved?.snapshot) queryClient.setQueryData(detailKey(id), saved.snapshot);
    if (saved?.listSnapshot) queryClient.setQueryData(listKey, saved.listSnapshot);
    if (same(selectedIdRef.current, id)) {
      setOrderedItems(orderedQuestionIds(saved?.snapshot));
      setWeightages({ ...weightageMap(saved?.snapshot), ...draftWeightagesRef.current });
    }
  }

  function finishWrite() { busyRef.current = false; setBusy(false); setAddingId(null); }

  async function execute(path, method = "POST", payload, message, refreshList = false) {
    if (busyRef.current) return null;
    const id = selectedId;
    busyRef.current = true; setBusy(true);
    let committed = false;
    try {
      await Promise.all([queryClient.cancelQueries({ queryKey: detailKey(id), exact: true }), queryClient.cancelQueries({ queryKey: listKey, exact: true })]);
      const result = await api(path, method, payload);
      committed = true;
      toast.success(result.message || message || "Operation completed.");
      if (validDetails(result.questionnaire) && (result.questionnaire.questionnaire_id == null || same(result.questionnaire.questionnaire_id, id))) {
        queryClient.setQueryData(detailKey(id), result.questionnaire);
        queryClient.setQueryData(listKey, rows => statusUpdate(rows, id, result.questionnaire));
      } else if (id) await reconcileDetails(id);
      if (refreshList) await reconcileList();
      return result;
    } catch (error) {
      if (!committed) { toast.error(error.message); if (id) await reconcileDetails(id); }
      else toast.warning("Change saved, but synchronization is incomplete. Use Refresh to reload.");
      return null;
    } finally { finishWrite(); }
  }

  async function createQuestionnaire(event) {
    event.preventDefault();
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    if (busyRef.current) return;
    const employeeNumber = createEmployeeId.trim(), cycleId = Number(createCycleId);
    if (!employeeNumber || !Number.isInteger(cycleId) || cycleId <= 0) return toast.error("Enter a valid employee number and select a review cycle.");
    busyRef.current = true; setBusy(true);
    let committed = false;
    try {
      const result = await api("/api/admin/questionnaires", "POST", { employee_number: employeeNumber, cycle_id: cycleId });
      committed = true;
      const q = result.questionnaire;
      if (!q?.questionnaire_id) {
        await reconcileList();
        toast.warning("Questionnaire saved, but its identifier was not returned. Select it from the questionnaire list.");
        return;
      }
      const id = String(q.questionnaire_id), key = detailKey(id);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      let nextDetails = null;
      if (validDetails(q) && q.questions.length > 0) {
        nextDetails = q;
        queryClient.setQueryData(key, q);
        queryClient.setQueryData(listKey, rows => Array.isArray(rows) ? statusUpdate(rows, id, q) : rows);
        await reconcileList();
      } else {
        const results = await Promise.all([reconcileDetails(id), reconcileList()]);
        nextDetails = results[0];
      }
      if (!nextDetails) {
        queryClient.removeQueries({ queryKey: key, exact: true });
      }
      draftWeightagesRef.current = {};
      syncedIdRef.current = id;
      setOrderedItems(orderedQuestionIds(nextDetails));
      setWeightages(weightageMap(nextDetails));
      setOrderDirty(false);
      setDragOver(null);
      setCopySourceId("");
      setActiveTab("all");
      setSelectedId(id);
      toast.success(result.message || "Questionnaire created.");
    } catch (error) {
      if (committed) toast.warning("Questionnaire saved, but synchronization is incomplete. Use Refresh to reload.");
      else toast.error(error.message);
    } finally { finishWrite(); }
  }

  async function includeQuestion(question) {
    if (!editable || busyRef.current || !details) return;
    if (includedIds.has(String(question.id))) return toast.warning(`Question #${question.id} is already assigned to this employee.`);
    if (orderDirty) return toast.warning("Save or discard your question order changes before adding questions.");
    const id = selectedId, temp = temporaryItem(question, details);
    let saved, committed = false;
    setAddingId(question.id);
    try {
      saved = await beginWrite(id, previous => ({
        ...previous, questions: [...previous.questions, temp],
        excluded_question_ids: previous.excluded_question_ids.filter(q => !same(q, question.id))
      }));
      setOrderedItems(previous => [...previous, temp.item_id]);
      const result = await api(`/api/admin/questionnaires/${id}/include`, "POST", { question_id: question.id });
      committed = true;
      toast.success(result.message || "Question included.");
      if (result.item_id != null) {
        queryClient.setQueryData(detailKey(id), previous => ({
          ...previous,
          questions: previous.questions.map(q => same(q.item_id, temp.item_id) ? { ...q, item_id: result.item_id, pending: false } : q)
        }));
        setOrderedItems(previous => previous.map(value => same(value, temp.item_id) ? result.item_id : value));
      }
      await reconcileDetails(id);
    } catch (error) {
      if (!committed) { rollbackWrite(id, saved); toast.error(error.message); await reconcileDetails(id); }
    } finally { finishWrite(); }
  }

  function requestConfirmation(title, description, action, destructive = false) {
    setConfirmAction({ title, description, action, destructive });
  }

  function excludeQuestion(item) {
    if (!editable) return;
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    const id = selectedId;
    const draftWarning = details?.has_draft_responses
      ? " IMPORTANT: If the employee has saved an answer to this question, that draft answer will be permanently deleted."
      : "";
    requestConfirmation("Exclude Question", `Remove question #${item.question_id} from this employee's questionnaire? The question will remain available in the Question Bank.${draftWarning}`, async () => {
      if (busyRef.current) return;
      let saved, committed = false;
      try {
        saved = await beginWrite(id, previous => ({
          ...previous,
          questions: previous.questions.filter(q => !same(q.question_id, item.question_id)),
          excluded_question_ids: [...new Set([...previous.excluded_question_ids, item.question_id])]
        }));
        setOrderedItems(previous => previous.filter(value => !same(value, item.item_id)));
        const result = await api(`/api/admin/questionnaires/${id}/exclude`, "POST", { question_id: item.question_id });
        committed = true;
        delete draftWeightagesRef.current[item.item_id];
        setWeightages(previous => { const next = { ...previous }; delete next[item.item_id]; return next; });
        toast.success(result.message || "Question excluded.");
        await reconcileDetails(id);
      } catch (error) {
        if (!committed) { rollbackWrite(id, saved); toast.error(error.message); await reconcileDetails(id); }
      } finally { finishWrite(); }
    }, true);
  }

  async function updateWeightage(itemId) {
    if (!editable) return;
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    if (busyRef.current) return;
    const item = details?.questions?.find(q => same(q.item_id, itemId));
    const weightage = Number(weightages[itemId] ?? item?.weightage);
    if (!Number.isFinite(weightage) || weightage <= 0) return toast.error("Weightage must be greater than zero.");
    if (String(itemId).startsWith("temporary-")) return toast.warning("Wait until the question has been saved.");
    const id = selectedId;
    let saved, committed = false;
    try {
      saved = await beginWrite(id, previous => ({
        ...previous, questions: previous.questions.map(q => same(q.item_id, itemId) ? { ...q, weightage } : q)
      }));
      const result = await api(`/api/admin/questionnaires/${id}/items/${itemId}/weightage`, "PUT", { weightage });
      committed = true;
      toast.success(result.message || "Weightage updated.");
      if (result.weightage != null && Number.isFinite(Number(result.weightage))) {
        queryClient.setQueryData(detailKey(id), previous => previous ? {
          ...previous, questions: previous.questions.map(q => same(q.item_id, itemId) ? { ...q, weightage: result.weightage } : q)
        } : previous);
        delete draftWeightagesRef.current[itemId];
        setWeightages(previous => ({ ...previous, [itemId]: String(result.weightage) }));
      } else {
        delete draftWeightagesRef.current[itemId];
        await reconcileDetails(id);
      }
    } catch (error) {
      if (!committed) { rollbackWrite(id, saved); toast.error(error.message); await reconcileDetails(id); }
    } finally { finishWrite(); }
  }

  function reorder(from, to) {
    if (!editable || busyRef.current || from === to || from < 0 || to < 0 || from >= sortedQuestions.length || to >= sortedQuestions.length) return;
    const sourceId = sortedQuestions[from].item_id, targetId = sortedQuestions[to].item_id;
    const next = allSortedQuestions.map(q => q.item_id);
    const sourceIndex = next.findIndex(id => same(id, sourceId));
    if (sourceIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    const targetIndex = next.findIndex(id => same(id, targetId));
    if (targetIndex < 0) return;
    next.splice(from < to ? targetIndex + 1 : targetIndex, 0, moved);
    setOrderedItems(next);
    setOrderDirty(true);
  }

  async function saveOrder() {
    if (!editable) return;
    if (!orderDirty) return toast.info("Question order has not changed.");
    if (busyRef.current) return;
    const nextOrder = allSortedQuestions.map(q => q.item_id);
    if (nextOrder.some(id => String(id).startsWith("temporary-"))) return toast.warning("Wait for pending questions to finish saving.");
    const id = selectedId;
    let saved, committed = false;
    try {
      saved = await beginWrite(id, previous => ({
        ...previous,
        questions: previous.questions.map(q => ({ ...q, order: nextOrder.findIndex(value => same(value, q.item_id)) + 1 }))
      }));
      const result = await api(`/api/admin/questionnaires/${id}/reorder`, "POST", { item_ids: nextOrder });
      committed = true;
      setOrderDirty(false);
      toast.success(result.message || "Question order updated.");
      await reconcileDetails(id);
    } catch (error) {
      if (!committed) {
        rollbackWrite(id, saved);
        setOrderDirty(false);
        toast.error(error.message);
        await reconcileDetails(id);
      }
    } finally { finishWrite(); }
  }

  function discardOrder() { setOrderedItems(orderedQuestionIds(details)); setOrderDirty(false); }

  function generateQuestions() {
    if (!editable) return;
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    const warning = details?.has_draft_responses
      ? " Questions removed by synchronization will also lose their saved draft answers."
      : "";
    requestConfirmation("Generate / Synchronize Questions", `Synchronize this questionnaire using the configured Question Bank targeting rules? Question Bank Only items are not automatically assigned.${warning}`, async () => {
      await execute(`/api/admin/questionnaires/${selectedId}/generate`, "POST", undefined, "Questions generated.", true);
    }, !!details?.has_draft_responses);
  }

  function resetQuestionnaire() {
    if (!editable) return;
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    const warning = details?.has_draft_responses
      ? " IMPORTANT: This will permanently delete the employee's existing saved draft answers because the assigned questionnaire items are recreated."
      : "";
    requestConfirmation("Reset Questionnaire Customizations", `Remove manual assignments, exclusions, custom weightages and ordering, then restore Question Bank defaults? This is NOT a full PMS reset.${warning} This action cannot be undone.`, async () => {
      await execute(`/api/admin/questionnaires/${selectedId}/reset`, "POST", undefined, "Questionnaire customizations reset.", true);
    }, true);
  }

  function copyQuestionnaire() {
    if (!editable) return;
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    const source = Number(copySourceId), destination = Number(selectedId);
    if (!Number.isInteger(source) || source <= 0) return toast.error("Select a source questionnaire.");
    if (source === destination) return toast.error("Source and destination must be different.");
    const warning = details?.has_draft_responses
      ? " IMPORTANT: Existing saved draft answers in the destination questionnaire will be permanently deleted."
      : "";
    requestConfirmation("Copy Questionnaire Configuration", `Replace the destination questionnaire's assigned questions, weightages and ordering with the source configuration?${warning}`, async () => {
      await execute(`/api/admin/questionnaires/${destination}/copy`, "POST", { source_id: source }, "Questionnaire configuration copied.", true);
    }, true);
  }

  function beginDrag(event, type, id) {
    if (!editable || busyRef.current) { event.preventDefault(); return; }
    dragRef.current = { type, id };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${type}:${id}`);
  }

  function getDrag(event) {
    if (dragRef.current) return dragRef.current;
    const [type, id] = event.dataTransfer.getData("text/plain").split(":");
    if (!["bank", "assigned"].includes(type) || !id) return null;
    return { type, id };
  }

  function dropOnAssigned(event, index) {
    event.preventDefault(); event.stopPropagation();
    const dragged = getDrag(event);
    dragRef.current = null; setDragOver(null);
    if (!dragged || !editable || busyRef.current) return;
    if (dragged.type === "bank") {
      const question = questions.find(q => same(q.id, dragged.id));
      if (question) includeQuestion(question);
      return;
    }
    reorder(sortedQuestions.findIndex(q => same(q.item_id, dragged.id)), index);
  }

  function dropAtEnd(event) {
    event.preventDefault(); event.stopPropagation();
    const dragged = getDrag(event);
    dragRef.current = null; setDragOver(null);
    if (!dragged || !editable || busyRef.current) return;
    if (dragged.type === "bank") {
      const question = questions.find(q => same(q.id, dragged.id));
      if (question) includeQuestion(question);
      return;
    }
    reorder(sortedQuestions.findIndex(q => same(q.item_id, dragged.id)), sortedQuestions.length - 1);
  }

  async function refreshAll() {
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try {
      const id = selectedId;
      const results = await Promise.allSettled([
        loadQuestionnaires(),
        refreshReferenceData(),
        id ? fetchAuthoritativeDetails(id) : Promise.resolve()
      ]);
      if (results.some(result => result.status === "rejected")) toast.error("Some data could not be refreshed.");
      else toast.success("Refresh completed.");
    } finally { finishWrite(); }
  }

  async function openCreateQuestion() {
    if (!editable || busyRef.current) return;
    if (orderDirty) return toast.warning("Save or discard your question order changes first.");
    try {
      await queryClient.ensureQueryData({
        queryKey: categoryKey,
        queryFn: async () => { const data = await api("/api/admin/question-categories"); if (!Array.isArray(data.results)) throw new Error("Invalid categories response."); return data.results; },
        staleTime: 600000
      });
      setNewQuestion({ ...initialQuestion });
      setEmployeeSearch(""); setEmployeeDepartment("");
      setTargetOptions({ departments: [], employees: [] });
      setShowCreateQuestion(true);
    } catch (error) { toast.error(error.message); }
  }

  const loadTargetOptions = useCallback(async (search = "", department = "") => {
    if (!accessToken) return;
    const requestId = ++targetRequestRef.current;
    setTargetOptionsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (department) params.set("department", department);
      const data = await api(`/api/admin/questions/targeting-options${params.size ? `?${params}` : ""}`);
      if (requestId !== targetRequestRef.current) return;
      setTargetOptions({ departments: Array.isArray(data.departments) ? data.departments : [], employees: Array.isArray(data.employees) ? data.employees : [] });
    } catch (error) { if (requestId === targetRequestRef.current) toast.error(error.message); }
    finally { if (requestId === targetRequestRef.current) setTargetOptionsLoading(false); }
  }, [accessToken, api]);

  useEffect(() => {
    if (!showCreateQuestion || !["departments", "employees", "combined"].includes(newQuestion.target_mode)) return;
    const timer = setTimeout(() => loadTargetOptions(employeeSearch, employeeDepartment), 300);
    return () => { clearTimeout(timer); targetRequestRef.current++; };
  }, [showCreateQuestion, newQuestion.target_mode, employeeSearch, employeeDepartment, loadTargetOptions]);

  function changeTargetMode(mode) {
    setNewQuestion(previous => ({ ...previous, target_mode: mode, department: "", departments: [], employee_ids: [], excluded_employee_ids: [] }));
  }

  function toggleDepartment(department) {
    setNewQuestion(previous => ({ ...previous, departments: previous.departments.includes(department) ? previous.departments.filter(v => v !== department) : [...previous.departments, department] }));
  }

  function toggleEmployee(employeeId) {
    setNewQuestion(previous => ({ ...previous, employee_ids: previous.employee_ids.includes(employeeId) ? previous.employee_ids.filter(v => v !== employeeId) : [...previous.employee_ids, employeeId] }));
  }

  async function createNewQuestion(event) {
    event.preventDefault();
    if (!editable || busyRef.current) return;
    const text = newQuestion.question_text.trim();
    const categoryId = Number(newQuestion.category_id), weightage = Number(newQuestion.default_weightage), maxMarks = Number(newQuestion.max_marks);
    if (!text || !Number.isInteger(categoryId) || categoryId <= 0) return toast.error("Enter question text and select a category.");
    if (!Number.isFinite(weightage) || weightage <= 0) return toast.error("Weightage must be greater than zero.");
    if (!Number.isInteger(maxMarks) || maxMarks <= 0) return toast.error("Maximum marks must be a positive integer.");
    const mode = newQuestion.target_mode;
    if (mode === "departments" && !newQuestion.departments.length) return toast.error("Select at least one department.");
    if (mode === "employees" && !newQuestion.employee_ids.length) return toast.error("Select at least one employee.");
    if (mode === "combined" && !newQuestion.departments.length && !newQuestion.employee_ids.length) return toast.error("Select at least one department or employee.");
    busyRef.current = true; setBusy(true);
    try {
      const result = await api("/api/admin/questions", "POST", {
        question_text: text, category_id: categoryId, question_type: newQuestion.question_type,
        max_marks: maxMarks, default_weightage: weightage, target_mode: mode,
        department: mode === "legacy" ? newQuestion.department.trim() || null : null,
        departments: ["departments", "combined"].includes(mode) ? newQuestion.departments : [],
        employee_ids: ["employees", "combined"].includes(mode) ? newQuestion.employee_ids : [],
        excluded_employee_ids: [], is_active: true
      });
      const created = validQuestion(result.question) ? result.question : validQuestion(result) ? result : null;
      const questionId = result.id || result.question?.id;
      toast.success("Question created successfully.");
      setShowCreateQuestion(false); setNewQuestion({ ...initialQuestion });
      if (created) {
        queryClient.setQueryData(questionKey, previous => Array.isArray(previous) ? [created, ...previous.filter(q => !same(q.id, created.id))] : previous);
        if (!Array.isArray(queryClient.getQueryData(questionKey))) await invalidate(questionKey, true);
      } else await invalidate(questionKey, true);
      if (mode !== "manual" && selectedId) {
        await reconcileDetails(selectedId);
        await reconcileList();
      }
      if (questionId) toast.info(mode === "manual"
        ? `Question #${questionId} is available in the Question Bank. Click Add or drag it to assign it.`
        : `Question #${questionId} created with ${mode} targeting.`);
    } catch (error) { toast.error(error.message); }
    finally { finishWrite(); }
  }

  function changeWeightage(itemId, value) {
    draftWeightagesRef.current[itemId] = value;
    setWeightages(previous => ({ ...previous, [itemId]: value }));
  }

  function applyFilters() {
    setAppliedFilters({ cycle: cycleFilter, employee: employeeFilter.trim().toLowerCase(), status: statusFilter });
  }

  return <div className="space-y-8">
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight text-[#111827]">Questionnaire Builder</h1>
          <p className="mt-2 text-sm text-gray-600">Create, customize and reorder employee-specific performance questionnaires until the employee submits their self-review.</p>
        </div>
        <button type="button" onClick={refreshAll} disabled={busy || orderDirty} className={secondaryClass}><RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Refresh</button>
      </div>
    </section>

    <Section title="Create Employee Questionnaire" description="Create a questionnaire for an employee and review cycle.">
      <form onSubmit={createQuestionnaire} className="grid gap-4 md:grid-cols-3">
        <div><label className="mb-2 block text-sm font-medium">Employee Number</label>
          <input type="text" maxLength={50} required value={createEmployeeId} onChange={e => setCreateEmployeeId(e.target.value)} placeholder="Enter employee number" className={inputClass} />
        </div>
        <div><label className="mb-2 block text-sm font-medium">Review Cycle</label>
          <select required value={createCycleId} onChange={e => setCreateCycleId(e.target.value)} className={inputClass}>
            <option value="">Select review cycle</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_active ? " (Active)" : ""}</option>)}
          </select>
        </div>
        <div className="flex items-end"><button type="submit" disabled={busy || orderDirty} className={`${primaryClass} w-full`}><Plus size={16} /> Create Questionnaire</button></div>
      </form>
    </Section>

    <Section title="Employee Questionnaires" description="Filter questionnaires and select one to configure." actions={<span className="text-sm text-gray-500">{questionnaires.length} records</span>}>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value)} className={inputClass}>
          <option value="">All Cycles</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="text" maxLength={50} value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} placeholder="Employee Number" className={inputClass} onKeyDown={e => { if (e.key === "Enter") applyFilters(); }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputClass}>
          <option value="">All Statuses</option>
          {["draft", "self_submitted", "under_rm_review", "rm_reviewed", "under_skip_review", "skip_reviewed", "under_peer_review", "completed"].map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
        </select>
        <button type="button" onClick={applyFilters} className={secondaryClass}><Search size={16} /> Apply Filters</button>
      </div>
      {loading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" /> Loading questionnaires...</div>
        : listQuery.isError && !allQuestionnaires.length ? <div className="rounded-xl bg-red-50 p-5 text-sm text-red-700">Failed to load questionnaires. <button type="button" onClick={() => listQuery.refetch()} className="ml-3 font-semibold underline">Retry</button></div>
        : questionnaires.length === 0 ? <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No questionnaires found.</p>
        : <div className="max-h-[450px] space-y-3 overflow-y-auto">
          {questionnaires.map(item => {
            const selected = same(item.questionnaire_id, selectedId);
            return <div key={item.questionnaire_id} className={`rounded-2xl border p-4 transition ${selected ? "border-[#F6490D] bg-orange-50" : "border-gray-200 bg-[#FCFCFD]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="font-semibold text-[#111827]">{item.employee_name} ({item.employee_number})</p>
                  <p className="text-xs text-gray-500">{item.department || "No Department"} · {item.review_cycle}</p>
                  <p className="text-xs text-gray-500">Questionnaire #{item.questionnaire_id} · {item.question_count} questions</p>
                  <StatusBadge status={item.status} editable={item.is_editable} />
                </div>
                <button type="button" disabled={busy} onClick={() => {
                  if (orderDirty) return toast.warning("Save or discard your question order changes first.");
                  if (busyRef.current) return;
                  const id = String(item.questionnaire_id);
                  if (same(id, selectedId)) return;
                  const cached = queryClient.getQueryData(detailKey(id));
                  draftWeightagesRef.current = {};
                  syncedIdRef.current = id;
                  setOrderedItems(orderedQuestionIds(cached));
                  setWeightages(weightageMap(cached));
                  setOrderDirty(false);
                  setDragOver(null);
                  setCopySourceId("");
                  setSelectedId(id);
                }} className={selected ? primaryClass : secondaryClass}><Eye size={16} /> {selected ? "Selected" : "Manage"}</button>
              </div>
            </div>;
          })}
        </div>}
    </Section>

    {selectedId && <>
      <Section title="Selected Questionnaire" description={`Questionnaire #${selectedId}`} actions={<StatusBadge status={details?.status} editable={details?.is_editable} />}>
        {detailsLoading || !details ? <div className="flex items-center gap-2 text-sm text-gray-500">
          {detailsQuery.isError ? <AlertCircle size={17} className="text-red-600" /> : <Loader2 size={17} className="animate-spin" />}
          {detailsQuery.isError ? "Failed to load questionnaire details." : "Loading questionnaire details..."}
          {detailsQuery.isError && <button type="button" onClick={() => detailsQuery.refetch()} className="font-semibold text-[#F6490D] underline">Retry</button>}
        </div> : <div className="space-y-5">
          <div className="grid gap-4 rounded-2xl bg-gray-50 p-4 text-sm md:grid-cols-3">
            <p><strong>Employee:</strong> {selectedSummary?.employee_name || details.employee_id}</p>
            <p><strong>Cycle:</strong> {selectedSummary?.review_cycle || details.review_cycle_id}</p>
            <p><strong>Questions:</strong> {details.questions?.length || 0}</p>
          </div>
          {!editable && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <Lock size={18} className="mt-0.5 shrink-0" />
            <div><p className="font-semibold">Questionnaire Editing Locked</p>
              <p className="mt-1">{details.edit_lock_message || defaultLockMessage}</p>
            </div>
          </div>}
          {editable && details.has_draft_responses && <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>The employee has saved draft responses. You can continue editing, but excluding questions, resetting customizations or replacing the questionnaire may permanently delete affected draft answers.</p>
          </div>}
          {orderDirty && <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800"><AlertCircle size={17} /> Question order has unsaved changes.</div>}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={!editable || busy || orderDirty} onClick={generateQuestions} className={secondaryClass}><RefreshCw size={16} /> Generate / Sync</button>
            <button type="button" disabled={!editable || busy || orderDirty} onClick={resetQuestionnaire} className={dangerClass}><RotateCcw size={16} /> Reset Customizations</button>
          </div>
        </div>}
      </Section>

      {details && !detailsLoading && <>
        <div className="rounded-[24px] bg-white p-3 shadow-[0_8px_25px_rgba(0,0,0,0.06)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[{ id: "all", label: "All Questions" }, { id: "performance", label: "Performance Parameters" }, { id: "behavioural", label: "Skillset & Behavioural Parameters" }].map(tab =>
              <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setDragOver(null); }}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-150 ${activeTab === tab.id ? "bg-[#F6490D] text-white shadow-sm" : "bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-[#F6490D]"}`}>
                {tab.label}<span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-white text-gray-500"}`}>{tabCounts[tab.id]}</span>
              </button>)}
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Section title="Assigned Questions" description="Drag questions to reorder. Drag Question Bank questions here to assign them."
            actions={<span className="rounded-full bg-[#FFF1EC] px-3 py-1 text-xs font-semibold text-[#F6490D]">{sortedQuestions.length} assigned</span>}>
            <div className={`space-y-3 rounded-2xl border-2 border-dashed p-3 ${dragOver === "end" ? "border-[#F6490D] bg-orange-50" : "border-transparent"}`}
              onDragOver={e => { if (!editable || busy) return; e.preventDefault(); setDragOver("end"); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }} onDrop={dropAtEnd}>
              {sortedQuestions.length === 0 && <div className="rounded-xl bg-gray-50 p-8 text-center text-sm text-gray-500">No questions assigned in this category. Generate questions or drag one from the Question Bank.</div>}
              {sortedQuestions.map((item, index) => <div key={item.item_id} draggable={editable && !busy && !item.pending}
                onDragStart={e => beginDrag(e, "assigned", item.item_id)}
                onDragEnd={() => { dragRef.current = null; setDragOver(null); }}
                onDragOver={e => { if (!editable || busy) return; e.preventDefault(); e.stopPropagation(); setDragOver(String(item.item_id)); }}
                onDrop={e => { e.stopPropagation(); dropOnAssigned(e, index); }}
                className={`rounded-2xl border bg-[#FCFCFD] p-4 ${dragOver === String(item.item_id) ? "border-[#F6490D] bg-orange-50" : "border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  <GripVertical size={19} className={`mt-1 ${editable ? "cursor-grab text-gray-400" : "text-gray-200"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-[#FFF1EC] px-2 py-1 text-[#F6490D]">#{index + 1}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">{item.category}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{item.question_type}</span>
                      <span className="rounded-full bg-purple-50 px-2 py-1 text-purple-700">{item.pending ? "Saving..." : item.source}</span>
                    </div>
                    <p className="text-sm font-medium leading-6 text-[#111827]">{item.question_text}</p>
                    <p className="mt-2 text-xs text-gray-500">Question #{item.question_id} · Max Marks: {item.max_marks} · {item.category_type}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-200 pt-3">
                  <div className="w-24"><label className="mb-1 block text-xs text-gray-600">Weightage</label>
                    <input type="number" min="0.01" step="any" disabled={!editable || busy || item.pending} value={weightages[item.item_id] ?? String(item.weightage ?? "")}
                      onChange={e => changeWeightage(item.item_id, e.target.value)} className={inputClass} />
                  </div>
                  <button type="button" disabled={!editable || busy || item.pending || orderDirty} onClick={() => updateWeightage(item.item_id)} className={secondaryClass} title="Save weightage"><Save size={15} /></button>
                  <button type="button" disabled={!editable || busy || item.pending || index === 0} onClick={() => reorder(index, index - 1)} className={secondaryClass} title="Move up"><ArrowUp size={15} /></button>
                  <button type="button" disabled={!editable || busy || item.pending || index === sortedQuestions.length - 1} onClick={() => reorder(index, index + 1)} className={secondaryClass} title="Move down"><ArrowDown size={15} /></button>
                  <button type="button" disabled={!editable || busy || item.pending || orderDirty} onClick={() => excludeQuestion(item)} className={dangerClass}><Trash2 size={15} /> Exclude</button>
                </div>
              </div>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!editable || busy || !orderDirty} onClick={saveOrder} className={primaryClass}><Save size={16} /> Save Question Order</button>
              {orderDirty && <button type="button" disabled={busy} onClick={discardOrder} className={secondaryClass}><X size={16} /> Discard Changes</button>}
            </div>
          </Section>

          <Section title="Available Question Bank" description="Search, filter and assign active questions."
            actions={<button type="button" disabled={!editable || busy || orderDirty} onClick={openCreateQuestion} className={primaryClass}><Plus size={16} /> Create Question</button>}>
            <div className="space-y-3">
              <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} placeholder="Search by question ID or text" className={`${inputClass} pl-9`} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={inputClass}>
                  <option value="">All Types</option><option value="objective">Objective</option><option value="descriptive">Descriptive</option>
                </select>
                <select value={targetFilter} onChange={e => setTargetFilter(e.target.value)} className={inputClass}>
                  <option value="">All Targeting Modes</option><option value="manual">Question Bank Only</option><option value="legacy">Legacy</option>
                  <option value="all">All Employees</option><option value="departments">Departments</option><option value="employees">Employees</option><option value="combined">Combined</option>
                </select>
                <select value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value)} className={inputClass}>
                  <option value="all">All Active</option><option value="available">Not Assigned</option><option value="assigned">Already Assigned</option><option value="excluded">Explicitly Excluded</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">
                {referenceLoading ? "Loading Question Bank..." : `${bankQuestions.length} matching questions. Drag to the left or click Add.`}
                {questionQuery.isFetching && !referenceLoading && <span className="ml-2 text-gray-400">Syncing...</span>}
              </p>
            </div>

            <div ref={bankScrollRef} className="mt-4 max-h-[780px] overflow-y-auto pr-1" style={{ height: referenceLoading || !bankQuestions.length ? "auto" : 780 }}>
              {referenceLoading ? <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 p-8 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" /> Loading questions...</div>
                : bankQuestions.length === 0 ? <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No matching questions found.</p>
                : <div style={{ height: `${bankVirtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}>
                  {virtualBankItems.map(virtualRow => {
                    const question = bankQuestions[virtualRow.index];
                    if (!question) return null;
                    const assigned = includedIds.has(String(question.id)), excluded = excludedIds.has(String(question.id));
                    return <div key={virtualRow.key} data-index={virtualRow.index} ref={bankVirtualizer.measureElement}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)`, paddingBottom: 12 }}>
                      <div draggable={editable && !busy && !assigned}
                        onDragStart={e => beginDrag(e, "bank", question.id)}
                        onDragEnd={() => { dragRef.current = null; setDragOver(null); }}
                        className={`rounded-2xl border p-4 ${assigned ? "border-emerald-200 bg-emerald-50/40" : excluded ? "border-amber-200 bg-amber-50/40" : "border-gray-200 bg-[#FCFCFD]"}`}>
                        <div className="flex items-start gap-3">
                          <GripVertical size={18} className={`mt-1 shrink-0 ${assigned ? "text-gray-300" : "text-gray-400"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-6 text-[#111827]">#{question.id} · {question.question_text}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span className="rounded-full bg-white px-2 py-1">{question.category?.name || "Uncategorized"}</span>
                              <span className="rounded-full bg-white px-2 py-1">{question.question_type}</span>
                              <span className="rounded-full bg-white px-2 py-1">Weight: {question.default_weightage}</span>
                              <span className={`rounded-full px-2 py-1 ${question.target_mode === "manual" ? "bg-amber-100 font-medium text-amber-800" : "bg-white"}`}>
                                {question.target_mode === "manual" ? "Question Bank Only" : `Target: ${question.target_mode}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          {assigned ? <button type="button" onClick={() => toast.warning(`Question #${question.id} is already assigned to this employee.`)}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800"><CheckCircle2 size={15} /> Already Assigned</button>
                            : <button type="button" disabled={!editable || busy || orderDirty} onClick={() => includeQuestion(question)} className={excluded ? dangerClass : secondaryClass}>
                              {addingId === question.id ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                              {addingId === question.id ? "Adding..." : excluded ? "Re-include Question" : "Add Question"}
                            </button>}
                        </div>
                      </div>
                    </div>;
                  })}
                </div>}
            </div>
          </Section>
        </div>

        <Section title="Copy Questionnaire Configuration" description="Copy assigned questions, ordering and weightages from another questionnaire in the same cycle.">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1"><label className="mb-2 block text-sm font-medium">Source Questionnaire</label>
              <select value={copySourceId} onChange={e => setCopySourceId(e.target.value)} disabled={!editable || busy || orderDirty} className={inputClass}>
                <option value="">Select source questionnaire</option>
                {allQuestionnaires.filter(q => !same(q.questionnaire_id, selectedId) && same(q.review_cycle_id, details.review_cycle_id)).map(q =>
                  <option key={q.questionnaire_id} value={q.questionnaire_id}>#{q.questionnaire_id} — {q.employee_name} ({q.review_cycle})</option>)}
              </select>
            </div>
            <button type="button" disabled={!editable || busy || orderDirty || !copySourceId} onClick={copyQuestionnaire} className={secondaryClass}><Copy size={16} /> Copy Configuration</button>
          </div>
        </Section>
      </>}
    </>}

    {confirmAction && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${confirmAction.destructive ? "bg-red-50 text-red-600" : "bg-orange-50 text-[#F6490D]"}`}><AlertCircle size={24} /></div>
        <h3 id="confirm-title" className="text-xl font-semibold text-[#111827]">{confirmAction.title}</h3>
        <p className="mt-3 text-sm leading-6 text-gray-600">{confirmAction.description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setConfirmAction(null)} className={secondaryClass}>Cancel</button>
          <button type="button" disabled={busy} onClick={async () => { const action = confirmAction.action; setConfirmAction(null); await action(); }}
            className={confirmAction.destructive ? dangerClass : primaryClass}>{confirmAction.destructive ? "Confirm" : "Continue"}</button>
        </div>
      </div>
    </div>}

    {showCreateQuestion && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-question-title" className="my-auto w-full max-w-xl rounded-[24px] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div><h3 id="create-question-title" className="text-xl font-semibold text-[#111827]">Create New Question</h3>
            <p className="mt-1 text-sm text-gray-500">Add a question to the existing Question Bank.</p></div>
          <button type="button" disabled={busy} onClick={() => setShowCreateQuestion(false)} className={secondaryClass}><X size={18} /></button>
        </div>
        <form onSubmit={createNewQuestion} className="space-y-4">
          <div><label className="mb-2 block text-sm font-medium">Question Text</label>
            <textarea required rows={4} value={newQuestion.question_text} onChange={e => setNewQuestion(p => ({ ...p, question_text: e.target.value }))} className={inputClass} placeholder="Enter question text..." />
          </div>
          <div><label className="mb-2 block text-sm font-medium">Question Category</label>
            <select required value={newQuestion.category_id} onChange={e => setNewQuestion(p => ({ ...p, category_id: e.target.value }))} className={inputClass}>
              <option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium">Question Type</label>
              <select value={newQuestion.question_type} onChange={e => setNewQuestion(p => ({ ...p, question_type: e.target.value }))} className={inputClass}>
                <option value="objective">Objective</option><option value="descriptive">Descriptive</option>
              </select>
            </div>
            <div><label className="mb-2 block text-sm font-medium">Targeting Mode</label>
              <select value={newQuestion.target_mode} onChange={e => changeTargetMode(e.target.value)} className={inputClass}>
                <option value="manual">Question Bank Only (Assign Later)</option><option value="all">All Employees</option>
                <option value="legacy">Legacy</option><option value="departments">Selected Departments</option>
                <option value="employees">Selected Employees</option><option value="combined">Departments and Employees</option>
              </select>
            </div>
            <div><label className="mb-2 block text-sm font-medium">Default Weightage</label>
              <input type="number" required min="0.01" step="any" value={newQuestion.default_weightage} onChange={e => setNewQuestion(p => ({ ...p, default_weightage: e.target.value }))} className={inputClass} />
            </div>
            <div><label className="mb-2 block text-sm font-medium">Maximum Marks</label>
              <input type="number" required min="1" step="1" value={newQuestion.max_marks} onChange={e => setNewQuestion(p => ({ ...p, max_marks: e.target.value }))} className={inputClass} />
            </div>
          </div>
          {newQuestion.target_mode === "manual" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
            This question will be saved in the Question Bank without automatic employee assignment. After creating it, use <strong>Add Question</strong> or drag-and-drop to assign it to this employee.
          </div>}
          {newQuestion.target_mode === "legacy" && <div><label className="mb-2 block text-sm font-medium">Legacy Department (Optional)</label>
            <input type="text" value={newQuestion.department} onChange={e => setNewQuestion(p => ({ ...p, department: e.target.value }))} className={inputClass} placeholder="Enter department" />
          </div>}
          {["departments", "combined"].includes(newQuestion.target_mode) && <div>
            <label className="mb-2 block text-sm font-medium">Select Departments</label>
            {targetOptionsLoading && <p className="mb-2 text-xs text-gray-500">Loading departments...</p>}
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-3">
              {targetOptions.departments.length === 0 ? <p className="text-sm text-gray-500">No departments available.</p>
                : targetOptions.departments.map(department => <label key={department} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={newQuestion.departments.includes(department)} onChange={() => toggleDepartment(department)} /><span>{department}</span>
                </label>)}
            </div>
            <p className="mt-1 text-xs text-gray-500">{newQuestion.departments.length} departments selected</p>
          </div>}
          {["employees", "combined"].includes(newQuestion.target_mode) && <div className="space-y-3">
            <label className="block text-sm font-medium">Select Employees</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <input type="text" value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)} placeholder="Search employee name or number" className={inputClass} />
              <select value={employeeDepartment} onChange={e => setEmployeeDepartment(e.target.value)} className={inputClass}>
                <option value="">All Departments</option>{targetOptions.departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {targetOptionsLoading && <p className="text-xs text-gray-500">Loading employees...</p>}
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gray-200 p-3">
              {targetOptions.employees.length === 0 ? <p className="text-sm text-gray-500">No matching employees found.</p>
                : targetOptions.employees.map(employee => <label key={employee.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={newQuestion.employee_ids.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} />
                  <span>{employee.full_name} ({employee.employee_number}) — {employee.department || "No Department"}</span>
                </label>)}
            </div>
            <p className="text-xs text-gray-500">{newQuestion.employee_ids.length} employees selected. Search results show up to 100 employees.</p>
          </div>}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button type="button" disabled={busy} onClick={() => setShowCreateQuestion(false)} className={secondaryClass}>Cancel</button>
            <button type="submit" disabled={busy} className={primaryClass}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create Question
            </button>
          </div>
        </form>
      </div>
    </div>}
  </div>;
}