"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { toast } from "sonner";
import {
  BrainCircuit, Loader2, AlertCircle, AlertTriangle, Users,
  CalendarDays, ClipboardList, ShieldCheck, RefreshCw,
  UserRound, FilePenLine, CheckCircle2, RotateCcw, Layers3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usePotentialQuestionnaires, usePotentialQuestionnaire, usePotentialAvailableQuestions, usePotentialQuestionnaireMutations } from "@/hooks/usePotentialQuestionnaires";
import { usePotentialQuestionnaireDraft } from "@/hooks/usePotentialQuestionnaireDraft";
import {
  validateQuestionnaireDraft, getPotentialResetImpact,
  getQuestionnaireActivation, hasPendingCustomization
} from "@/lib/potential/questionnaireUtils";
import {
  requiresPotentialResetConfirmation, isPotentialRevisionConflict
} from "@/lib/api/potential";
import QuestionnaireEmployeeSelector from "@/components/admin/potential/QuestionnaireEmployeeSelector";
import AvailableQuestionPanel from "@/components/admin/potential/AvailableQuestionPanel";
import QuestionnaireWorkspace from "@/components/admin/potential/QuestionnaireWorkspace";
import CopyQuestionnaireDialog from "@/components/admin/potential/CopyQuestionnaireDialog";
import QuestionnaireActionBar from "@/components/admin/potential/QuestionnaireActionBar";

