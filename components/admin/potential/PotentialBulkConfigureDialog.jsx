"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2, Loader2, Save, AlertCircle, LockKeyhole, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import TargetingSelector from "./TargetingSelector";
import { emptyPotentialQuestion, buildTargetingPayload } from "@/lib/potential/questionBankUtils";

const EMPTY_CHANGES = { question_type: false, weightage: false, max_marks: false, targeting: false, is_active: false };
const selectClass = "h-10 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#F6490D]";

function ConfigurationSection({ label, description, checked, disabled, onChange, children }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200">
      <label className={`flex items-start gap-3 p-4 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#F6490D]" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {description && <p className="mt-1 break-words text-xs leading-5 text-gray-500">{description}</p>}
        </div>
      </label>
      {checked && <div className="min-w-0 space-y-3 border-t border-gray-100 bg-gray-50/40 p-4">{children}</div>}
    </div>
  );
}

export default function PotentialBulkConfigureDialog({
  open, onClose, questions = [], targetingOptions,
  onSave, onPreview, saving = false, previewLoading = false
}) {
  const [form, setForm] = useState(emptyPotentialQuestion);
  const [changes, setChanges] = useState(EMPTY_CHANGES);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const busy = saving || submitting;
  const hasPublished = questions.some(question => question.is_published_used);
  const hasChanges = Object.values(changes).some(Boolean);
  const effectiveTypes = questions.map(question => changes.question_type ? form.question_type : question.question_type);
  const includesDescriptive = effectiveTypes.includes("descriptive");
  const allDescriptive = effectiveTypes.length > 0 && effectiveTypes.every(type => type === "descriptive");

  useEffect(() => {
    if (!open) return;
    setForm(emptyPotentialQuestion());
    setChanges({ ...EMPTY_CHANGES });
    setError("");
  }, [open]);

  const update = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setError("");
  };
  const toggle = (field, checked) => {
    setChanges(previous => ({ ...previous, [field]: checked }));
    setError("");
  };
  const updateType = type => {
    setForm(previous => ({ ...previous, question_type: type, max_marks: type === "descriptive" ? 10 : previous.max_marks }));
    setError("");
  };
  const save = async () => {
    if (busy || submittingRef.current) return;
    setError("");
    if (!questions.length) return setError("Select at least one question.");
    if (questions.length > 500) return setError("Select a maximum of 500 questions per request.");
    if (!hasChanges) return setError("Select at least one configuration to update.");
    if (hasPublished && (changes.question_type || changes.weightage || changes.max_marks)) return setError("Published questions cannot have their structural fields changed.");
    const configuration = {};
    if (changes.question_type) {
      configuration.question_type = form.question_type;
      if (form.question_type === "descriptive") configuration.max_marks = 10;
    }
    if (changes.weightage) {
      const weightage = Number(form.weightage);
      if (!Number.isFinite(weightage) || weightage <= 0) return setError("Weightage must be greater than zero.");
      configuration.weightage = weightage;
    }
    if (changes.max_marks) {
      const marks = Number(form.max_marks);
      if (!Number.isInteger(marks) || marks < 1) return setError("Maximum marks must be a positive integer.");
      if (includesDescriptive && marks !== 10) return setError("Descriptive questions must have a maximum of 10 marks.");
      configuration.max_marks = marks;
    }
    if (changes.targeting) {
      const mode = form.target_mode;
      if (["departments", "combined"].includes(mode) && !form.departments.length) return setError("Select at least one department.");
      if (["employees", "combined"].includes(mode) && !form.employee_ids.length) return setError("Select at least one employee.");
      Object.assign(configuration, buildTargetingPayload(form));
    }
    if (changes.is_active) configuration.is_active = Boolean(form.is_active);
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSave(questions.map(question => Number(question.id)), configuration);
      onClose();
    } catch (error) {
      setError(error.message || "Bulk configuration failed.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => !value && !busy && onClose()}>
      <DialogContent className="!flex max-h-[90dvh] w-[calc(100%-2rem)] min-w-0 flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl" onEscapeKeyDown={event => busy && event.preventDefault()} onInteractOutside={event => busy && event.preventDefault()}>
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
            <span className="rounded-xl bg-[#FFF1EC] p-2.5"><Settings2 className="h-5 w-5 text-[#F6490D]" /></span>
            Bulk Configure Potential Questions
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-gray-500">Choose which properties to update. Unselected properties remain unchanged.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-5">
          <Badge className="bg-[#FFF1EC] text-[#F6490D]">{questions.length} questions selected</Badge>
          <div className="max-h-36 min-w-0 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
            {questions.map(question => (
              <div key={question.id} className="flex min-w-0 items-start gap-2 text-xs leading-5 text-gray-600">
                <span className="shrink-0 font-semibold">#{question.id}</span>
                <p className="min-w-0 flex-1 whitespace-normal break-words [overflow-wrap:anywhere]">{question.question_text}</p>
                <Badge variant="outline" className="shrink-0">{question.question_type}</Badge>
              </div>
            ))}
          </div>
          {hasPublished && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Published questions are included in this selection. Question type, weightage and maximum marks are protected. Select only unpublished questions to modify these fields.</p>
            </div>
          )}
          <ConfigurationSection label="Update Question Type" description="Convert selected questions to objective or descriptive." checked={changes.question_type} disabled={busy || hasPublished} onChange={checked => toggle("question_type", checked)}>
            <select className={selectClass} value={form.question_type} disabled={busy} onChange={event => updateType(event.target.value)}>
              <option value="objective">Objective</option>
              <option value="descriptive">Descriptive</option>
            </select>
            {form.question_type === "descriptive" && <p className="text-xs leading-5 text-gray-500">Selected questions will accept written responses. Maximum marks will automatically be set to 10.</p>}
          </ConfigurationSection>
          <ConfigurationSection label="Update Weightage" description="Set a common default weightage for selected questions." checked={changes.weightage} disabled={busy || hasPublished} onChange={checked => toggle("weightage", checked)}>
            <Input type="number" min="0.01" step="any" value={form.weightage} disabled={busy} onChange={event => update("weightage", event.target.value)} />
          </ConfigurationSection>
          <ConfigurationSection label="Update Maximum Marks" description="Set the maximum score available for each question." checked={changes.max_marks} disabled={busy || hasPublished} onChange={checked => {
            toggle("max_marks", checked);
            if (checked && includesDescriptive) update("max_marks", 10);
          }}>
            <Input type="number" min="1" step="1" value={allDescriptive ? 10 : form.max_marks} disabled={busy || allDescriptive} onChange={event => update("max_marks", event.target.value)} />
            {includesDescriptive && <p className="text-xs text-gray-500">Descriptive questions require a maximum of 10 marks.</p>}
          </ConfigurationSection>
          <ConfigurationSection label="Update Employee Targeting" description="Control whose Potential questionnaire receives these questions." checked={changes.targeting} disabled={busy} onChange={checked => toggle("targeting", checked)}>
            <div className="min-w-0 max-w-full [&>*]:min-w-0 [&_select]:max-w-full [&_input]:max-w-full [&_p]:whitespace-normal [&_p]:break-words">
              <TargetingSelector value={form} onChange={setForm} options={targetingOptions} disabled={busy} onPreview={onPreview} previewLoading={previewLoading} />
            </div>
          </ConfigurationSection>
          <ConfigurationSection label="Update Active Status" description="Activate or deactivate selected questions." checked={changes.is_active} disabled={busy} onChange={checked => toggle("is_active", checked)}>
            <select className={selectClass} value={String(form.is_active)} disabled={busy} onChange={event => update("is_active", event.target.value === "true")}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </ConfigurationSection>
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs leading-5 text-blue-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Changes affect future assignments. Published questionnaire snapshots and completed evaluation responses remain unchanged.</p>
          </div>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p className="min-w-0 break-words">{error}</p></div>}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={busy || !questions.length || !hasChanges} onClick={save}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {busy ? "Applying Configuration..." : "Apply Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}