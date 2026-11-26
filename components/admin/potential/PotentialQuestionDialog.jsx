"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, LockKeyhole, BrainCircuit, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import TargetingSelector from "./TargetingSelector";
import { emptyPotentialQuestion, questionToForm, validatePotentialQuestion, buildPotentialQuestionPayload } from "@/lib/potential/questionBankUtils";

export default function PotentialQuestionDialog({
  open, onClose, question, targetingOptions, onSave,
  onPreview, saving = false, previewLoading = false
}) {
  const [form, setForm] = useState(emptyPotentialQuestion);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [configureNow, setConfigureNow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const editing = Boolean(question?.id);
  const locked = Boolean(question?.is_published_used);
  const busy = saving || submitting;

  useEffect(() => {
    if (!open) return;
    setForm(question ? questionToForm(question) : emptyPotentialQuestion());
    setConfigureNow(Boolean(question));
    setErrors({});
    setServerError("");
  }, [open, question]);

  const update = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setServerError("");
  };
  const save = async event => {
    event.preventDefault();
    if (busy || submittingRef.current) return;
    const current = !editing && !configureNow ? {
      ...form, target_mode: "manual", departments: [], employee_ids: [], excluded_employee_ids: []
    } : form;
    const validation = validatePotentialQuestion(current, { allowLegacy: editing });
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setServerError("");
    let payload = buildPotentialQuestionPayload(current);
    if (locked) {
      const { question_text, question_type, max_marks, weightage, ...editable } = payload;
      payload = editable;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      setServerError(error.message || "Unable to save question.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const fieldError = field => errors[field] && <p className="text-xs text-red-600">{errors[field]}</p>;

  return (
    <Dialog open={open} onOpenChange={value => !value && !busy && onClose()}>
      <DialogContent className="!flex max-h-[90dvh] w-[calc(100%-2rem)] min-w-0 flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl" onEscapeKeyDown={event => busy && event.preventDefault()} onInteractOutside={event => busy && event.preventDefault()}>
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
            <span className="rounded-xl bg-[#FFF1EC] p-2.5"><BrainCircuit className="h-5 w-5 text-[#F6490D]" /></span>
            {editing ? "Edit Potential Question" : "Create Potential Question"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-gray-500">Manage question content, scoring and employee targeting.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-5">
            {locked && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                <LockKeyhole className="mt-1 h-4 w-4 shrink-0" />
                <p>This question is used in a published questionnaire. Structural fields are protected to preserve historical evaluation integrity.</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Question Text</label>
              <Textarea rows={4} className="w-full min-w-0 resize-y rounded-xl" value={form.question_text} disabled={locked || busy} placeholder="Enter the Potential evaluation question..." onChange={event => update("question_text", event.target.value)} />
              {fieldError("question_text")}
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-3">
              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium">Question Type</label>
                <select className="h-10 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm" value={form.question_type} disabled={locked || busy} onChange={event => {
                  const type = event.target.value;
                  setForm(previous => ({ ...previous, question_type: type, max_marks: type === "descriptive" ? 10 : previous.max_marks }));
                  setErrors(previous => ({ ...previous, question_type: undefined, max_marks: undefined }));
                }}>
                  <option value="objective">Objective</option>
                  <option value="descriptive">Descriptive</option>
                </select>
                {fieldError("question_type")}
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium">Default Weightage</label>
                <Input type="number" min="0.01" step="any" value={form.weightage} disabled={locked || busy} onChange={event => update("weightage", event.target.value)} />
                {fieldError("weightage")}
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-sm font-medium">Maximum Marks</label>
                <Input type="number" min="1" step="1" value={form.max_marks} disabled={locked || busy || form.question_type === "descriptive"} onChange={event => update("max_marks", event.target.value)} />
                {fieldError("max_marks")}
              </div>
            </div>
            {form.question_type === "descriptive" && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs leading-5 text-blue-700">
                Managers provide written responses. Admin descriptive marks contribute to the Potential score only when Potential descriptive scoring is enabled for that assessment.
              </div>
            )}
            <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">Active Question</p>
                <p className="mt-1 text-xs text-gray-500">Available for future questionnaire assignments.</p>
              </div>
              <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#F6490D]" checked={form.is_active} disabled={busy} onChange={event => update("is_active", event.target.checked)} />
            </label>
            {!editing && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Assignment Configuration</p>
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <button type="button" disabled={busy} className={`min-w-0 rounded-xl border p-4 text-left transition-all ${!configureNow ? "border-[#F6490D] bg-[#FFF1EC]" : "hover:bg-gray-50"}`} onClick={() => setConfigureNow(false)}>
                    <p className="text-sm font-semibold">Configure Later</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">Save to Question Bank only.</p>
                    <Badge className="mt-2" variant="secondary">Default</Badge>
                  </button>
                  <button type="button" disabled={busy} className={`min-w-0 rounded-xl border p-4 text-left transition-all ${configureNow ? "border-[#F6490D] bg-[#FFF1EC]" : "hover:bg-gray-50"}`} onClick={() => setConfigureNow(true)}>
                    <p className="text-sm font-semibold">Configure Now</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">Set automatic employee targeting.</p>
                  </button>
                </div>
              </div>
            )}
            {configureNow && (
              <div className="min-w-0 max-w-full [&>*]:min-w-0 [&_select]:max-w-full [&_p]:whitespace-normal [&_p]:break-words">
                <TargetingSelector value={form} onChange={setForm} options={targetingOptions} disabled={busy} onPreview={onPreview} previewLoading={previewLoading} />
              </div>
            )}
            {["target_mode", "departments", "employee_ids"].filter(field => errors[field]).map(field => <div key={field}>{fieldError(field)}</div>)}
            {serverError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p className="min-w-0 break-words">{serverError}</p></div>}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-gray-100 bg-white px-6 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {busy ? "Saving..." : editing ? "Save Changes" : "Create Question"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}