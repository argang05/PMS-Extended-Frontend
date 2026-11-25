"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/context/AuthContext";
import { toast } from "sonner";
import QuestionFormModal from "@/components/admin/QuestionFormModal";

const inputClass = "w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#F6490D]";
const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const primaryClass = "rounded-xl bg-[#F6490D] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50";
const secondaryClass = "rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:opacity-50";
const EMPTY_BULK_FORM = { category_id: "", question_type: "", default_weightage: "", max_marks: "", is_active: "" };

function errorMessage(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.details) {
    if (typeof data.details === "string") return data.details;
    if (typeof data.details === "object") {
      const value = Object.entries(data.details).map(([key, value]) =>
        `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`
      ).join("; ");
      if (value) return value;
    }
  }
  if (data && typeof data === "object") {
    const value = Object.values(data).find(Boolean);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "string") return value;
  }
  return fallback;
}

async function apiRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Unexpected response from the server.");
  }
  if (!response.ok) throw new Error(errorMessage(data, `Request failed (${response.status}).`));
  return data;
}

function categoryFor(id, categories) {
  if (id === null || id === undefined || id === "") return null;
  return categories.find(category => String(category.id) === String(id)) || null;
}

function normalizeQuestion(question, categories) {
  if (!question || typeof question !== "object" || question.id == null) return null;
  const categoryId = question.category_id ?? question.category?.id;
  return {
    ...question,
    category: categoryId == null ? null :
      categoryFor(categoryId, categories) || question.category || null
  };
}

function mergeQuestions(previous, incoming, categories) {
  const map = new Map(previous.map(question => [String(question.id), question]));
  incoming.forEach(question => {
    const normalized = normalizeQuestion(question, categories);
    if (normalized) {
      const existing = map.get(String(normalized.id));
      map.set(String(normalized.id), existing ? { ...existing, ...normalized } : normalized);
    }
  });
  return [...map.values()].sort((a, b) => Number(b.id) - Number(a.id));
}

function isCompleteQuestion(question) {
  return !!question && typeof question === "object" &&
    question.id != null && typeof question.question_text === "string" &&
    question.question_type != null && question.default_weightage != null &&
    question.is_active != null && question.target_mode != null &&
    ("category" in question || "category_id" in question);
}

