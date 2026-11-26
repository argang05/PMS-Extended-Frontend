"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, Search, Loader2, AlertCircle, AlertTriangle,
  CheckCircle2, UserRound, UsersRound, ClipboardCheck, ShieldCheck,
  Eye, Layers, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/layout/AppHeader";
import { useAuth } from "@/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import SubordinateResponsesModal from "@/components/SubordinateResponsesModal";
import SkipSelfResponsesModal from "@/components/SkipSelfResponsesModal";
import SkipRMResponsesModal from "@/components/SkipRMResponsesModal";
import PeerSelfResponsesModal from "@/components/PeerSelfResponsesModal";
import PerformanceEvaluationProgress from "@/components/performance/PerformanceEvaluationProgress";
import PerformanceEvaluationQuestion from "@/components/performance/PerformanceEvaluationQuestion";
import PerformanceEvaluationSummary from "@/components/performance/PerformanceEvaluationSummary";
import PerformanceEvaluationActionBar, { PerformanceSubmitConfirmModal } from "@/components/performance/PerformanceEvaluationActionBar";
import { usePerformanceEvaluation, getPerformanceCategory, formatPerformanceQuestion, validatePerformanceAnswer } from "@/hooks/usePerformanceEvaluation";

const panelClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const categories = [
  { id: "behavioral", label: "Skillset & Behavioural Parameters" },
  { id: "performance", label: "Performance Parameters" },
  { id: "additional", label: "Additional Parameters" }
];

const roleDetails = {
  self: { icon: UserRound, description: "Reflect on your performance, achievements and opportunities for professional improvement." },
  rm: { icon: ClipboardCheck, description: "Review the employee's self questionnaire and provide your reporting manager assessment." },
  skip: { icon: ShieldCheck, description: "Review the employee's performance after reporting manager assessment." },
  peer: { icon: UsersRound, description: "Provide an independent peer assessment based on your professional interactions." }
};

function InformationCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#111827]">{value || "—"}</p>
    </div>
  );
}