const panelClass = "rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const primaryClass = "bg-[#F6490D] text-white hover:bg-[#DD400B]";
const EMPTY_ARRAY = [];
const EMPTY_FILTERS = {};

function getEmployeeName(employee) {
  if (!employee) return "Not assigned";
  if (typeof employee === "string") return employee;
  return employee.full_name || employee.name || `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.employee_number || "Not assigned";
}

function getEntityId(entity, fallback) {
  return entity?.id ?? fallback ?? (typeof entity === "number" || typeof entity === "string" ? entity : null);
}

function ConfirmationDialog({ confirmation, busy, onConfirm, onCancel }) {
  return (
    <Dialog open={Boolean(confirmation)} onOpenChange={open => !open && !busy && onCancel()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 shrink-0 ${confirmation?.destructive ? "text-red-600" : "text-amber-600"}`} />
            {confirmation?.title}
          </DialogTitle>
          <DialogDescription className="leading-6">{confirmation?.description}</DialogDescription>
        </DialogHeader>
        {confirmation?.warning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            {confirmation.warning}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant={confirmation?.destructive ? "destructive" : "default"} className={confirmation?.destructive ? "" : primaryClass} disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmation?.confirmText || "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvaluatorImpactCard({ title, employee, submitted, responseCount }) {
  const assigned = Boolean(employee);
  return (
    <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
        <Users className="h-4 w-4 text-[#F6490D]" />{title}
      </div>
      <p className="break-words text-sm font-semibold text-gray-900">{getEmployeeName(employee)}</p>
      {employee?.employee_number && (
        <p className="mt-1 text-xs text-gray-500">Employee #{employee.employee_number}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge className={`border-0 ${submitted ? "bg-emerald-100 text-emerald-700" : responseCount ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
          {submitted ? "Submitted" : responseCount ? "Draft Responses" : assigned ? "Not Submitted" : "Not Assigned"}
        </Badge>
        <Badge variant="outline">{responseCount} responses</Badge>
      </div>
    </div>
  );
}

function PotentialResetConfirmationDialog({ confirmation, busy, onConfirm, onCancel }) {
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => setAcknowledged(false), [confirmation]);
  const impact = getPotentialResetImpact(confirmation?.data);
  return (
    <Dialog open={Boolean(confirmation)} onOpenChange={open => !open && !busy && onCancel()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-[24px] p-0">
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pb-4 pt-6">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
            <RotateCcw className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900">Reset Potential Evaluation & Publish?</DialogTitle>
          <DialogDescription className="leading-6">
            Existing Potential evaluation data was detected. Publishing this changed questionnaire requires restarting the Potential evaluation.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Employee</p>
                <p className="mt-1 break-words text-sm font-semibold text-gray-900">{confirmation?.employeeName || "Selected Employee"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Review Cycle</p>
                <p className="mt-1 break-words text-sm font-semibold text-gray-900">{confirmation?.cycleName || "Selected Review Cycle"}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">This action cannot be undone.</p>
                <p className="mt-1 text-xs leading-5">
                  {impact.responseCount} existing Potential responses will be removed. The updated questionnaire will become active, and the Reporting Manager will need to complete a fresh evaluation.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <EvaluatorImpactCard
              title="Reporting Manager"
              employee={impact.reportingManager}
              submitted={impact.rmSubmitted}
              responseCount={impact.rmResponseCount}
            />
            <EvaluatorImpactCard
              title="Skip-Level Manager"
              employee={impact.skipLevelManager}
              submitted={impact.skipSubmitted}
              responseCount={impact.skipResponseCount}
            />
          </div>
          <div className="rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Potential data affected</h3>
            <div className="mt-3 space-y-2 text-xs leading-5 text-gray-600">
              <p className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />Existing RM and Skip-Level Potential responses and submission states.</p>
              <p className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />Potential descriptive scoring associated with removed responses.</p>
              {impact.affectedResults.map(result => (
                <p key={result} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{result}
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Performance evaluation will remain unchanged.</p>
              <p className="mt-1 text-xs leading-5">
                Performance questionnaires, Self/RM/Skip/Peer responses, Performance scores and Past Performance Index will be preserved. Combined analytics and other results that depend on Potential may require recalculation or republication.
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={busy}
              onChange={event => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#F6490D]"
            />
            <span className="text-sm leading-6 text-gray-700">
              I have informed and discussed this reset with the concerned evaluators, and understand that existing Potential evaluation data will be removed.
            </span>
          </label>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-gray-100 bg-white px-6 py-4 sm:gap-2">
          <Button variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" disabled={busy || !acknowledged} onClick={onConfirm}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Reset Potential & Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssessmentSummary({ questionnaire }) {
  const employee = questionnaire.employee;
  const cycle = questionnaire.review_cycle;
  const rm = questionnaire.reporting_manager;
  const skip = questionnaire.skip_level_manager;
  const activation = getQuestionnaireActivation(questionnaire);
  return (
    <section className={panelClass}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Assessment Overview</h2>
          <p className="mt-1 text-xs text-gray-500">Potential Assessment #{questionnaire.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border-0 bg-[#FFF1EC] text-[#F6490D]">Potential Evaluation</Badge>
          <Badge className={`${activation.className} border-0`}>{activation.label}</Badge>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Employee", value: getEmployeeName(employee), subtitle: employee?.employee_number || questionnaire.employee_number, icon: UserRound },
          { label: "Review Cycle", value: cycle?.name || questionnaire.review_cycle_name || "Review Cycle", subtitle: "Assessment period", icon: CalendarDays },
          { label: "Reporting Manager", value: getEmployeeName(rm), subtitle: questionnaire.rm_submitted ? "Evaluation submitted" : "Primary evaluator", icon: Users },
          { label: "Skip-Level Manager", value: getEmployeeName(skip), subtitle: skip ? questionnaire.skip_submitted ? "Evaluation submitted" : "Secondary evaluator" : "Not required when unassigned", icon: ShieldCheck }
        ].map(({ label, value, subtitle, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-[#FCFCFD] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-gray-500">
              <Icon className="h-4 w-4 text-[#F6490D]" />{label}
            </div>
            <p className="break-words text-sm font-semibold text-gray-900">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs leading-5 text-blue-800">
        Potential evaluations are performed by the Reporting Manager and, where assigned, the Skip-Level Manager. Default questionnaires are automatically activated for eligible employees. Self and Peer evaluations are not part of this assessment.
      </div>
    </section>
  );
}

function ConfigurationSummary({ questionnaire, draftState }) {
  const active = draftState.activeStats;
  const working = draftState.stats;
  const isActive = Boolean(questionnaire.is_published);
  const hasPendingDraft = hasPendingCustomization(questionnaire);
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3"><ShieldCheck className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Active Questionnaire</h3>
            <p className="mt-1 text-xs text-gray-500">{isActive ? "Currently available to managers" : "Not available for evaluation"}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["Questions", isActive ? active.total : 0],
            ["Objective", isActive ? active.objective : 0],
            ["Descriptive", isActive ? active.descriptive : 0]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[24px] border border-orange-100 bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#FFF1EC] p-3"><FilePenLine className="h-5 w-5 text-[#F6490D]" /></div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Customization Workspace</h3>
              <p className="mt-1 text-xs text-gray-500">Editable administrative configuration</p>
            </div>
          </div>
          <Badge className={`border-0 ${draftState.dirty ? "bg-amber-50 text-amber-700" : hasPendingDraft ? "bg-violet-50 text-violet-700" : "bg-gray-100 text-gray-600"}`}>
            {draftState.dirty ? "Unsaved" : hasPendingDraft ? "Awaiting Publication" : "Up to Date"}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["Questions", working.total],
            ["Objective", working.objective],
            ["Descriptive", working.descriptive]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PotentialQuestionnaireBuilderPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [employeeId, setEmployeeId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [resetConfirmation, setResetConfirmation] = useState(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionError, setActionError] = useState("");
  const operationRef = useRef(false);
  const confirmationActionRef = useRef(null);
  const collection = usePotentialQuestionnaires(accessToken, EMPTY_FILTERS);
  const detail = usePotentialQuestionnaire(accessToken, selectedId);
  const questionnaire = detail.data;
  const draftState = usePotentialQuestionnaireDraft(questionnaire, selectedId);
  const mutations = usePotentialQuestionnaireMutations(accessToken);
  const available = usePotentialAvailableQuestions(accessToken, selectedId, EMPTY_FILTERS, Boolean(questionnaire));
  const employees = collection.options?.employees || EMPTY_ARRAY;
  const cycles = collection.options?.review_cycles || collection.options?.cycles || EMPTY_ARRAY;
  const questionnaires = collection.questionnaires;
  const availableQuestions = available.data || EMPTY_ARRAY;
  const draft = draftState.draft;
  const busy = Boolean(pendingAction || mutations.isMutating);
  const modalOpen = Boolean(confirmation || resetConfirmation || copyOpen);
  const draftMatchesSelection = Boolean(draft && Number(draft.questionnaireId) === Number(selectedId));
  const workspaceReady = Boolean(questionnaire && draftMatchesSelection);
  const editingDisabled = busy || modalOpen || !draftState.editable || !draftMatchesSelection;

  const requestConfirmation = (config, action) => {
    confirmationActionRef.current = action;
    setConfirmation(config);
  };

  const closeConfirmation = () => {
    if (operationRef.current) return;
    confirmationActionRef.current = null;
    setConfirmation(null);
  };

  const confirmAction = async () => {
    const action = confirmationActionRef.current;
    if (!action || operationRef.current) return;
    confirmationActionRef.current = null;
    setConfirmation(null);
    await action();
  };

  const guardUnsavedChanges = action => {
    if (operationRef.current || resetConfirmation) return;
    if (!draftState.dirty) return action();
    requestConfirmation({
      title: "Discard unsaved changes?",
      description: "The current Potential questionnaire contains unsaved local changes.",
      warning: "Continuing will discard changes that have not been saved to the backend. Saved customization drafts will remain available.",
      confirmText: "Discard & Continue",
      destructive: true
    }, action);
  };

  useEffect(() => {
    if (!draftState.dirty && !busy && !resetConfirmation) return;
    const handleNavigation = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      if (busy || resetConfirmation) {
        toast.warning("Complete or cancel the current questionnaire operation first.");
        return;
      }
      requestConfirmation({
        title: "Leave Questionnaire Builder?",
        description: "You have unsaved questionnaire changes.",
        warning: "Your unsaved edits will be discarded if you leave this page. Saved customization drafts will be preserved.",
        confirmText: "Discard & Leave",
        destructive: true
      }, () => router.push(`${destination.pathname}${destination.search}${destination.hash}`));
    };
    document.addEventListener("click", handleNavigation, true);
    return () => document.removeEventListener("click", handleNavigation, true);
  }, [draftState.dirty, busy, resetConfirmation, router]);

  const findQuestionnaire = (employee, cycle) => {
    if (!employee || !cycle) return null;
    return questionnaires.find(item =>
      String(getEntityId(item.employee, item.employee_id)) === String(employee) &&
      String(getEntityId(item.review_cycle, item.review_cycle_id)) === String(cycle)
    );
  };

  const applySelection = (employee, cycle) => {
    draftState.clearDraft();
    setEmployeeId(employee);
    setCycleId(cycle);
    setActionError("");
    setSelectedId(findQuestionnaire(employee, cycle)?.id ?? null);
  };

  const changeEmployee = id => {
    if (String(employeeId) === String(id)) return;
    guardUnsavedChanges(() => applySelection(id, cycleId));
  };

  const changeCycle = id => {
    if (String(cycleId) === String(id)) return;
    guardUnsavedChanges(() => applySelection(employeeId, id));
  };

  const selectQuestionnaire = id => {
    if (Number(selectedId) === Number(id)) return;
    const item = questionnaires.find(questionnaire => Number(questionnaire.id) === Number(id));
    if (!item) return;
    guardUnsavedChanges(() => {
      draftState.clearDraft();
      setEmployeeId(getEntityId(item.employee, item.employee_id) || "");
      setCycleId(getEntityId(item.review_cycle, item.review_cycle_id) || "");
      setSelectedId(item.id);
      setActionError("");
    });
  };

  const runOperation = async (action, operation, { propagateError = false } = {}) => {
    if (operationRef.current) return null;
    operationRef.current = true;
    setPendingAction(action);
    setActionError("");
    try {
      return await operation();
    } catch (error) {
      if (isPotentialRevisionConflict(error) && action !== "create") draftState.markConflict();
      const message = error?.message || "Unable to complete the questionnaire operation.";
      setActionError(message);
      toast.error(message);
      if (propagateError) throw error;
      return null;
    } finally {
      operationRef.current = false;
      setPendingAction(null);
    }
  };

  const reconcileResult = (result, successMessage) => {
    if (result?.questionnaire) {
      draftState.acceptMutation(result);
      toast.success(successMessage);
      return true;
    }
    if (result?.requiresReload) {
      draftState.acceptMutation(result);
      toast.warning("The operation succeeded, but the latest questionnaire could not be loaded. Please reload.");
      return false;
    }
    toast.warning("The operation completed. Reload the questionnaire to verify its latest state.");
    return false;
  };

  const createQuestionnaire = payload => guardUnsavedChanges(() => runOperation("create", async () => {
    const result = await mutations.create.mutateAsync(payload);
    draftState.clearDraft();
    setEmployeeId(payload.employee_id);
    setCycleId(payload.review_cycle_id);
    if (result?.id) {
      setSelectedId(result.id);
      reconcileResult(result, "Potential questionnaire initialized successfully.");
    } else {
      const refreshed = await collection.queries.questionnaires.refetch();
      const data = refreshed.data;
      const items = Array.isArray(data) ? data : data?.results || data?.questionnaires || data?.assessments || [];
      const created = items.find(item =>
        String(getEntityId(item.employee, item.employee_id)) === String(payload.employee_id) &&
        String(getEntityId(item.review_cycle, item.review_cycle_id)) === String(payload.review_cycle_id)
      );
      setSelectedId(created?.id ?? null);
      toast.warning("Initialization completed. Verify the questionnaire in the refreshed list.");
    }
  }));

  const saveDraft = () => {
    if (!draft || !draftState.editable || !draftState.dirty) return;
    return runOperation("save", async () => {
      const errors = validateQuestionnaireDraft(draft);
      if (errors.length) throw new Error(errors.join(" "));
      const result = await mutations.saveDraft.mutateAsync(draft);
      reconcileResult(result, "Customization draft saved. Active evaluations remain unchanged.");
    });
  };

  const synchronize = () => {
    if (!draftState.editable || !draft) return;
    requestConfirmation({
      title: "Synchronize Customization Draft?",
      description: "Refresh automatic question assignments using the latest Potential Question Bank configuration.",
      warning: draftState.dirty
        ? "Unsaved local changes will be discarded. Active manager evaluations will remain unchanged."
        : "Saved customizations will be handled by the backend synchronization rules. Active manager evaluations will remain unchanged.",
      confirmText: "Synchronize Draft"
    }, () => runOperation("sync", async () => {
      const result = await mutations.synchronize.mutateAsync({ id: selectedId, revision: draft.revision });
      reconcileResult(result, "Customization draft synchronized successfully.");
    }));
  };

  const resetQuestionnaire = () => {
    if (!draftState.editable || !draft) return;
    requestConfirmation({
      title: "Reset Draft to Automatic Configuration?",
      description: "Restore the administrative customization draft to the automatically assigned Question Bank configuration.",
      warning: "Manual inclusions, exclusions, custom weightages, question ordering and unsaved edits may be removed from the draft. Existing Potential responses and active evaluations will not be reset.",
      confirmText: "Reset Draft",
      destructive: true
    }, () => runOperation("reset", async () => {
      const result = await mutations.reset.mutateAsync({ id: selectedId, revision: draft.revision });
      reconcileResult(result, "Draft restored to automatic configuration. Active evaluations remain unchanged.");
    }));
  };

  const openCopyDialog = () => {
    if (!draftState.editable) return;
    if (draftState.dirty) {
      requestConfirmation({
        title: "Copy over unsaved changes?",
        description: "Copying another questionnaire replaces the current customization draft.",
        warning: "Unsaved local edits will not be included in the copied questionnaire. Existing active evaluations will remain unchanged.",
        confirmText: "Continue to Copy",
        destructive: true
      }, () => setCopyOpen(true));
    } else setCopyOpen(true);
  };

  const copyQuestionnaire = (sourceId, copyWeightages) => runOperation("copy", async () => {
    if (!draftState.editable || !draft) throw new Error("The current questionnaire cannot be modified.");
    const result = await mutations.copy.mutateAsync({ id: selectedId, sourceId, revision: draft.revision, copyWeightages });
    reconcileResult(result, "Questionnaire copied into customization draft successfully.");
    setCopyOpen(false);
  }, { propagateError: true });

  const discardChanges = () => {
    if (!draftState.dirty || draftState.requiresReload || draftState.serverConflict) return;
    requestConfirmation({
      title: "Discard local changes?",
      description: "Restore the latest saved server configuration. Previously saved customization drafts will be preserved.",
      confirmText: "Discard Changes",
      destructive: true
    }, () => {
      if (draftState.discardChanges()) {
        setActionError("");
        toast.success("Unsaved changes discarded.");
      }
    });
  };

  const reloadQuestionnaire = () => {
    if (!selectedId) return;
    const reload = () => runOperation("reload", async () => {
      const result = await detail.refetch();
      if (result.error) throw result.error;
      if (!result.data?.id) throw new Error("Unable to retrieve the latest questionnaire.");
      draftState.acceptQuestionnaire(result.data);
      await available.refetch();
      toast.success("Latest Potential questionnaire loaded.");
    });
    guardUnsavedChanges(reload);
  };

  const openResetConfirmation = (error, id, revision) => {
    const data = error.data || {};
    if (Number(data.assessment_id) !== Number(id) || !data.revision || data.revision !== revision) {
      draftState.markConflict();
      throw new Error("The reset confirmation no longer matches the current questionnaire revision. Reload before publishing.");
    }
    setResetConfirmation({
      id,
      revision: data.revision,
      data,
      employeeName: getEmployeeName(questionnaire?.employee),
      cycleName: questionnaire?.review_cycle?.name || questionnaire?.review_cycle_name
    });
  };

  const attemptPublication = async (id, revision) => {
    try {
      const result = await mutations.publish.mutateAsync({ id, revision, confirmReset: false });
      reconcileResult(result, "Potential questionnaire published successfully.");
    } catch (error) {
      if (requiresPotentialResetConfirmation(error)) {
        openResetConfirmation(error, id, revision);
        return;
      }
      throw error;
    }
  };

  const publishQuestionnaire = () => {
    if (!draftState.editable || !draft || resetConfirmation) return;
    const errors = validateQuestionnaireDraft(draft, { publishing: true });
    if (errors.length) {
      setActionError(errors.join(" "));
      toast.error(errors[0]);
      return;
    }
    requestConfirmation({
      title: questionnaire?.is_published ? "Publish Questionnaire Changes?" : "Publish Potential Questionnaire?",
      description: "Activate this configuration for the assigned Reporting Manager and Skip-Level Manager, where applicable.",
      warning: draftState.dirty
        ? "Your current customization draft will be saved first. If existing Potential evaluations need to be reset, you will be asked for separate confirmation."
        : "The backend will check for existing Potential responses and dependent results. No existing evaluation data will be removed without your explicit reset confirmation.",
      confirmText: draftState.dirty ? "Save & Publish" : "Publish Changes"
    }, () => runOperation("publish", async () => {
      let revision = draft.revision;
      if (draftState.dirty) {
        const saved = await mutations.saveDraft.mutateAsync(draft);
        if (!reconcileResult(saved, "Customization draft saved successfully.")) return;
        revision = saved.questionnaire.revision ?? saved.questionnaire.updated_at;
        if (!revision) throw new Error("Draft saved, but the updated revision is unavailable. Reload before publishing.");
      }
      await attemptPublication(selectedId, revision);
    }));
  };

  const cancelPotentialReset = () => {
    if (operationRef.current) return;
    setResetConfirmation(null);
    setActionError("");
    toast.info("Publication cancelled. Saved customization draft and existing evaluations have been preserved.");
  };

  const confirmPotentialReset = () => {
    if (!resetConfirmation || operationRef.current) return;
    const pending = resetConfirmation;
    if (Number(pending.id) !== Number(selectedId)) {
      setResetConfirmation(null);
      toast.error("The selected questionnaire has changed. Reload before publishing.");
      return;
    }
    return runOperation("publish", async () => {
      try {
        const result = await mutations.publish.mutateAsync({
          id: pending.id,
          revision: pending.revision,
          confirmReset: true
        });
        setResetConfirmation(null);
        reconcileResult(result, "Potential evaluation reset and updated questionnaire published successfully.");
      } catch (error) {
        setResetConfirmation(null);
        if (requiresPotentialResetConfirmation(error)) {
          draftState.markConflict();
          throw new Error("Reset confirmation is no longer valid. Reload and review the latest evaluation data before publishing.");
        }
        throw error;
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className={panelClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-[#FFF1EC] p-4"><BrainCircuit className="h-7 w-7 text-[#F6490D]" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F6490D]">Potential Management</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">Potential Questionnaire Builder</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                Customize employee-specific Potential questionnaires, manage automatic and manual assignments, and publish changes without disturbing existing evaluations until explicitly confirmed.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled={busy || modalOpen || collection.isFetching} onClick={() => collection.refetch()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${collection.isFetching ? "animate-spin" : ""}`} />Refresh Directory
          </Button>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Manual publication is optional</p>
            <p className="mt-1 text-xs leading-5">
              Eligible employees receive automatically configured Potential questionnaires. Use this builder only when employee-specific customization is required.
            </p>
          </div>
        </div>
      </section>
      {collection.error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />{collection.error.message || "Unable to load questionnaire options."}</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => collection.refetch()}>Retry</Button>
        </div>
      )}
      <QuestionnaireEmployeeSelector
        employees={employees} cycles={cycles} questionnaires={questionnaires}
        employeeId={employeeId} cycleId={cycleId} selectedId={selectedId}
        onEmployeeChange={changeEmployee} onCycleChange={changeCycle}
        onSelect={selectQuestionnaire} onCreate={createQuestionnaire}
        loading={collection.isLoading} creating={pendingAction === "create"}
        disabled={busy || modalOpen || collection.isLoading || Boolean(collection.error)}
      />
      {actionError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Questionnaire operation could not be completed</p>
            <p className="mt-1">{actionError}</p>
          </div>
        </div>
      )}
      {!selectedId ? (
        <section className={`${panelClass} flex min-h-64 flex-col items-center justify-center gap-4 text-center`}>
          <div className="rounded-2xl bg-gray-50 p-5"><ClipboardList className="h-10 w-10 text-gray-300" /></div>
          <h2 className="text-lg font-semibold text-gray-700">Select a Potential Questionnaire</h2>
          <p className="max-w-lg text-sm leading-6 text-gray-500">
            Choose an employee and review cycle to initialize or customize a questionnaire, or select an existing assessment to manage its configuration.
          </p>
        </section>
      ) : detail.isLoading ? (
        <section className={`${panelClass} flex min-h-64 flex-col items-center justify-center gap-3`}>
          <Loader2 className="h-8 w-8 animate-spin text-[#F6490D]" />
          <p className="text-sm text-gray-500">Loading Potential questionnaire...</p>
        </section>
      ) : detail.error && !questionnaire ? (
        <section className={`${panelClass} flex min-h-48 flex-col items-center justify-center gap-3 text-center`}>
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-red-600">{detail.error.message || "Unable to load questionnaire."}</p>
          <Button variant="outline" onClick={() => detail.refetch()}>Retry</Button>
        </section>
      ) : workspaceReady ? (
        <>
          <AssessmentSummary questionnaire={questionnaire} />
          <ConfigurationSummary questionnaire={questionnaire} draftState={draftState} />
          <QuestionnaireActionBar
            questionnaire={questionnaire} dirty={draftState.dirty}
            locked={draftState.locked} conflict={draftState.serverConflict}
            requiresReload={draftState.requiresReload}
            busy={busy || modalOpen} pendingAction={pendingAction}
            onSave={saveDraft} onSync={synchronize} onReset={resetQuestionnaire}
            onCopy={openCopyDialog} onPublish={publishQuestionnaire}
            onDiscard={discardChanges} onReload={reloadQuestionnaire}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Layers3 className="h-4 w-4 text-[#F6490D]" />Questionnaire Customization Workspace
            </div>
            {questionnaire.is_published && (
              <span className="text-xs text-gray-500">Changes become active only after publication</span>
            )}
          </div>
          <div className={`grid items-start gap-6 ${draftState.locked ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]"}`}>
            {!draftState.locked && (
              <AvailableQuestionPanel
                key={`available-${selectedId}`} questions={availableQuestions}
                includedIds={draftState.includedIds} excludedIds={draftState.excludedIds}
                onAdd={draftState.addQuestion} onAddMultiple={draftState.addQuestions}
                loading={available.isLoading} disabled={editingDisabled}
                error={available.error} onRetry={() => available.refetch()}
              />
            )}
            <QuestionnaireWorkspace
              key={`workspace-${selectedId}`} items={draft.items}
              availableQuestions={availableQuestions} stats={draftState.stats}
              excludedCount={draft.excludedParameterIds.length}
              onAddMultiple={draftState.addQuestions}
              onRemove={draftState.removeQuestion} onWeightageChange={draftState.changeWeightage}
              onRestoreWeightage={draftState.restoreWeightage} onReorder={draftState.reorder}
              disabled={editingDisabled} locked={draftState.locked}
            />
          </div>
        </>
      ) : (
        <section className={`${panelClass} flex min-h-48 items-center justify-center gap-3 text-sm text-gray-500`}>
          <Loader2 className="h-5 w-5 animate-spin text-[#F6490D]" />Preparing questionnaire workspace...
        </section>
      )}
      <CopyQuestionnaireDialog
        open={copyOpen} onClose={() => !busy && setCopyOpen(false)}
        questionnaires={questionnaires} currentId={selectedId}
        onCopy={copyQuestionnaire} saving={pendingAction === "copy"}
      />
      <ConfirmationDialog
        confirmation={confirmation} busy={busy}
        onConfirm={confirmAction} onCancel={closeConfirmation}
      />
      <PotentialResetConfirmationDialog
        confirmation={resetConfirmation} busy={busy}
        onConfirm={confirmPotentialReset} onCancel={cancelPotentialReset}
      />
    </div>
  );
}