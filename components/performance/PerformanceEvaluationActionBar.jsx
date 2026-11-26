"use client";

import { Save, Send, Undo2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function PerformanceSubmitConfirmModal({ open, onCancel, onConfirm, evaluation, role }) {
  const submitting = evaluation.pendingAction === "submit";
  return (
    <Dialog open={open} onOpenChange={value => !value && !submitting && onCancel()}>
      <DialogContent className="rounded-[24px] sm:max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1EC]">
            <Send className="h-6 w-6 text-[#F6490D]" />
          </div>
          <DialogTitle className="text-xl font-semibold">Confirm Final Submission</DialogTitle>
          <DialogDescription className="leading-6">
            Are you sure you want to submit your {evaluation.config.label.toLowerCase()} evaluation?
            {role !== "self" && evaluation.assessment?.employee_name ? ` This evaluation is for ${evaluation.assessment.employee_name}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {evaluation.progress.answered} of {evaluation.progress.total} questions completed.
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            Once submitted, your responses will become read-only and the existing review workflow will proceed.
          </div>
        </div>
        <DialogFooter className="mt-3 gap-2">
          <Button variant="outline" disabled={submitting} onClick={onCancel}>Cancel</Button>
          <Button className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={submitting} onClick={onConfirm}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {submitting ? "Submitting..." : "Confirm Submission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PerformanceEvaluationActionBar({ evaluation, onDiscard, onSave, onSubmit }) {
  if (evaluation.submitted || !evaluation.assessment?.id) return null;
  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-gray-100 bg-white/95 p-4 shadow-[0_8px_35px_rgba(0,0,0,0.15)] backdrop-blur">
      <div>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${evaluation.dirty ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
          <p className="text-sm font-semibold text-[#111827]">{evaluation.progress.answered} of {evaluation.progress.total} questions answered</p>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {evaluation.requiresReload ? "Reload required before continuing." : evaluation.dirty ? "You have unsaved changes." : "No unsaved changes."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!evaluation.editable || !evaluation.dirty} onClick={onDiscard}>
          <Undo2 className="mr-2 h-4 w-4" />Discard
        </Button>
        <Button variant="outline" disabled={!evaluation.editable || !evaluation.dirty} onClick={onSave}>
          {evaluation.pendingAction === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {evaluation.pendingAction === "save" ? "Saving..." : "Save Draft"}
        </Button>
        <Button className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={!evaluation.editable || !evaluation.progress.total} onClick={onSubmit}>
          {evaluation.pendingAction === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit Questionnaire
        </Button>
      </div>
    </div>
  );
}