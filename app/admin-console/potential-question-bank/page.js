"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { toast } from "sonner";
import { BrainCircuit, Plus, Search, RefreshCw, FileJson, Settings2, Trash2, Pencil, Loader2, CheckCircle2, CircleHelp, ListChecks, MessageSquareText, LockKeyhole, FilterX, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usePotentialQuestionBank, usePotentialQuestionBankMutations } from "@/hooks/usePotentialQuestionBank";
import { filterPotentialQuestions, getTargetModeLabel, TARGET_MODES, ALL_TARGET_MODES } from "@/lib/potential/questionBankUtils";
import PotentialQuestionDialog from "@/components/admin/potential/PotentialQuestionDialog";
import PotentialBulkCreateDialog from "@/components/admin/potential/PotentialBulkCreateDialog";
import PotentialBulkConfigureDialog from "@/components/admin/potential/PotentialBulkConfigureDialog";

const EMPTY_FILTERS = { search: "", questionType: "all", targetMode: ALL_TARGET_MODES, status: "all", configuration: "all" };
const TARGET_FILTER_OPTIONS = [
  { value: ALL_TARGET_MODES, label: "All Targeting Modes" },
  ...TARGET_MODES,
  { value: "legacy", label: "Legacy Assignment" }
];
const selectClass = "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition-all focus:border-[#F6490D]";
const panelClass = "rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const primaryClass = "bg-[#F6490D] text-white hover:bg-[#DD400B]";
const PAGE_SIZE = 20;

function StatCard({ title, value, icon: Icon, color, background, description }) {
  return (
    <Card className="rounded-2xl border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        <div className={`rounded-xl p-3 ${background}`}><Icon className={`h-5 w-5 ${color}`} /></div>
      </div>
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <select className={selectClass} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function QuestionCard({ question, selected, onSelect, onEdit, onDelete, disabled }) {
  const published = Boolean(question.is_published_used);
  const used = Boolean(question.is_used || published);
  const descriptive = question.question_type === "descriptive";
  const departments = [...new Set((question.departments || []).map(department => department?.name ?? department))];
  const employeeCount = question.employee_ids?.length || 0;
  const excludedCount = question.excluded_employee_ids?.length || 0;
  return (
    <div className={`group rounded-2xl border p-5 transition-all duration-200 hover:shadow-md ${selected ? "border-[#F6490D]/50 bg-[#FFF1EC]/40" : "border-gray-200 bg-[#FCFCFD]"}`}>
      <div className="flex items-start gap-4">
        <input type="checkbox" aria-label={`Select question ${question.id}`} className="mt-1 h-4 w-4 shrink-0 accent-[#F6490D]" checked={selected} disabled={disabled} onChange={() => onSelect(question.id)} />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-gray-200 text-gray-500">#{question.id}</Badge>
            <Badge className={descriptive ? "border-0 bg-purple-50 text-purple-700 hover:bg-purple-50" : "border-0 bg-blue-50 text-blue-700 hover:bg-blue-50"}>
              {descriptive ? <MessageSquareText className="mr-1 h-3 w-3" /> : <ListChecks className="mr-1 h-3 w-3" />}
              {descriptive ? "Descriptive" : "Objective"}
            </Badge>
            <Badge className={question.is_active ? "border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "border-0 bg-gray-100 text-gray-600 hover:bg-gray-100"}>{question.is_active ? "Active" : "Inactive"}</Badge>
            {!question.is_configured && <Badge className="border-0 bg-amber-50 text-amber-700 hover:bg-amber-50">{question.target_mode === "manual" ? "Manual Assignment" : "Legacy Assignment"}</Badge>}
            {published && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><LockKeyhole className="mr-1 h-3 w-3" />Published Use</Badge>}
            {used && !published && <Badge variant="secondary">Assigned</Badge>}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm font-medium leading-7 text-gray-900">{question.question_text}</p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs text-gray-500">Weightage</p>
              <p className="mt-1 font-semibold text-gray-900">{question.weightage ?? question.default_weightage}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs text-gray-500">Maximum Marks</p>
              <p className="mt-1 font-semibold text-gray-900">{question.max_marks}</p>
            </div>
            <div className="col-span-2 rounded-xl border border-gray-100 bg-white p-3 sm:col-span-1">
              <p className="text-xs text-gray-500">Targeting</p>
              <p className="mt-1 font-medium text-gray-900">{getTargetModeLabel(question.target_mode)}</p>
            </div>
          </div>
          {(departments.length > 0 || employeeCount > 0 || excludedCount > 0) && (
            <div className="flex flex-wrap gap-2">
              {departments.map(department => <Badge key={department} variant="outline">{department}</Badge>)}
              {employeeCount > 0 && <Badge variant="secondary">{employeeCount} individually assigned</Badge>}
              {excludedCount > 0 && <Badge variant="outline" className="border-red-200 text-red-600">{excludedCount} excluded</Badge>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="icon" title="Edit question" disabled={disabled} onClick={() => onEdit(question)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" title={used ? "Assigned questions cannot be deleted" : "Delete question"} disabled={disabled || used} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(question)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function PotentialQuestionBankPage() {
  const { accessToken } = useAuth();
  const bank = usePotentialQuestionBank(accessToken);
  const mutations = usePotentialQuestionBankMutations(accessToken);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deleteQuestions, setDeleteQuestions] = useState([]);
  const [deleteError, setDeleteError] = useState("");
  const questions = bank.questions;
  const filtered = useMemo(() => filterPotentialQuestions(questions, filters), [questions, filters]);
  const selectedSet = useMemo(() => new Set(selectedIds.map(Number)), [selectedIds]);
  const selectedQuestions = useMemo(() => questions.filter(question => selectedSet.has(Number(question.id))), [questions, selectedSet]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleQuestions = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allVisibleSelected = visibleQuestions.length > 0 && visibleQuestions.every(question => selectedSet.has(Number(question.id)));
  const busy = mutations.isMutating;
  const deleting = mutations.deleteQuestion.isPending || mutations.bulkDelete.isPending;
  const stats = useMemo(() => ({
    total: questions.length,
    objective: questions.filter(question => question.question_type === "objective").length,
    descriptive: questions.filter(question => question.question_type === "descriptive").length,
    active: questions.filter(question => question.is_active).length,
    unconfigured: questions.filter(question => !question.is_configured).length
  }), [questions]);

  useEffect(() => {
    if (bank.queries.questions.isSuccess) {
      const existing = new Set(questions.map(question => Number(question.id)));
      setSelectedIds(previous => {
        const next = previous.filter(id => existing.has(Number(id)));
        return next.length === previous.length ? previous : next;
      });
    }
  }, [questions, bank.queries.questions.isSuccess]);

  const updateFilter = (field, value) => {
    setFilters(previous => ({ ...previous, [field]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };
  const toggleQuestion = id => {
    const numericId = Number(id);
    setSelectedIds(previous => previous.includes(numericId) ? previous.filter(value => value !== numericId) : [...previous, numericId]);
  };
  const toggleVisible = () => {
    const visibleIds = visibleQuestions.map(question => Number(question.id));
    setSelectedIds(previous => allVisibleSelected ? previous.filter(id => !visibleIds.includes(id)) : [...new Set([...previous, ...visibleIds])]);
  };
  const openCreate = () => {
    setEditingQuestion(null);
    setDialog("question");
  };
  const openEdit = question => {
    setEditingQuestion(question);
    setDialog("question");
  };
  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setEditingQuestion(null);
    setDeleteError("");
  };
  const previewTargeting = data => mutations.previewTargeting.mutateAsync(data);
  const saveQuestion = async data => {
    if (editingQuestion?.id) {
      await mutations.updateQuestion.mutateAsync({ id: editingQuestion.id, data });
      toast.success("Potential question updated successfully.");
    } else {
      await mutations.createQuestion.mutateAsync(data);
      toast.success("Potential question created successfully.");
    }
    setDialog(null);
    setEditingQuestion(null);
  };
  const bulkCreate = async data => {
    await mutations.bulkCreate.mutateAsync(data);
    toast.success(`${data.length} Potential questions created successfully.`);
    setDialog(null);
  };
  const bulkConfigure = async (questionIds, configuration) => {
    await mutations.bulkConfigure.mutateAsync({ question_ids: questionIds, configuration });
    toast.success("Selected questions configured successfully.");
    setSelectedIds([]);
    setDialog(null);
  };
  const openDelete = items => {
    const blocked = items.filter(question => question.is_used || question.is_published_used);
    if (blocked.length) {
      toast.error(`${blocked.length} selected question(s) are already assigned and cannot be deleted.`);
      return;
    }
    setDeleteQuestions(items);
    setDeleteError("");
    setDialog("delete");
  };
  const confirmDelete = async () => {
    if (!deleteQuestions.length || deleting) return;
    setDeleteError("");
    try {
      const ids = deleteQuestions.map(question => Number(question.id));
      if (ids.length === 1) await mutations.deleteQuestion.mutateAsync(ids[0]);
      else await mutations.bulkDelete.mutateAsync({ question_ids: ids });
      setSelectedIds(previous => previous.filter(id => !ids.includes(id)));
      toast.success(`${ids.length} question(s) deleted successfully.`);
      setDeleteQuestions([]);
      setDialog(null);
    } catch (error) {
      setDeleteError(error.message || "Unable to delete questions.");
    }
  };

  return (
    <div className="space-y-6">
      <section className={panelClass}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#FFF1EC] p-4"><BrainCircuit className="h-7 w-7 text-[#F6490D]" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F6490D]">Potential Management</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Potential Question Bank</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Create and configure objective and descriptive questions for employee Potential assessments conducted by reporting and skip-level managers.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || bank.isFetching} onClick={() => bank.refetch()}><RefreshCw className={`mr-2 h-4 w-4 ${bank.isFetching ? "animate-spin" : ""}`} />Refresh</Button>
            <Button variant="outline" disabled={busy} onClick={() => setDialog("bulk-create")}><FileJson className="mr-2 h-4 w-4" />Bulk Create</Button>
            <Button className={primaryClass} disabled={busy} onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Question</Button>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Total Questions" value={stats.total} icon={BrainCircuit} color="text-[#F6490D]" background="bg-[#FFF1EC]" description="Potential Question Bank" />
        <StatCard title="Objective" value={stats.objective} icon={ListChecks} color="text-blue-600" background="bg-blue-50" description="Numerically evaluated" />
        <StatCard title="Descriptive" value={stats.descriptive} icon={MessageSquareText} color="text-purple-600" background="bg-purple-50" description="Written evaluations" />
        <StatCard title="Active Questions" value={stats.active} icon={CheckCircle2} color="text-emerald-600" background="bg-emerald-50" description="Available for assignment" />
        <StatCard title="Manual / Legacy" value={stats.unconfigured} icon={CircleHelp} color="text-amber-600" background="bg-amber-50" description="Not explicitly auto-targeted" />
      </div>
      <section className={panelClass}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Search & Filters</h2>
            <p className="mt-1 text-xs text-gray-500">Filter questions locally without additional API requests.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}><FilterX className="mr-2 h-4 w-4" />Clear Filters</Button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input className="rounded-xl pl-10" value={filters.search} placeholder="Search questions or targeting..." onChange={event => updateFilter("search", event.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect label="Question Type" value={filters.questionType} onChange={value => updateFilter("questionType", value)} options={[
            { value: "all", label: "All Types" }, { value: "objective", label: "Objective" }, { value: "descriptive", label: "Descriptive" }
          ]} />
          <FilterSelect label="Targeting Mode" value={filters.targetMode} onChange={value => updateFilter("targetMode", value)} options={TARGET_FILTER_OPTIONS} />
          <FilterSelect label="Status" value={filters.status} onChange={value => updateFilter("status", value)} options={[
            { value: "all", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }
          ]} />
          <FilterSelect label="Configuration" value={filters.configuration} onChange={value => updateFilter("configuration", value)} options={[
            { value: "all", label: "All Questions" }, { value: "configured", label: "Automatically Targeted" }, { value: "unconfigured", label: "Manual / Legacy" }
          ]} />
        </div>
      </section>
      {bank.error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{bank.error.message || "Unable to load Potential Question Bank."}</div>
          <Button variant="outline" size="sm" onClick={() => bank.refetch()}>Retry</Button>
        </div>
      )}
      <section className={panelClass}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Potential Questions</h2>
            <p className="mt-1 text-xs text-gray-500">Showing {filtered.length} of {questions.length} questions</p>
          </div>
          {bank.isFetching && !bank.isLoading && <span className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3 w-3 animate-spin" />Synchronizing</span>}
        </div>
        {selectedIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#F6490D]/20 bg-[#FFF1EC] p-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#F6490D] text-white">{selectedIds.length} selected</Badge>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setSelectedIds([])}>Clear Selection</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setDialog("bulk-configure")}><Settings2 className="mr-2 h-4 w-4" />Bulk Configure</Button>
              <Button variant="outline" size="sm" disabled={busy} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => openDelete(selectedQuestions)}><Trash2 className="mr-2 h-4 w-4" />Bulk Delete</Button>
            </div>
          </div>
        )}
        {visibleQuestions.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" className="h-4 w-4 accent-[#F6490D]" checked={allVisibleSelected} disabled={busy} onChange={toggleVisible} />Select current page
            </label>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setSelectedIds(previous => [...new Set([...previous, ...filtered.map(question => Number(question.id))])])}>Select all {filtered.length} filtered questions</Button>
          </div>
        )}
        {bank.isLoading ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-gray-500"><Loader2 className="h-7 w-7 animate-spin text-[#F6490D]" /><p className="text-sm">Loading Potential questions...</p></div>
        ) : !visibleQuestions.length ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <BrainCircuit className="h-10 w-10 text-gray-300" />
            <h3 className="font-semibold text-gray-700">{questions.length ? "No matching questions" : "No Potential questions yet"}</h3>
            <p className="max-w-md text-sm text-gray-500">{questions.length ? "Try changing your search or filters." : "Create your first Potential question or import multiple questions using a JSON array of strings."}</p>
            {questions.length ? <Button variant="outline" onClick={clearFilters}>Clear Filters</Button> : <Button className={primaryClass} disabled={busy} onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create First Question</Button>}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleQuestions.map(question => <QuestionCard key={question.id} question={question} selected={selectedSet.has(Number(question.id))} disabled={busy} onSelect={toggleQuestion} onEdit={openEdit} onDelete={question => openDelete([question])} />)}
          </div>
        )}
        {filtered.length > PAGE_SIZE && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-gray-500">Page {currentPage} of {totalPages} · {filtered.length} questions</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        )}
      </section>
      <PotentialQuestionDialog open={dialog === "question"} onClose={closeDialog} question={editingQuestion} targetingOptions={bank.targetingOptions} onSave={saveQuestion} onPreview={previewTargeting} previewLoading={mutations.previewTargeting.isPending} saving={mutations.createQuestion.isPending || mutations.updateQuestion.isPending} />
      <PotentialBulkCreateDialog open={dialog === "bulk-create"} onClose={closeDialog} onSave={bulkCreate} saving={mutations.bulkCreate.isPending} />
      <PotentialBulkConfigureDialog open={dialog === "bulk-configure"} onClose={closeDialog} questions={selectedQuestions} targetingOptions={bank.targetingOptions} onSave={bulkConfigure} onPreview={previewTargeting} previewLoading={mutations.previewTargeting.isPending} saving={mutations.bulkConfigure.isPending} />
      <Dialog open={dialog === "delete"} onOpenChange={value => !value && !deleting && closeDialog()}>
        <DialogContent className="min-w-0 overflow-hidden sm:max-w-lg" onEscapeKeyDown={event => deleting && event.preventDefault()} onInteractOutside={event => deleting && event.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Delete Potential Questions</DialogTitle>
            <DialogDescription>Permanently delete {deleteQuestions.length} selected question(s). This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="max-h-48 min-w-0 space-y-2 overflow-y-auto rounded-xl border bg-gray-50 p-3">
            {deleteQuestions.map(question => <p key={question.id} className="break-words text-sm text-gray-700">#{question.id} · {question.question_text}</p>)}
          </div>
          {deleteError && <p className="break-words rounded-lg bg-red-50 p-3 text-sm text-red-700">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={closeDialog}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>{deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Confirm Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}