"use client";

import { useMemo, useState } from "react";
import { Search, Plus, BookOpen, Loader2, RotateCcw, CheckCircle2, FilterX, GripVertical, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { filterBuilderQuestions } from "@/lib/potential/questionnaireUtils";

const INITIAL_FILTERS = { search: "", type: "all" };
const INCLUDE_DRAG_TYPE = "application/x-potential-question-include";

export default function AvailableQuestionPanel({
  questions = [], includedIds, excludedIds, onAdd, onAddMultiple,
  loading = false, disabled = false, error, onRetry
}) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [showIncluded, setShowIncluded] = useState(false);
  const [selected, setSelected] = useState([]);
  const [draggedIds, setDraggedIds] = useState([]);
  const filtered = useMemo(() => filterBuilderQuestions(questions, filters).filter(question =>
    showIncluded || !includedIds.has(Number(question.parameter_id))
  ), [questions, filters, showIncluded, includedIds]);
  const selectable = filtered.filter(question => !includedIds.has(Number(question.parameter_id)) && question.is_active !== false);
  const selectedSet = new Set(selected.map(Number));
  const selectedQuestions = selectable.filter(question => selectedSet.has(Number(question.parameter_id)));
  const allSelected = selectable.length > 0 && selectable.every(question => selectedSet.has(Number(question.parameter_id)));

  const updateFilter = (field, value) => setFilters(previous => ({ ...previous, [field]: value }));
  const toggle = id => {
    const numericId = Number(id);
    setSelected(previous => previous.includes(numericId) ? previous.filter(value => value !== numericId) : [...previous, numericId]);
  };
  const toggleAll = () => {
    const ids = selectable.map(question => Number(question.parameter_id));
    setSelected(previous => allSelected ? previous.filter(id => !ids.includes(id)) : [...new Set([...previous, ...ids])]);
  };
  const addSelected = () => {
    if (disabled || !selectedQuestions.length) return;
    onAddMultiple(selectedQuestions);
    setSelected([]);
  };
  const startDrag = (event, question) => {
    const id = Number(question.parameter_id);
    if (disabled || includedIds.has(id) || question.is_active === false) {
      event.preventDefault();
      return;
    }
    const dragQuestions = selectedSet.has(id) && selectedQuestions.length > 1 ? selectedQuestions : [question];
    const ids = dragQuestions.map(item => Number(item.parameter_id));
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(INCLUDE_DRAG_TYPE, JSON.stringify(ids));
    event.dataTransfer.setData("text/plain", ids.length === 1 ? question.question_text : `${ids.length} Potential questions`);
    setDraggedIds(ids);
  };
  const endDrag = () => {
    setDraggedIds([]);
  };

  return (
    <section className="min-w-0 space-y-4 rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3"><BookOpen className="h-5 w-5 text-blue-600" /></div>
          <div>
            <h2 className="font-semibold text-gray-900">Available Questions</h2>
            <p className="text-xs text-gray-500">{questions.length} Question Bank entries</p>
          </div>
        </div>
        <Badge variant="secondary">{filtered.length}</Badge>
      </div>
      {!disabled && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-100 bg-[#FFF5F0] p-3 text-xs leading-5 text-[#B83C10]">
          <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Drag questions into the workspace to include them. Select multiple questions to drag them together.</span>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input className="rounded-xl pl-9" value={filters.search} placeholder="Search available questions..." onChange={event => updateFilter("search", event.target.value)} />
      </div>
      <select className="h-9 w-full min-w-0 rounded-lg border bg-white px-3 text-xs" value={filters.type} onChange={event => updateFilter("type", event.target.value)}>
        <option value="all">All Question Types</option>
        <option value="objective">Objective</option>
        <option value="descriptive">Descriptive</option>
      </select>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" className="h-4 w-4 accent-[#F6490D]" checked={showIncluded} onChange={event => setShowIncluded(event.target.checked)} />Show included
        </label>
        <Button variant="ghost" size="sm" onClick={() => setFilters(INITIAL_FILTERS)}><FilterX className="mr-1 h-3 w-3" />Clear</Button>
      </div>
      {!disabled && selectable.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-gray-50 p-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="h-4 w-4 accent-[#F6490D]" checked={allSelected} onChange={toggleAll} />Select filtered
          </label>
          <Button size="sm" className="bg-[#F6490D] text-white hover:bg-[#DD400B]" disabled={!selectedQuestions.length} onClick={addSelected}><Plus className="mr-1 h-3 w-3" />Add {selectedQuestions.length || ""} Selected</Button>
        </div>
      )}
      {error && (
        <div className="space-y-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <p>{error.message || "Unable to load available questions."}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
        </div>
      )}
      <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin" />Loading questions...</div>
        ) : filtered.map(question => {
          const id = Number(question.parameter_id);
          const included = includedIds.has(id);
          const excluded = excludedIds.has(id);
          const inactive = question.is_active === false;
          const draggable = !disabled && !included && !inactive;
          const dragging = draggedIds.includes(id);
          const checked = selectedSet.has(id) && draggable;
          return (
            <div key={id} draggable={draggable} onDragStart={event => startDrag(event, question)} onDragEnd={endDrag}
              className={`space-y-3 rounded-xl border p-4 transition-all duration-200 hover:shadow-sm ${included ? "bg-emerald-50/30" : excluded ? "border-amber-200 bg-amber-50/30" : "bg-[#FCFCFD]"} ${draggable ? "cursor-grab hover:border-[#F6490D]/50 active:cursor-grabbing" : ""} ${checked ? "border-[#F6490D]/60 bg-orange-50/30" : ""} ${dragging ? "scale-[0.98] opacity-40" : ""}`}>
              <div className="flex items-start gap-2">
                {draggable && (
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[#F6490D]" checked={checked} onChange={() => toggle(id)} onDragStart={event => event.preventDefault()} />
                    <GripVertical className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline">#{id}</Badge>
                    <Badge className={question.question_type === "descriptive" ? "border-0 bg-purple-50 text-purple-700" : "border-0 bg-blue-50 text-blue-700"}>{question.question_type === "descriptive" ? "Descriptive" : "Objective"}</Badge>
                    {question.is_automatic && <Badge className="border-0 bg-emerald-50 text-emerald-700">Automatic</Badge>}
                    {excluded && <Badge className="border-0 bg-amber-50 text-amber-700">Excluded</Badge>}
                    {inactive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="break-words text-sm font-medium leading-6 text-gray-800">{question.question_text}</p>
                  <p className="mt-2 text-xs text-gray-500">Weight: {question.default_weightage} · Max: {question.max_marks}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" disabled={!draggable} onClick={() => onAdd(question)}>
                {included ? <><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />Already Included</> : excluded ? <><RotateCcw className="mr-2 h-4 w-4" />Restore Question</> : <><Plus className="mr-2 h-4 w-4" />Include Question</>}
              </Button>
            </div>
          );
        })}
        {!loading && !filtered.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">No available questions match the current filters.</p>}
      </div>
    </section>
  );
}