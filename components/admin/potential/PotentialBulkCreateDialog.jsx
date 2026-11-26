"use client";

import { useEffect, useRef, useState } from "react";
import { FileJson, Upload, Loader2, CheckCircle2, Copy, AlertCircle, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parsePotentialBulkQuestions, POTENTIAL_BULK_EXAMPLE } from "@/lib/potential/questionBankUtils";

export default function PotentialBulkCreateDialog({ open, onClose, onSave, saving = false }) {
  const [raw, setRaw] = useState("");
  const [validated, setValidated] = useState(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fileVersionRef = useRef(0);
  const busy = saving || submitting || readingFile;

  useEffect(() => {
    fileVersionRef.current += 1;
    if (open) {
      setRaw("");
      setValidated(null);
      setError("");
      setFileName("");
      setReadingFile(false);
    }
    return () => { fileVersionRef.current += 1; };
  }, [open]);

  const update = (value, name = "") => {
    setRaw(value);
    setValidated(null);
    setError("");
    setFileName(name);
  };
  const validate = () => {
    try {
      const questions = parsePotentialBulkQuestions(raw);
      setValidated(questions);
      setError("");
      return questions;
    } catch (error) {
      setValidated(null);
      setError(error.message);
      return null;
    }
  };
  const save = async () => {
    if (busy || submittingRef.current) return;
    const questions = validate();
    if (!questions) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSave(questions);
      onClose();
    } catch (error) {
      setError(error.message || "Bulk creation failed.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const loadFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please select a valid .json file.");
      return;
    }
    const version = ++fileVersionRef.current;
    setReadingFile(true);
    setError("");
    try {
      const content = await file.text();
      if (version !== fileVersionRef.current) return;
      update(content, file.name);
    } catch {
      if (version === fileVersionRef.current) setError("Unable to read the selected JSON file.");
    } finally {
      if (version === fileVersionRef.current) setReadingFile(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => !value && !busy && onClose()}>
      <DialogContent className="!flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl" onEscapeKeyDown={event => busy && event.preventDefault()} onInteractOutside={event => busy && event.preventDefault()}>
        <DialogHeader className="shrink-0 border-b border-gray-100 px-6 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
            <span className="rounded-xl bg-[#FFF1EC] p-2.5"><FileJson className="h-5 w-5 text-[#F6490D]" /></span>
            Bulk Create Potential Questions
          </DialogTitle>
          <DialogDescription className="pt-1 text-sm leading-6 text-gray-500">
            Paste or upload a JSON array containing only question text. You can import up to 500 questions at once.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-800">Automatic Default Configuration</p>
              <p className="text-xs leading-5 text-blue-700">Questions are created as active objective questions with weightage 1, maximum marks 10 and manual assignment. Configure categories, question types and targeting later using Edit Question or Bulk Configure.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => update(POTENTIAL_BULK_EXAMPLE)}>
              <Copy className="mr-2 h-4 w-4" />Load Example
            </Button>
            <label className={`inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm transition-colors ${busy ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
              {readingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {readingFile ? "Reading File..." : "Upload JSON"}
              <input type="file" accept=".json,application/json" className="hidden" disabled={busy} onChange={loadFile} />
            </label>
            {fileName && <Badge variant="outline" className="max-w-full truncate">{fileName}</Badge>}
          </div>
          <div className="space-y-2">
            <label htmlFor="potential-bulk-json" className="text-sm font-medium text-gray-700">Questions JSON</label>
            <Textarea id="potential-bulk-json" className="h-52 min-h-52 resize-y rounded-xl border-gray-200 bg-gray-50 font-mono text-xs leading-6 focus-visible:ring-[#F6490D]/30" value={raw} disabled={busy} placeholder={POTENTIAL_BULK_EXAMPLE} spellCheck={false} onChange={event => update(event.target.value)} />
            <p className="text-xs text-gray-500">Expected format: ["Question one", "Question two", "Question three"]</p>
          </div>
          <Button type="button" variant="outline" disabled={!raw.trim() || busy} onClick={validate}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Validate JSON
          </Button>
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p className="break-words">{error}</p>
            </div>
          )}
          {validated && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Validation Successful</p>
                <Badge className="border-0 bg-emerald-100 text-emerald-800">{validated.length} questions</Badge>
              </div>
              <div className="max-h-60 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {validated.map((question, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFF1EC] text-xs font-semibold text-[#F6490D]">{index + 1}</span>
                    <p className="min-w-0 break-words text-sm leading-6 text-gray-800">{question.question_text}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-5 text-emerald-700">All questions are ready to be added to the Potential Question Bank with default configuration.</p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-gray-100 bg-white px-6 py-4">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={busy || !raw.trim()} onClick={save}>
            {saving || submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {saving || submitting ? "Creating Questions..." : validated ? `Create ${validated.length} Questions` : "Create Questions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}