function QuestionRow({ question, selected, onToggle, onEdit, onDeactivate, deactivatingId, busy }) {
  const departments = question.departments || [];
  const employeeCount = question.employee_ids?.length || 0;
  const excludedCount = question.excluded_employee_ids?.length || 0;
  const uncategorised = !question.category;

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${selected ? "border-[#F6490D] bg-[#FFF8F5]" : "border-gray-200 bg-[#FCFCFD]"}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <input type="checkbox" checked={selected}
            onChange={() => onToggle(question.id)} disabled={busy}
            aria-label={`Select question ${question.id}`}
            className="mt-1 h-4 w-4 shrink-0 accent-[#F6490D]" />

          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${uncategorised ? "bg-amber-100 text-amber-800" : "bg-[#FFF1EC] text-[#F6490D]"}`}>
                {question.category?.name || "Uncategorised"}
              </span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {question.category?.category_type || "Not Assigned"}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${question.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {question.is_active ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {question.question_type === "descriptive" ? "Descriptive" : "Objective"}
              </span>
              {question.target_mode === "manual" && (
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                  Question Bank Only
                </span>
              )}
            </div>

            <p className="text-sm leading-7 text-[#111827]">{question.question_text}</p>

            <div className="mt-4 grid gap-3 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-3">
              <p><span className="font-medium text-[#111827]">Question ID:</span> {question.id}</p>
              <p><span className="font-medium text-[#111827]">Weightage:</span> {question.default_weightage}</p>
              <p><span className="font-medium text-[#111827]">Maximum Marks:</span> {question.max_marks ?? 10}</p>
              <p><span className="font-medium text-[#111827]">Targeting Mode:</span> {question.target_mode || "legacy"}</p>
              <p><span className="font-medium text-[#111827]">Legacy Department:</span> {question.department || "Common"}</p>
              <p><span className="font-medium text-[#111827]">Assigned Departments:</span> {departments.length ? departments.join(", ") : "—"}</p>
              <p><span className="font-medium text-[#111827]">Selected Employees:</span> {employeeCount}</p>
              <p><span className="font-medium text-[#111827]">Excluded Employees:</span> {excludedCount}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <button type="button" onClick={() => onEdit(question)} disabled={busy}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:opacity-50">
            Edit
          </button>
          <button type="button" onClick={() => onDeactivate(question.id)}
            disabled={busy || !question.is_active || deactivatingId === question.id}
            className="rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {deactivatingId === question.id ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminQuestionsPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const questionKey = useMemo(() => ["admin-questions", accessToken], [accessToken]);
  const categoryKey = useMemo(() => ["admin-question-categories", accessToken], [accessToken]);

  const [search, setSearch] = useState("");
  const [categoryType, setCategoryType] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [targetMode, setTargetMode] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploadCategoryId, setUploadCategoryId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedIds, setUploadedIds] = useState([]);
  const [uploadDecisionOpen, setUploadDecisionOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [uploadedWorkspaceIds, setUploadedWorkspaceIds] = useState([]);
  const [uploadedWorkspaceActive, setUploadedWorkspaceActive] = useState(false);
  const mutationRef = useRef(false);

  const questionQuery = useQuery({
    queryKey: questionKey,
    queryFn: async () => {
      const data = await apiRequest("/api/admin/questions", accessToken);
      return Array.isArray(data.results) ? data.results : [];
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000
  });

  const categoryQuery = useQuery({
    queryKey: categoryKey,
    queryFn: async () => {
      const data = await apiRequest("/api/admin/question-categories", accessToken);
      return Array.isArray(data.results) ? data.results : [];
    },
    enabled: !!accessToken,
    staleTime: 10 * 60 * 1000
  });

  const questions = questionQuery.data || [];
  const categories = categoryQuery.data || [];
  const loading = questionQuery.isPending;
  const busy = saving || uploading || bulkSaving || deactivatingId !== null;

  useEffect(() => {
    if (questionQuery.error) toast.error(questionQuery.error.message);
  }, [questionQuery.error]);

  useEffect(() => {
    if (categoryQuery.error) toast.error(categoryQuery.error.message);
  }, [categoryQuery.error]);

  useEffect(() => {
    if (!accessToken) {
      queryClient.removeQueries({ queryKey: ["admin-questions"] });
      queryClient.removeQueries({ queryKey: ["admin-question-categories"] });
    }
  }, [accessToken, queryClient]);

  const visibleQuestions = useMemo(() => {
    if (uploadedWorkspaceActive) {
      const ids = new Set(uploadedWorkspaceIds.map(String));
      return questions.filter(question => ids.has(String(question.id)));
    }

    const term = search.trim().toLowerCase();
    return questions.filter(question => {
      if (term && !String(question.question_text || "").toLowerCase().includes(term)) return false;
      if (categoryType && String(question.category?.category_type || "").toLowerCase() !== categoryType) return false;
      if (questionType && question.question_type !== questionType) return false;
      if (targetMode && (question.target_mode || "legacy") !== targetMode) return false;
      if (activeFilter && String(Boolean(question.is_active)) !== activeFilter) return false;
      return true;
    });
  }, [questions, uploadedWorkspaceActive, uploadedWorkspaceIds, search, categoryType, questionType, targetMode, activeFilter]);

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
  const allSelected = visibleQuestions.length > 0 &&
    visibleQuestions.every(question => selectedSet.has(String(question.id)));

  function updateCache(updater) {
    queryClient.setQueryData(questionKey, previous => updater(previous || []));
  }

  async function reconcileQuestions() {
    try {
      await queryClient.invalidateQueries({ queryKey: questionKey, refetchType: "active" });
    } catch (error) {
      console.error("Question Bank reconciliation failed:", error);
    }
  }

  async function beginMutation() {
    if (mutationRef.current) return false;
    mutationRef.current = true;
    await queryClient.cancelQueries({ queryKey: questionKey });
    return true;
  }

  function endMutation() {
    mutationRef.current = false;
  }

  function applyQuestionUpdates(previous, ids, updates) {
    const idSet = new Set(ids.map(String));
    const category = "category_id" in updates ? categoryFor(updates.category_id, categories) : undefined;

    return previous.map(question => {
      if (!idSet.has(String(question.id))) return question;
      return {
        ...question,
        ...updates,
        ...("category_id" in updates ? { category } : {})
      };
    });
  }

  function openCreateModal() {
    setModalMode("create");
    setSelectedQuestion(null);
    setModalOpen(true);
  }

  function openEditModal(question) {
    setModalMode("edit");
    setSelectedQuestion(question);
    setModalOpen(true);
  }

  async function handleSubmit(payload) {
    if (!(await beginMutation())) return;
    const editing = modalMode === "edit" && selectedQuestion;
    const snapshot = queryClient.getQueryData(questionKey);
    let optimistic = false;

    try {
      setSaving(true);

      if (editing) {
        optimistic = true;
        updateCache(previous => applyQuestionUpdates(previous, [selectedQuestion.id], payload));
      }

      const data = await apiRequest(
        editing ? `/api/admin/questions/${selectedQuestion.id}` : "/api/admin/questions",
        accessToken,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) }
      );

      const returned = data.question || (data.id != null ? data : null);

      if (isCompleteQuestion(returned)) {
        updateCache(previous => mergeQuestions(previous, [returned], categories));
      } else {
        await reconcileQuestions();
      }

      toast.success(editing ? "Question updated successfully." : "Question created successfully.");
      setModalOpen(false);
      setSelectedQuestion(null);
    } catch (error) {
      if (optimistic && snapshot !== undefined) queryClient.setQueryData(questionKey, snapshot);
      console.error(error);
      toast.error(error.message);
    } finally {
      setSaving(false);
      endMutation();
    }
  }

  async function handleDeactivate(questionId) {
    if (!(await beginMutation())) return;
    const snapshot = queryClient.getQueryData(questionKey);

    try {
      setDeactivatingId(questionId);
      updateCache(previous => applyQuestionUpdates(previous, [questionId], { is_active: false }));

      const data = await apiRequest(`/api/admin/questions/${questionId}`, accessToken, { method: "DELETE" });

      if (isCompleteQuestion(data.question)) {
        updateCache(previous => mergeQuestions(previous, [data.question], categories));
      } else {
        await reconcileQuestions();
      }

      toast.success("Question deactivated successfully.");
    } catch (error) {
      if (snapshot !== undefined) queryClient.setQueryData(questionKey, snapshot);
      console.error(error);
      toast.error(error.message);
    } finally {
      setDeactivatingId(null);
      endMutation();
    }
  }

  function parseUploadQuestions() {
    let parsed;

    try {
      parsed = JSON.parse(uploadText);
    } catch {
      throw new Error("Invalid JSON. Provide a valid JSON array or an object containing a questions array.");
    }

    const source = Array.isArray(parsed) ? parsed : parsed?.questions;

    if (!Array.isArray(source) || !source.length) {
      throw new Error("Upload must contain a non-empty questions array.");
    }

    const defaultCategory = uploadCategoryId === "" ? null : Number(uploadCategoryId);

    return source.map((item, index) => {
      const raw = typeof item === "string" ? { question_text: item } : item;

      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error(`Question ${index + 1} must be a string or an object.`);
      }

      const text = String(raw.question_text || "").trim();
      if (!text) throw new Error(`Question ${index + 1} is missing question_text.`);

      const rawCategory = raw.category_id;
      const categoryId = rawCategory === undefined || rawCategory === null || rawCategory === ""
        ? defaultCategory : Number(rawCategory);

      if (categoryId !== null && (
        !Number.isInteger(categoryId) || categoryId <= 0 ||
        !categories.some(category => Number(category.id) === categoryId)
      )) {
        throw new Error(`Question ${index + 1} specifies an invalid category_id.`);
      }

      const questionType = raw.question_type ?? "objective";
      const weightage = Number(raw.default_weightage ?? 1);
      const maxMarks = Number(raw.max_marks ?? 10);

      if (!["objective", "descriptive"].includes(questionType)) {
        throw new Error(`Question ${index + 1} has an invalid question_type.`);
      }
      if (!Number.isFinite(weightage) || weightage <= 0) {
        throw new Error(`Question ${index + 1} must have a positive default_weightage.`);
      }
      if (!Number.isInteger(maxMarks) || maxMarks < 1) {
        throw new Error(`Question ${index + 1} must have a positive integer max_marks.`);
      }

      return {
        question_text: text,
        category_id: categoryId,
        department: null,
        default_weightage: weightage,
        question_type: questionType,
        max_marks: maxMarks,
        is_active: raw.is_active !== false,
        target_mode: "manual",
        departments: [],
        employee_ids: [],
        excluded_employee_ids: []
      };
    });
  }

  async function handleUpload() {
    if (mutationRef.current) return;

    try {
      const payload = parseUploadQuestions();
      if (!(await beginMutation())) return;
      setUploading(true);

      const data = await apiRequest("/api/admin/questions/bulk-create", accessToken, {
        method: "POST",
        body: JSON.stringify({ questions: payload })
      });

      const returned = Array.isArray(data.questions) ? data.questions : [];
      const ids = returned.map(question => question.id).filter(id => id != null);

      if (returned.length && returned.every(isCompleteQuestion)) {
        updateCache(previous => mergeQuestions(previous, returned, categories));
      } else {
        await reconcileQuestions();
      }

      setUploadedIds(ids);
      setUploadOpen(false);
      setUploadDecisionOpen(true);
      setUploadText("");
      setUploadCategoryId("");

      toast.success(`${data.created_count ?? ids.length} questions uploaded successfully.`);
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setUploading(false);
      endMutation();
    }
  }

  async function handleUploadFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      JSON.parse(text);
      setUploadText(text);
      toast.success(`Loaded ${file.name}. Review the JSON before uploading.`);
    } catch {
      toast.error("The selected file does not contain valid JSON.");
    }

    event.target.value = "";
  }

  function configureUploadedNow() {
    const ids = [...uploadedIds];

    setUploadDecisionOpen(false);
    setSearch("");
    setCategoryType("");
    setQuestionType("");
    setTargetMode("");
    setActiveFilter("");
    setUploadedWorkspaceIds(ids);
    setUploadedWorkspaceActive(true);
    setSelectedIds(ids);
    setBulkEditing(true);
    setUploadedIds([]);
    setBulkForm({ ...EMPTY_BULK_FORM });

    setTimeout(() => document.getElementById("question-bulk-editor")?.scrollIntoView({
      behavior: "smooth", block: "start"
    }), 100);
  }

  function configureUploadedLater() {
    setUploadDecisionOpen(false);
    setUploadedIds([]);
    setSelectedIds([]);
    setBulkEditing(false);
    setUploadedWorkspaceActive(false);
    setUploadedWorkspaceIds([]);
    toast.success("Questions saved in the Question Bank. You can configure them later.");
  }

  function showAllQuestions() {
    setUploadedWorkspaceActive(false);
    setUploadedWorkspaceIds([]);
    setSelectedIds([]);
    setBulkEditing(false);
    setBulkForm({ ...EMPTY_BULK_FORM });
  }

  function toggleSelected(id) {
    setSelectedIds(previous => previous.includes(id)
      ? previous.filter(value => value !== id)
      : [...previous, id]);
  }

  function toggleSelectAll() {
    const ids = visibleQuestions.map(question => question.id);
    const visibleSet = new Set(ids.map(String));

    setSelectedIds(previous => allSelected
      ? previous.filter(id => !visibleSet.has(String(id)))
      : [...new Set([...previous, ...ids])]);
  }

  function resetBulkForm() {
    setBulkForm({ ...EMPTY_BULK_FORM });
  }

  async function handleBulkSave() {
    if (!selectedIds.length) return toast.error("Select at least one question.");

    const updates = {};

    if (bulkForm.category_id !== "") updates.category_id = Number(bulkForm.category_id);
    if (bulkForm.question_type) updates.question_type = bulkForm.question_type;
    if (bulkForm.default_weightage !== "") updates.default_weightage = Number(bulkForm.default_weightage);
    if (bulkForm.max_marks !== "") updates.max_marks = Number(bulkForm.max_marks);
    if (bulkForm.is_active !== "") updates.is_active = bulkForm.is_active === "true";

    if (!Object.keys(updates).length) return toast.error("Select at least one field to update.");

    if ("category_id" in updates && (
      !Number.isInteger(updates.category_id) ||
      !categories.some(category => Number(category.id) === updates.category_id)
    )) return toast.error("Select a valid category.");

    if ("default_weightage" in updates && (
      !Number.isFinite(updates.default_weightage) || updates.default_weightage <= 0
    )) return toast.error("Weightage must be greater than zero.");

    if ("max_marks" in updates && (
      !Number.isInteger(updates.max_marks) || updates.max_marks < 1
    )) return toast.error("Maximum marks must be a positive integer.");

    if (!(await beginMutation())) return;

    const snapshot = queryClient.getQueryData(questionKey);
    const ids = [...selectedIds];

    try {
      setBulkSaving(true);
      updateCache(previous => applyQuestionUpdates(previous, ids, updates));

      const data = await apiRequest("/api/admin/questions/bulk-update", accessToken, {
        method: "POST",
        body: JSON.stringify({ question_ids: ids, updates })
      });

      const returned = Array.isArray(data.questions) ? data.questions : [];

      if (returned.length === ids.length && returned.every(isCompleteQuestion)) {
        updateCache(previous => mergeQuestions(previous, returned, categories));
      } else {
        await reconcileQuestions();
      }

      toast.success(`${data.updated_count ?? ids.length} questions updated successfully.`);
      setSelectedIds([]);
      resetBulkForm();

      if (!uploadedWorkspaceActive) setBulkEditing(false);
    } catch (error) {
      if (snapshot !== undefined) queryClient.setQueryData(questionKey, snapshot);
      console.error(error);
      toast.error(error.message);
    } finally {
      setBulkSaving(false);
      endMutation();
    }
  }

  function applyFilters() {
    if (uploadedWorkspaceActive) {
      setUploadedWorkspaceActive(false);
      setUploadedWorkspaceIds([]);
      setSelectedIds([]);
      setBulkEditing(false);
    }
  }

  const questionCountLabel = `${visibleQuestions.length} question${visibleQuestions.length === 1 ? "" : "s"} found`;

  return (
    <>
      <div className="space-y-8">
        <div className={cardClass}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">Question Bank</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage behavioral and performance questions, scoring and employee targeting.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setUploadOpen(true)}
                disabled={busy} className={secondaryClass}>Bulk Upload Questions</button>
              <button type="button" onClick={openCreateModal}
                disabled={busy} className={primaryClass}>Add New Question</button>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-xl font-semibold text-[#111827]">Filters</h2>
          <p className="mt-1 text-sm text-gray-600">
            Narrow down questions by text, category, type, targeting and status.
            <span className="ml-2 text-xs font-medium text-emerald-600">Instant Search Enabled</span>
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search questions" className={inputClass} />

            <select value={categoryType} onChange={e => setCategoryType(e.target.value)} className={inputClass}>
              <option value="">All Categories</option>
              <option value="behavioral">Behavioral</option>
              <option value="performance">Performance</option>
            </select>

            <select value={questionType} onChange={e => setQuestionType(e.target.value)} className={inputClass}>
              <option value="">All Question Types</option>
              <option value="objective">Objective</option>
              <option value="descriptive">Descriptive</option>
            </select>

            <select value={targetMode} onChange={e => setTargetMode(e.target.value)} className={inputClass}>
              <option value="">All Targeting Modes</option>
              <option value="manual">Question Bank Only (Assign Later)</option>
              <option value="all">All Employees</option>
              <option value="departments">Departments</option>
              <option value="employees">Employees</option>
              <option value="combined">Combined</option>
              <option value="legacy">Legacy</option>
            </select>

            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} className={inputClass}>
              <option value="">All Statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <button type="button" onClick={applyFilters} disabled={busy}
              className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">
              Apply Filters
            </button>
          </div>
        </div>

        <div className={cardClass}>
          {uploadedWorkspaceActive && (
            <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-orange-200 bg-[#FFF8F5] p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#111827]">Recently Uploaded Questions</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Showing {visibleQuestions.length} questions from your latest upload.
                  Select a group, configure it, then select another group.
                </p>
              </div>
              <button type="button" onClick={showAllQuestions} disabled={busy}
                className={secondaryClass}>Show All Questions</button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#111827]">Questions</h2>
              <p className="mt-1 text-sm text-gray-600">
                {questionCountLabel}
                {selectedIds.length > 0 && ` • ${selectedIds.length} selected`}
                {questionQuery.isFetching && !loading && (
                  <span className="ml-2 text-xs text-gray-400">Syncing...</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={toggleSelectAll}
                disabled={busy || !visibleQuestions.length} className={secondaryClass}>
                {allSelected ? "Deselect All" : "Select All Visible"}
              </button>
              <button type="button" onClick={() => setSelectedIds([])}
                disabled={busy || !selectedIds.length} className={secondaryClass}>
                Clear Selection
              </button>
              <button type="button" onClick={() => setBulkEditing(previous => !previous)}
                disabled={busy || !selectedIds.length} className={primaryClass}>
                Bulk Configure ({selectedIds.length})
              </button>
            </div>
          </div>

          {bulkEditing && (
            <div id="question-bulk-editor" className="mt-6 rounded-2xl border border-orange-200 bg-[#FFF8F5] p-5">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-[#111827]">Bulk Configuration</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Updating {selectedIds.length} selected question{selectedIds.length === 1 ? "" : "s"}.
                  Only fields you specify will be changed. Existing targeting assignments remain untouched.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium">Question Category</label>
                  <select value={bulkForm.category_id}
                    onChange={e => setBulkForm(previous => ({ ...previous, category_id: e.target.value }))}
                    className={inputClass}>
                    <option value="">Keep Existing</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.category_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Question Type</label>
                  <select value={bulkForm.question_type}
                    onChange={e => setBulkForm(previous => ({ ...previous, question_type: e.target.value }))}
                    className={inputClass}>
                    <option value="">Keep Existing</option>
                    <option value="objective">Objective</option>
                    <option value="descriptive">Descriptive</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Default Weightage</label>
                  <input type="number" min="0.01" step="any" placeholder="Keep Existing"
                    value={bulkForm.default_weightage}
                    onChange={e => setBulkForm(previous => ({ ...previous, default_weightage: e.target.value }))}
                    className={inputClass} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Maximum Marks</label>
                  <input type="number" min="1" step="1" placeholder="Keep Existing"
                    value={bulkForm.max_marks}
                    onChange={e => setBulkForm(previous => ({ ...previous, max_marks: e.target.value }))}
                    className={inputClass} />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Question Status</label>
                  <select value={bulkForm.is_active}
                    onChange={e => setBulkForm(previous => ({ ...previous, is_active: e.target.value }))}
                    className={inputClass}>
                    <option value="">Keep Existing</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={handleBulkSave}
                  disabled={busy || !selectedIds.length} className={primaryClass}>
                  {bulkSaving ? "Saving..." : `Save Changes to ${selectedIds.length} Questions`}
                </button>
                <button type="button" onClick={resetBulkForm}
                  disabled={busy} className={secondaryClass}>Reset Fields</button>
                <button type="button" onClick={() => setBulkEditing(false)}
                  disabled={busy} className={secondaryClass}>Close Editor</button>
              </div>
            </div>
          )}

          <div className="mt-6">
            {loading ? (
              <div className="rounded-2xl border bg-[#FCFCFD] p-5 text-sm text-gray-600">
                Loading questions...
              </div>
            ) : questionQuery.isError && !questions.length ? (
              <div className="rounded-2xl border bg-red-50 p-5 text-sm text-red-700">
                Failed to load questions.
                <button type="button" onClick={() => questionQuery.refetch()}
                  className="ml-3 font-semibold underline">Retry</button>
              </div>
            ) : visibleQuestions.length === 0 ? (
              <div className="rounded-2xl border bg-[#FCFCFD] p-5 text-sm text-gray-600">
                No questions found.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleQuestions.map(question => (
                  <QuestionRow key={question.id} question={question}
                    selected={selectedSet.has(String(question.id))}
                    onToggle={toggleSelected} onEdit={openEditModal}
                    onDeactivate={handleDeactivate} deactivatingId={deactivatingId}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-[#111827]">Bulk Upload Questions</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Paste a JSON array or upload a JSON file. Questions will be saved as Question Bank Only.
                </p>
              </div>
              <button type="button" onClick={() => setUploadOpen(false)}
                disabled={uploading} className={secondaryClass}>Close</button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">Default Question Category (Optional)</label>
                <select value={uploadCategoryId}
                  onChange={e => setUploadCategoryId(e.target.value)} className={inputClass}>
                  <option value="">No Default — Keep Uncategorised</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.category_type})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Questions without category_id remain uncategorised unless a default is selected.
                  Questions specifying their own category_id retain it.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Upload JSON File</label>
                <input type="file" accept=".json,application/json"
                  onChange={handleUploadFile} className={`${inputClass} cursor-pointer`} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Questions JSON</label>
                <textarea rows={12} value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  className={`${inputClass} font-mono text-xs`}
                  placeholder={'[\n  "How effectively does the employee meet deadlines?",\n  {"question_text": "How well does the employee collaborate?", "question_type": "descriptive"}\n]'}
                />
                <p className="mt-2 text-xs text-gray-500">
                  Supports strings and question objects containing question_text, category_id,
                  question_type, default_weightage and max_marks. All targeting fields are ignored
                  so imported questions remain unassigned.
                </p>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-[#9A3412]">
                <strong>Assignment Safety:</strong> Uploaded questions use manual targeting.
                Uncategorised questions cannot be assigned to employee questionnaires until classified.
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleUpload}
                  disabled={uploading || !uploadText.trim()} className={primaryClass}>
                  {uploading ? "Uploading..." : "Upload Questions"}
                </button>
                <button type="button" onClick={() => setUploadOpen(false)}
                  disabled={uploading} className={secondaryClass}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadDecisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-7 shadow-xl">
            <h2 className="text-2xl font-semibold text-[#111827]">
              Questions Uploaded Successfully
            </h2>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              {uploadedIds.length} questions have been saved to your Question Bank.
              Would you like to configure their category, question type, weightage and maximum marks now?
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={configureUploadedNow}
                className={primaryClass}>Configure Now</button>
              <button type="button" onClick={configureUploadedLater}
                className={secondaryClass}>Configure Later</button>
            </div>
          </div>
        </div>
      )}

      <QuestionFormModal
        open={modalOpen} mode={modalMode} categories={categories}
        initialData={selectedQuestion} saving={saving}
        accessToken={accessToken}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setSelectedQuestion(null);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}