export default function PerformanceEvaluationPage({ role, questionnaireId = null }) {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const evaluation = usePerformanceEvaluation(accessToken, role, questionnaireId);
  const { assessment, questions, responses, idKey, config } = evaluation;
  const details = roleDetails[role];
  const RoleIcon = details.icon;
  const employeeName = role === "self"
    ? user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || assessment?.employee_name
    : assessment?.employee_name;

  const [search, setSearch] = useState("");
  const [questionType, setQuestionType] = useState("all");
  const [category, setCategory] = useState("all");
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [responseModal, setResponseModal] = useState(null);

  useEffect(() => {
    setSearch("");
    setQuestionType("all");
    setCategory("all");
    setUnansweredOnly(false);
    setCollapsed({});
    setConfirmOpen(false);
    setConfirmation(null);
    setResponseModal(null);
  }, [role, questionnaireId]);

  const questionIndices = useMemo(() => new Map(questions.map((question, index) => [question[idKey], index])), [questions, idKey]);

  const visibleQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return questions.filter(question => {
      const questionCategory = getPerformanceCategory(question);
      const text = formatPerformanceQuestion(question.question_text, employeeName, role);
      if (term && !`${text} ${question.category || ""} ${question.category_type || ""}`.toLowerCase().includes(term)) return false;
      if (questionType !== "all" && question.question_type !== questionType) return false;
      if (category !== "all" && questionCategory !== category) return false;
      if (unansweredOnly && !validatePerformanceAnswer(question, responses[question[idKey]], role, true)) return false;
      return true;
    });
  }, [questions, responses, search, questionType, category, unansweredOnly, idKey, employeeName, role]);

  const groupedQuestions = useMemo(() => {
    const groups = { behavioral: [], performance: [], additional: [] };
    visibleQuestions.forEach(question => groups[getPerformanceCategory(question)].push(question));
    return groups;
  }, [visibleQuestions]);

  function guardNavigation(action) {
    if (evaluation.busy) {
      toast.warning("Please wait for the current operation to finish.");
      return;
    }
    if (!evaluation.dirty) return action();
    setConfirmation({
      title: "Discard unsaved changes?",
      description: "Your unsaved evaluation responses will be lost if you continue.",
      confirmText: "Discard & Continue", action
    });
  }

  useEffect(() => {
    if (!evaluation.dirty && !evaluation.busy) return;
    const handler = event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      if (evaluation.busy) {
        toast.warning("Please wait for the current operation to finish.");
        return;
      }
      setConfirmation({
        title: "Leave Performance evaluation?",
        description: "You have unsaved evaluation responses. Continuing will discard them.",
        confirmText: "Discard & Leave",
        action: () => router.push(`${destination.pathname}${destination.search}${destination.hash}`)
      });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [evaluation.dirty, evaluation.busy, router]);

  function revealErrors(errors) {
    setSearch("");
    setQuestionType("all");
    setCategory("all");
    setUnansweredOnly(false);
    setCollapsed({});
    const first = Object.keys(errors).find(key => key !== "general");
    if (first) {
      setTimeout(() => document.getElementById(`performance-question-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
    toast.error(errors.general || Object.values(errors)[0] || "Please complete all required responses.");
  }

  async function saveDraft() {
    if (!evaluation.editable) return;
    const errors = evaluation.validate(false);
    if (Object.keys(errors).length) return revealErrors(errors);
    try {
      const result = await evaluation.saveDraft();
      if (result?.validationErrors) return revealErrors(result.validationErrors);
      if (!result?.success) return;
      if (result.requiresReload) toast.warning("Draft saved, but the latest responses could not be loaded. Reload before continuing.");
      else toast.success(result.message || "Draft saved successfully.");
    } catch (error) {
      toast.error(error.message || "Unable to save draft.");
    }
  }

  function requestSubmit() {
    if (!evaluation.editable) return;
    const errors = evaluation.validate(true);
    if (Object.keys(errors).length) return revealErrors(errors);
    setConfirmOpen(true);
  }

  async function submit() {
    try {
      const result = await evaluation.submit();
      if (result?.validationErrors) {
        setConfirmOpen(false);
        return revealErrors(result.validationErrors);
      }
      if (!result?.success) return;
      setConfirmOpen(false);
      toast.success(result.message || "Evaluation submitted successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setConfirmOpen(false);
      toast.error(error.message || "Unable to submit evaluation.");
    }
  }

  function reload() {
    guardNavigation(async () => {
      const success = await evaluation.reload();
      if (success) toast.success("Latest questionnaire loaded.");
      else toast.error("Unable to reload questionnaire.");
    });
  }

  function discard() {
    setConfirmation({
      title: "Discard unsaved responses?",
      description: "Restore the responses from your last successfully loaded or saved draft.",
      confirmText: "Discard Changes",
      action: () => {
        if (evaluation.discardChanges()) toast.success("Unsaved changes discarded.");
      }
    });
  }

  function clearFilters() {
    setSearch("");
    setQuestionType("all");
    setCategory("all");
    setUnansweredOnly(false);
  }

  return (
    <main className="min-h-screen bg-[#F3F4F6]">
      <AppHeader />
      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className={panelClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={evaluation.busy} onClick={() => guardNavigation(() => router.push("/dashboard"))}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard
            </Button>
            <Button variant="outline" size="sm" disabled={evaluation.busy || evaluation.loading} onClick={reload}>
              <RefreshCw className={`mr-2 h-4 w-4 ${evaluation.loading ? "animate-spin" : ""}`} />Reload
            </Button>
          </div>

          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-2xl bg-[#FFF1EC] p-4">
              <RoleIcon className="h-7 w-7 text-[#F6490D]" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F6490D]">Performance Evaluation</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">{config.title}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">{details.description}</p>
            </div>
          </div>

          {assessment && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <InformationCard label="Employee" value={employeeName} />
                <InformationCard label="Department" value={assessment.department || (role === "self" ? user?.department : "")} />
                <InformationCard label="Review Cycle" value={assessment.review_cycle} />
                <InformationCard label="Evaluation Role" value={config.label} />
              </div>

              {role !== "self" && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-5">
                  <Button variant="outline" disabled={evaluation.loading || evaluation.busy}
                    onClick={() => setResponseModal("self")} className="rounded-xl">
                    <Eye className="mr-2 h-4 w-4" />
                    {role === "rm" ? "View Subordinate Responses" : "View Employee Self Responses"}
                  </Button>
                  {role === "skip" && (
                    <Button variant="outline" disabled={evaluation.loading || evaluation.busy}
                      onClick={() => setResponseModal("rm")} className="rounded-xl">
                      <Eye className="mr-2 h-4 w-4" />View Reporting Manager Responses
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {evaluation.error && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{evaluation.error}</p>
            </div>
            {!assessment && <Button variant="outline" size="sm" onClick={reload}>Retry</Button>}
          </div>
        )}

        {evaluation.requiresReload && assessment && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Reload required</p>
              <p className="mt-1 text-xs leading-5">The latest server state could not be verified. Reload the questionnaire before continuing.</p>
            </div>
          </div>
        )}

        {evaluation.loading ? (
          <div className={`${panelClass} flex min-h-64 flex-col items-center justify-center gap-3`}>
            <Loader2 className="h-8 w-8 animate-spin text-[#F6490D]" />
            <p className="text-sm text-gray-500">Loading Performance questionnaire...</p>
          </div>
        ) : assessment?.id ? (
          <>
            {evaluation.submitted && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Evaluation submitted</p>
                  <p className="mt-1 text-xs">Your evaluation has already been submitted. Responses are available in read-only mode.</p>
                </div>
              </div>
            )}

            <PerformanceEvaluationProgress progress={evaluation.progress} role={role} />

            <section className={panelClass}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">Evaluation Questions</h2>
                  <p className="mt-1 text-xs text-gray-500">Showing {visibleQuestions.length} of {questions.length} questions</p>
                </div>
                <Badge className={`border-0 ${evaluation.dirty ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {evaluation.dirty ? "Unsaved Changes" : "No Unsaved Changes"}
                </Badge>
              </div>

              <div className="mb-5 rounded-2xl border border-[#F6490D]/15 bg-[#FFF7F4] p-4 text-sm leading-6 text-gray-700">
                Select a numerical rating for each objective question and provide written responses for descriptive questions.
                {role === "peer" && " You may mark a question Not Applicable when you cannot reasonably assess it."}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-48 flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search questions..." className="rounded-xl pl-9" />
                </div>
                <select value={questionType} onChange={event => setQuestionType(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm">
                  <option value="all">All Question Types</option>
                  <option value="objective">Objective</option>
                  <option value="descriptive">Descriptive</option>
                </select>
                <select value={category} onChange={event => setCategory(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm">
                  <option value="all">All Categories</option>
                  {categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={unansweredOnly} onChange={event => setUnansweredOnly(event.target.checked)} className="h-4 w-4 accent-[#F6490D]" />
                  Unanswered only
                </label>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
              </div>
            </section>

            {categories.map(item => {
              const items = groupedQuestions[item.id];
              if (!items.length) return null;
              const isCollapsed = Boolean(collapsed[item.id]);
              const answered = items.filter(question => !validatePerformanceAnswer(question, responses[question[idKey]], role, true)).length;
              return (
                <section key={item.id} className={panelClass}>
                  <button type="button" aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed(previous => ({ ...previous, [item.id]: !previous[item.id] }))}
                    className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-[#FFF1EC] p-2.5"><Layers className="h-5 w-5 text-[#F6490D]" /></div>
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight text-[#111827]">{item.label}</h2>
                        <p className="mt-1 text-xs text-gray-500">{answered} of {items.length} visible questions answered</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="border-0 bg-[#FFF1EC] text-[#F6490D]">{items.length} Questions</Badge>
                      {isCollapsed ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronUp className="h-5 w-5 text-gray-400" />}
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="mt-6 space-y-4">
                      {items.map(question => {
                        const id = question[idKey];
                        return (
                          <PerformanceEvaluationQuestion key={id}
                            question={question} index={questionIndices.get(id)}
                            response={responses[id]} role={role} idKey={idKey}
                            employeeName={employeeName} disabled={!evaluation.editable}
                            error={evaluation.validationErrors[id]}
                            onChange={patch => evaluation.updateResponse(id, patch)} />
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}

            {!visibleQuestions.length && (
              <div className={`${panelClass} border border-dashed text-center`}>
                <Search className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">{questions.length ? "No questions match the selected filters." : "No questions are available for this questionnaire."}</p>
                {questions.length > 0 && <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>Clear Filters</Button>}
              </div>
            )}

            <PerformanceEvaluationSummary evaluation={evaluation} role={role} />
            <PerformanceEvaluationActionBar evaluation={evaluation} onDiscard={discard} onSave={saveDraft} onSubmit={requestSubmit} />
          </>
        ) : !evaluation.error ? (
          <div className={`${panelClass} text-center`}>
            <ClipboardCheck className="mx-auto mb-3 h-9 w-9 text-gray-300" />
            <p className="text-sm text-gray-600">No questionnaire is currently available.</p>
          </div>
        ) : null}
      </section>

      {role === "rm" && (
        <SubordinateResponsesModal open={responseModal === "self"} onClose={() => setResponseModal(null)} questionnaireId={questionnaireId} />
      )}
      {role === "skip" && (
        <>
          <SkipSelfResponsesModal open={responseModal === "self"} onClose={() => setResponseModal(null)} questionnaireId={questionnaireId} />
          <SkipRMResponsesModal open={responseModal === "rm"} onClose={() => setResponseModal(null)} questionnaireId={questionnaireId} />
        </>
      )}
      {role === "peer" && (
        <PeerSelfResponsesModal open={responseModal === "self"} onClose={() => setResponseModal(null)} questionnaireId={questionnaireId} />
      )}

      <PerformanceSubmitConfirmModal open={confirmOpen} evaluation={evaluation} role={role}
        onCancel={() => !evaluation.busy && setConfirmOpen(false)} onConfirm={submit} />

      <Dialog open={Boolean(confirmation)} onOpenChange={value => !value && setConfirmation(null)}>
        <DialogContent className="rounded-[24px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />{confirmation?.title}
            </DialogTitle>
            <DialogDescription className="leading-6">{confirmation?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              const action = confirmation?.action;
              setConfirmation(null);
              action?.();
            }}>{confirmation?.confirmText || "Continue"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}