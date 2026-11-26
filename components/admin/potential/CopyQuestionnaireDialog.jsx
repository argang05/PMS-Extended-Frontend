"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Search, Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getQuestionnaireStatus } from "@/lib/potential/questionnaireUtils";

export default function CopyQuestionnaireDialog({
  open, onClose, questionnaires = [], currentId,
  onCopy, saving = false
}) {
  const [search, setSearch] = useState("");
  const [sourceId, setSourceId] = useState(null);
  const [copyWeightages, setCopyWeightages] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
      setSourceId(null);
      setCopyWeightages(true);
      setError("");
    }
  }, [open]);

  const filtered = useMemo(() => questionnaires.filter(questionnaire => {
    if (Number(questionnaire.id) === Number(currentId)) return false;
    const term = search.trim().toLowerCase();
    return [
      questionnaire.id, questionnaire.employee?.full_name,
      questionnaire.employee?.employee_number, questionnaire.employee?.department,
      questionnaire.review_cycle?.name, questionnaire.employee_name,
      questionnaire.review_cycle_name
    ].join(" ").toLowerCase().includes(term);
  }), [questionnaires, currentId, search]);

  const copy = async () => {
    if (!sourceId || saving) return;
    setError("");
    try {
      await onCopy(sourceId, copyWeightages);
      onClose();
    } catch (error) {
      setError(error.message || "Unable to copy questionnaire.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={value => !value && !saving && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5 text-[#F6490D]" />Copy Potential Questionnaire</DialogTitle>
          <DialogDescription>Select an existing questionnaire to reuse its question configuration.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Copying replaces the current draft questionnaire configuration. Evaluation responses, marks and calculated results are not copied.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input className="pl-9" placeholder="Search employee, review cycle or assessment ID..." value={search} disabled={saving} onChange={event => setSearch(event.target.value)} />
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {filtered.map(questionnaire => {
              const active = Number(sourceId) === Number(questionnaire.id);
              const status = getQuestionnaireStatus(questionnaire.status);
              return (
                <button type="button" key={questionnaire.id} disabled={saving} onClick={() => setSourceId(questionnaire.id)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all ${active ? "border-[#F6490D] bg-[#FFF1EC]" : "hover:bg-gray-50"}`}>
                  <div>
                    <p className="text-sm font-semibold">{questionnaire.employee?.full_name || questionnaire.employee_name || "Employee"}</p>
                    <p className="mt-1 text-xs text-gray-500">{questionnaire.review_cycle?.name || questionnaire.review_cycle_name} · Assessment #{questionnaire.id}</p>
                  </div>
                  <Badge className={`${status.className} border-0`}>{status.label}</Badge>
                </button>
              );
            })}
            {!filtered.length && <p className="py-8 text-center text-sm text-gray-500">No source questionnaires available.</p>}
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <p className="text-sm font-medium">Copy customized weightages</p>
              <p className="text-xs text-gray-500">Disable to use Question Bank default weightages instead.</p>
            </div>
            <input type="checkbox" className="h-5 w-5 accent-[#F6490D]" checked={copyWeightages} disabled={saving} onChange={event => setCopyWeightages(event.target.checked)} />
          </label>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={!sourceId || saving} onClick={copy}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}Copy Questionnaire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}