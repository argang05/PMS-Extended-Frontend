"use client";

import {
  Save, RefreshCw, RotateCcw, Copy, Send, Loader2,
  LockKeyhole, AlertTriangle, CheckCircle2, CircleDashed,
  Undo2, ShieldCheck, FilePenLine, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getQuestionnaireStatus, getQuestionnaireActivation,
  hasPendingCustomization
} from "@/lib/potential/questionnaireUtils";

export default function QuestionnaireActionBar({
  questionnaire, dirty, locked, conflict, requiresReload,
  busy = false, pendingAction, onSave, onSync, onReset,
  onCopy, onPublish, onDiscard, onReload
}) {
  const status = getQuestionnaireStatus(questionnaire?.status);
  const activation = getQuestionnaireActivation(questionnaire);
  const hasPendingDraft = hasPendingCustomization(questionnaire);
  const isActive = Boolean(questionnaire?.is_published);
  const hasExistingEvaluation = Boolean(
    questionnaire?.has_responses ||
    questionnaire?.rm_submitted ||
    questionnaire?.skip_submitted ||
    questionnaire?.reset_requirements?.requires_reset
  );
  const blocked = busy || locked || conflict || requiresReload;
  const icon = (action, Icon) => pendingAction === action
    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    : <Icon className="mr-2 h-4 w-4" />;

  return (
    <section className="space-y-4 rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h2 className="font-semibold text-gray-900">Questionnaire Controls</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`${activation.className} border-0`}>
              <ShieldCheck className="mr-1 h-3 w-3" />{activation.label}
            </Badge>
            <Badge className={`${status.className} border-0`}>{status.label}</Badge>
            {locked ? (
              <Badge className="border-0 bg-amber-50 text-amber-700">
                <LockKeyhole className="mr-1 h-3 w-3" />Read Only
              </Badge>
            ) : dirty ? (
              <Badge className="border-0 bg-amber-50 text-amber-700">
                <CircleDashed className="mr-1 h-3 w-3" />Unsaved Changes
              </Badge>
            ) : (
              <Badge className="border-0 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />All Changes Saved
              </Badge>
            )}
            {hasPendingDraft && (
              <Badge className="border-0 bg-violet-50 text-violet-700">
                <FilePenLine className="mr-1 h-3 w-3" />Customization Draft Saved
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={onReload}>
          {icon("reload", RefreshCw)}Reload
        </Button>
      </div>
      {conflict && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Questionnaire revision conflict</p>
            <p className="mt-1 text-xs leading-5">
              The questionnaire or its evaluation has changed on the server. Your unsaved edits have been retained locally. Reload the latest configuration before continuing.
            </p>
          </div>
        </div>
      )}
      {requiresReload && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Changes saved, refresh required</p>
            <p className="mt-1 text-xs leading-5">
              The backend operation succeeded, but the latest questionnaire could not be retrieved. Reload before making further changes.
            </p>
          </div>
        </div>
      )}
      {locked ? (
        <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
          This questionnaire is currently read-only. Administrative changes are unavailable.
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-800">
            <Info className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{isActive ? "Active questionnaire remains protected" : "Questionnaire is not yet active"}</p>
              <p className="mt-1 text-xs leading-5">
                {isActive
                  ? "You can freely customize this questionnaire. Saving, synchronizing, copying or resetting the draft will not change the questionnaire currently being evaluated by managers. Only publication activates the changes."
                  : "Eligible employees normally receive automatically configured Potential questionnaires. If no valid default questionnaire is available, configure the required questions and publish manually."}
              </p>
            </div>
          </div>
          {hasExistingEvaluation && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Existing Potential evaluation data detected</p>
                <p className="mt-1 text-xs leading-5">
                  You can continue editing and saving the customization draft safely. Publishing a changed questionnaire may require resetting existing Potential responses and dependent results. You will be asked for confirmation before any reset.
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={blocked || !dirty} onClick={onSave}>
              {icon("save", Save)}Save Draft
            </Button>
            <Button variant="outline" disabled={blocked} onClick={onSync}>
              {icon("sync", RefreshCw)}Synchronize
            </Button>
            <Button variant="outline" disabled={blocked} onClick={onCopy}>
              {icon("copy", Copy)}Copy Questionnaire
            </Button>
            <Button variant="outline" disabled={blocked} onClick={onReset}>
              {icon("reset", RotateCcw)}Reset to Automatic
            </Button>
            <Button variant="outline" disabled={busy || !dirty || requiresReload || conflict} onClick={onDiscard}>
              <Undo2 className="mr-2 h-4 w-4" />Discard Changes
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={blocked} onClick={onPublish}>
              {icon("publish", Send)}{isActive ? "Publish Changes" : "Publish Questionnaire"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}