"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit, ArrowLeft, Save, Send, Loader2, AlertCircle,
  AlertTriangle, LockKeyhole, CheckCircle2, Search, RefreshCw, Undo2
} from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/layout/AppHeader";
import { useAuth } from "@/app/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import PotentialSubmitConfirmModal from "@/components/admin/potential/PotentialSubmitConfirmModal";
import PotentialEvaluationQuestion from "@/components/admin/potential/PotentialEvaluationQuestion";
import PotentialEvaluationProgress from "@/components/admin/potential/PotentialEvaluationProgress";
import { usePotentialEvaluation } from "@/hooks/usePotentialEvaluation";
import { getPotentialQuestionId, validatePotentialEvaluation, validatePotentialAnswer } from "@/lib/potential/evaluationUtils";

const panelClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const primaryClass = "bg-[#F6490D] text-white hover:bg-[#DD400B]";

export default function PotentialEvaluationPage({ assessmentId, evaluator }) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const evaluation = usePotentialEvaluation(accessToken, assessmentId, evaluator);
  const [search, setSearch] = useState("");
  const [questionType, setQuestionType] = useState("all");
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const { assessment, responses, progress, state } = evaluation;
  const questions = assessment?.questions || [];
  const evaluatorLabel = evaluator === "rm" ? "Reporting Manager" : "Skip-Level Manager";

  const visibleQuestions = useMemo(() => questions.filter(question => {
    const term = search.trim().toLowerCase();
    if (term && !`${question.question_text} ${question.category_name}`.toLowerCase().includes(term)) return false;
    if (questionType !== "all" && question.question_type !== questionType) return false;
    if (unansweredOnly && !validatePotentialAnswer(question, responses[getPotentialQuestionId(question)], true)) return false;
    return true;
  }), [questions, responses, search, questionType, unansweredOnly]);

  const guardNavigation = action => {
    if (evaluation.busy) return;
    if (!evaluation.dirty) return action();
    setConfirmation({
      title: "Discard unsaved evaluation changes?",
      description: "Your current unsaved responses will be lost if you continue.",
      confirmText: "Discard & Continue", action
    });
  };

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
        title: "Leave Potential evaluation?",
        description: "You have unsaved evaluation responses. Continuing will discard them.",
        confirmText: "Discard & Leave",
        action: () => router.push(`${destination.pathname}${destination.search}${destination.hash}`)
      });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [evaluation.dirty, evaluation.busy, router]);

  const revealErrors = errors => {
    evaluation.setValidationErrors(errors);
    setSearch("");
    setQuestionType("all");
    setUnansweredOnly(false);
    const firstId = Object.keys(errors)[0];
    if (firstId) setTimeout(() => document.getElementById(`potential-question-${firstId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  };

  const saveDraft = async () => {
    if (!evaluation.editable) return;
    const errors = validatePotentialEvaluation(questions, responses, false);
    if (Object.keys(errors).length) {
      revealErrors(errors);
      toast.error("Please correct invalid responses before saving.");
      return;
    }
    try {
      const result = await evaluation.saveDraft();
      if (!result?.success) return;
      if (result.requiresReload) toast.warning("Draft saved, but the latest assessment could not be loaded. Reload before continuing.");
      else toast.success("Potential evaluation draft saved successfully.");
    } catch (error) { toast.error(error.message || "Unable to save draft."); }
  };

  const requestSubmit = () => {
    if (!evaluation.editable) return;
    if (!questions.length) {
      toast.error("This questionnaire contains no questions.");
      return;
    }
    const errors = validatePotentialEvaluation(questions, responses, true);
    if (Object.keys(errors).length) {
      revealErrors(errors);
      toast.error(`Please complete ${Object.keys(errors).length} unanswered or invalid question(s).`);
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    try {
      const result = await evaluation.submit();
      if (!result?.success) return;
      setConfirmOpen(false);
      toast.success(`${evaluatorLabel} Potential evaluation submitted successfully.`);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setConfirmOpen(false);
      toast.error(error.message || "Unable to submit evaluation.");
    }
  };

  const reload = () => guardNavigation(async () => {
    const result = await evaluation.reload();
    if (result) toast.success("Latest Potential evaluation loaded.");
  });

  const discard = () => setConfirmation({
    title: "Discard unsaved responses?",
    description: "Restore your last successfully saved evaluation responses.",
    confirmText: "Discard Changes",
    action: evaluation.discardChanges
  });

  return (
    <main className="min-h-screen bg-[#F3F4F6]">
      <AppHeader />
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className={panelClass}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={evaluation.busy} onClick={() => guardNavigation(() => router.push("/dashboard"))}><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
            <Button variant="outline" size="sm" disabled={evaluation.busy || evaluation.loading} onClick={reload}><RefreshCw className={`mr-2 h-4 w-4 ${evaluation.loading ? "animate-spin" : ""}`} />Reload</Button>
          </div>
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#FFF1EC] p-4"><BrainCircuit className="h-7 w-7 text-[#F6490D]" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F6490D]">Potential Evaluation</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">{evaluatorLabel} Potential Questionnaire</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">Assess future readiness, capabilities and growth potential{assessment?.employee_name ? ` for ${assessment.employee_name}` : ""}.</p>
            </div>
          </div>
          {assessment && (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-gray-50 p-4"><p className="text-xs text-gray-500">Employee</p><p className="mt-1 text-sm font-semibold text-gray-900">{assessment.employee_name || "—"}</p></div>
              <div className="rounded-xl border bg-gray-50 p-4"><p className="text-xs text-gray-500">Review Cycle</p><p className="mt-1 text-sm font-semibold text-gray-900">{assessment.review_cycle_name || "—"}</p></div>
              <div className="rounded-xl border bg-gray-50 p-4"><p className="text-xs text-gray-500">Evaluation Role</p><p className="mt-1 text-sm font-semibold text-gray-900">{evaluatorLabel}</p></div>
            </div>
          )}
        </div>

        {evaluation.error && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><p>{evaluation.error}</p></div>
            {!assessment && <Button variant="outline" size="sm" onClick={reload}>Retry</Button>}
          </div>
        )}

        {evaluation.conflict && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Evaluation revision conflict</p><p className="mt-1 text-xs leading-5">The assessment has changed on the server. Your unsaved responses remain available locally. Reload the latest assessment before making further changes.</p></div>
          </div>
        )}

        {evaluation.requiresReload && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Draft saved — reload required</p><p className="mt-1 text-xs">Your responses were saved, but the latest revision could not be retrieved. Reload before continuing.</p></div>
          </div>
        )}

        {evaluation.loading ? (
          <div className={`${panelClass} flex min-h-64 flex-col items-center justify-center gap-3`}>
            <Loader2 className="h-8 w-8 animate-spin text-[#F6490D]" /><p className="text-sm text-gray-500">Loading Potential questionnaire...</p>
          </div>
        ) : assessment ? (
          <>
            {state.submitted ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Evaluation submitted</p><p className="mt-1 text-xs">Your responses are final and are available in read-only mode.</p></div>
              </div>
            ) : !state.canEvaluate && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <LockKeyhole className="h-5 w-5 shrink-0" /><div><p className="font-semibold">Evaluation is currently locked</p><p className="mt-1 text-xs">This assessment is not available for evaluation at the current review stage.</p></div>
              </div>
            )}

            <PotentialEvaluationProgress progress={progress} />

            <div className={panelClass}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-gray-900">Evaluation Questions</h2><p className="mt-1 text-xs text-gray-500">Showing {visibleQuestions.length} of {questions.length} questions</p></div>
                {evaluation.dirty ? <Badge className="border-0 bg-amber-50 text-amber-700">Unsaved Changes</Badge> : <Badge className="border-0 bg-emerald-50 text-emerald-700">No Unsaved Changes</Badge>}
              </div>
              <div className="mb-5 rounded-2xl border border-[#F6490D]/15 bg-[#FFF7F4] p-4 text-sm leading-6 text-gray-700">
                Provide a numerical rating for each objective question within its allowed marks range. For descriptive questions, provide a written evaluation. All questions are mandatory for final submission.
              </div>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input className="rounded-xl pl-9" value={search} placeholder="Search questions..." onChange={event => setSearch(event.target.value)} /></div>
                <select className="h-10 rounded-xl border bg-white px-3 text-sm" value={questionType} onChange={event => setQuestionType(event.target.value)}>
                  <option value="all">All Questions</option><option value="objective">Objective</option><option value="descriptive">Descriptive</option>
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" className="h-4 w-4 accent-[#F6490D]" checked={unansweredOnly} onChange={event => setUnansweredOnly(event.target.checked)} />Unanswered only</label>
              </div>
              <div className="space-y-4">
                {visibleQuestions.map(question => {
                  const id = getPotentialQuestionId(question);
                  return (
                    <PotentialEvaluationQuestion key={id} question={question} index={questions.findIndex(item => getPotentialQuestionId(item) === id)}
                      response={responses[id]} disabled={!evaluation.editable} error={evaluation.validationErrors[id]}
                      onChange={value => evaluation.updateResponse(id, value)} />
                  );
                })}
                {!visibleQuestions.length && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-gray-500">{questions.length ? "No questions match the selected filters." : "No published questions are available for this assessment."}</div>}
              </div>
            </div>

            {state.canEvaluate && (
              <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-gray-100 bg-white/95 p-4 shadow-[0_8px_35px_rgba(0,0,0,0.15)] backdrop-blur">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{progress.answered} of {progress.total} questions answered</p>
                  <p className="mt-1 text-xs text-gray-500">{evaluation.dirty ? "You have unsaved responses." : "No unsaved changes."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={!evaluation.editable || !evaluation.dirty} onClick={discard}><Undo2 className="mr-2 h-4 w-4" />Discard</Button>
                  <Button variant="outline" disabled={!evaluation.editable || !evaluation.dirty} onClick={saveDraft}>
                    {evaluation.pendingAction === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft
                  </Button>
                  <Button className={primaryClass} disabled={!evaluation.editable || !questions.length} onClick={requestSubmit}>
                    {evaluation.pendingAction === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit Questionnaire
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      <PotentialSubmitConfirmModal open={confirmOpen} employeeName={assessment?.employee_name} evaluatorLabel={evaluatorLabel}
        progress={progress} loading={evaluation.pendingAction === "submit"} onCancel={() => !evaluation.busy && setConfirmOpen(false)} onConfirm={submit} />

      <Dialog open={Boolean(confirmation)} onOpenChange={value => !value && setConfirmation(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />{confirmation?.title}</DialogTitle>
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