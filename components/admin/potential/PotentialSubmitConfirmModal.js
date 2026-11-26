"use client";

import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function PotentialSubmitConfirmModal({
  open, employeeName, evaluatorLabel, loading,
  onCancel, onConfirm, progress
}) {
  return (
    <Dialog open={open} onOpenChange={value => !value && !loading && onCancel()}>
      <DialogContent className="rounded-[28px] sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1EC]"><ShieldCheck className="h-6 w-6 text-[#F6490D]" /></div>
          <DialogTitle className="text-xl font-semibold text-[#111827]">Submit Potential Questionnaire?</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-gray-600">
            You are about to submit the <span className="font-semibold text-gray-900">{evaluatorLabel}</span> Potential questionnaire for <span className="font-semibold text-gray-900">{employeeName || "this employee"}</span>.
          </DialogDescription>
        </DialogHeader>
        {progress && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-gray-50 p-4">
            <div><p className="text-xs text-gray-500">Objective responses</p><p className="mt-1 text-lg font-bold text-gray-900">{progress.objectiveAnswered}/{progress.objective}</p></div>
            <div><p className="text-xs text-gray-500">Descriptive responses</p><p className="mt-1 text-lg font-bold text-gray-900">{progress.descriptiveAnswered}/{progress.descriptive}</p></div>
          </div>
        )}
        <div className="flex items-start gap-3 rounded-2xl border border-[#F6490D]/20 bg-[#FFF7F4] p-4 text-sm text-[#9A3412]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="leading-6">Please verify all numerical ratings and written evaluations. Once submitted, your evaluation will be final and cannot be edited.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={loading} onClick={onCancel}>Cancel</Button>
          <Button className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={loading || Boolean(progress?.remaining)} onClick={onConfirm}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{loading ? "Submitting..." : "Yes, Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}