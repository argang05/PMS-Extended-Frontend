"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GripVertical, Trash2, RotateCcw, ArrowUp, ArrowDown, ClipboardList,
  LockKeyhole, Search, AlertCircle, Download, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { filterBuilderQuestions } from "@/lib/potential/questionnaireUtils";

const INCLUDE_DRAG_TYPE = "application/x-potential-question-include";
const REORDER_DRAG_TYPE = "application/x-potential-question-reorder";

export default function QuestionnaireWorkspace({
  items = [], availableQuestions = [], stats, excludedCount = 0,
  onRemove, onWeightageChange, onRestoreWeightage, onReorder,
  onAddMultiple, disabled = false, locked = false
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [externalDragOver, setExternalDragOver] = useState(false);
  const filtered = useMemo(() => filterBuilderQuestions(items, { search, type }), [items, search, type]);
  const availableMap = useMemo(() => new Map(availableQuestions.map(question => [Number(question.parameter_id), question])), [availableQuestions]);
  const includedIds = useMemo(() => new Set(items.map(item => Number(item.parameter_id))), [items]);
  const filtering = Boolean(search.trim() || type !== "all");
  const canInclude = !disabled && !locked && typeof onAddMultiple === "function";
  const canReorder = !disabled && !locked && !filtering;

  const clearDrag = () => {
    setDraggedId(null);
    setDragOverId(null);
    setExternalDragOver(false);
  };
  useEffect(() => {
    const reset = () => {
      setDraggedId(null);
      setDragOverId(null);
      setExternalDragOver(false);
    };
    window.addEventListener("dragend", reset);
    return () => window.removeEventListener("dragend", reset);
  }, []);
  useEffect(() => {
    if (disabled || locked) {
      setDraggedId(null);
      setDragOverId(null);
      setExternalDragOver(false);
    }
  }, [disabled, locked]);

  const isIncludeDrag = event => Array.from(event.dataTransfer.types || []).includes(INCLUDE_DRAG_TYPE);
  const isReorderDrag = event => Array.from(event.dataTransfer.types || []).includes(REORDER_DRAG_TYPE);
  const startDrag = (event, id) => {
    if (!canReorder) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(REORDER_DRAG_TYPE, String(id));
    event.dataTransfer.setData("text/plain", String(id));
    setDraggedId(id);
  };
  const handleWorkspaceDragOver = event => {
    if (!canInclude || !isIncludeDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setExternalDragOver(true);
  };
  const handleWorkspaceDragLeave = event => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setExternalDragOver(false);
  };
  const handleWorkspaceDrop = event => {
    if (!isIncludeDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearDrag();
    if (!canInclude) return;
    let ids;
    try {
      ids = JSON.parse(event.dataTransfer.getData(INCLUDE_DRAG_TYPE));
    } catch {
      return;
    }
    if (!Array.isArray(ids)) return;
    const questions = [...new Set(ids.map(Number))]
      .filter(id => Number.isSafeInteger(id) && id > 0 && !includedIds.has(id))
      .map(id => availableMap.get(id))
      .filter(question => question && question.is_active !== false);
    if (!questions.length) return;
    onAddMultiple(questions);
    if (filtering) {
      setSearch("");
      setType("all");
    }
  };
  const handleItemDragOver = (event, targetId) => {
    if (!canReorder || !isReorderDrag(event) || draggedId === null) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOverId(targetId);
  };
  const handleItemDrop = (event, targetId) => {
    if (!isReorderDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const sourceId = Number(event.dataTransfer.getData(REORDER_DRAG_TYPE));
    if (canReorder && sourceId === draggedId && sourceId !== targetId && includedIds.has(sourceId) && includedIds.has(targetId)) {
      onReorder(sourceId, targetId);
    }
    clearDrag();
  };

  return (
    <section onDragOver={handleWorkspaceDragOver} onDragLeave={handleWorkspaceDragLeave} onDrop={handleWorkspaceDrop}
      className={`relative min-w-0 space-y-5 rounded-[28px] border-2 bg-white p-5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] transition-all duration-200 ${externalDragOver && canInclude ? "border-dashed border-[#F6490D] bg-[#FFF9F6] ring-4 ring-orange-100" : "border-gray-100"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#FFF1EC] p-3"><ClipboardList className="h-5 w-5 text-[#F6490D]" /></div>
          <div>
            <h2 className="font-semibold text-gray-900">Questionnaire Workspace</h2>
            <p className="text-xs text-gray-500">Customize questions, order and weightages.</p>
          </div>
        </div>
        {locked && <Badge className="border-0 bg-amber-50 text-amber-700"><LockKeyhole className="mr-1 h-3 w-3" />Published & Locked</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Total Questions", stats?.total || 0],
          ["Objective", stats?.objective || 0],
          ["Descriptive", stats?.descriptive || 0],
          ["Total Weightage", Number(stats?.totalWeightage || 0).toFixed(2)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge className="border-0 bg-emerald-50 text-emerald-700">{stats?.automatic || 0} Automatic</Badge>
        <Badge className="border-0 bg-blue-50 text-blue-700">{stats?.manual || 0} Manual</Badge>
        <Badge className="border-0 bg-amber-50 text-amber-700">{excludedCount} Excluded</Badge>
      </div>
      {canInclude && (
        <div className={`flex items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-center transition-all duration-200 ${externalDragOver ? "border-[#F6490D] bg-[#FFF1EC] text-[#F6490D] shadow-sm" : "border-gray-200 bg-gray-50/60 text-gray-500"}`}>
          {externalDragOver ? <Plus className="h-5 w-5 shrink-0 animate-pulse" /> : <Download className="h-5 w-5 shrink-0" />}
          <div>
            <p className="text-sm font-semibold">{externalDragOver ? "Release to Include Questions" : "Drag & Drop Questions Here"}</p>
            <p className="mt-1 text-xs">{externalDragOver ? "Questions will be added to your local questionnaire draft." : "Drag from Available Questions into this workspace."}</p>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input className="rounded-xl pl-9" placeholder="Search included questions..." value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <select className="rounded-xl border bg-white px-3 text-xs" value={type} onChange={event => setType(event.target.value)}>
          <option value="all">All Types</option>
          <option value="objective">Objective</option>
          <option value="descriptive">Descriptive</option>
        </select>
      </div>
      {filtering && !disabled && <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700"><AlertCircle className="h-4 w-4 shrink-0" />Clear search and filters to rearrange the complete questionnaire.</p>}
      <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
        {filtered.map(item => {
          const id = Number(item.parameter_id);
          const index = items.findIndex(question => Number(question.parameter_id) === id);
          const defaultWeight = availableMap.get(id)?.default_weightage ?? item.default_weightage;
          const customized = defaultWeight !== undefined && Number(defaultWeight) !== Number(item.weightage);
          const invalidWeight = !Number.isFinite(Number(item.weightage)) || Number(item.weightage) <= 0;
          return (
            <div key={id} onDragOver={event => handleItemDragOver(event, id)} onDrop={event => handleItemDrop(event, id)}
              className={`rounded-2xl border p-4 transition-all duration-200 ${dragOverId === id && draggedId !== id ? "border-[#F6490D] bg-[#FFF1EC] ring-2 ring-orange-100" : "border-gray-200 bg-[#FCFCFD]"} ${draggedId === id ? "scale-[0.98] opacity-40" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{index + 1}</span>
                  <button type="button" draggable={canReorder} disabled={!canReorder} onDragStart={event => startDrag(event, id)} onDragEnd={clearDrag} className="cursor-grab rounded-md p-1 text-gray-400 hover:bg-orange-50 hover:text-[#F6490D] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30" aria-label="Drag to reorder" title="Drag to reorder"><GripVertical className="h-5 w-5" /></button>
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">#{id}</Badge>
                    <Badge className={item.question_type === "descriptive" ? "border-0 bg-purple-50 text-purple-700" : "border-0 bg-blue-50 text-blue-700"}>{item.question_type === "descriptive" ? "Descriptive" : "Objective"}</Badge>
                    <Badge className={item.source === "automatic" ? "border-0 bg-emerald-50 text-emerald-700" : "border-0 bg-gray-100 text-gray-700"}>{item.source === "automatic" ? "Automatic" : "Manual"}</Badge>
                    {customized && <Badge className="border-0 bg-amber-50 text-amber-700">Customized Weight</Badge>}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-gray-900">{item.question_text}</p>
                  <p className="text-xs text-gray-500">Maximum Marks: {item.max_marks}</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Weightage</label>
                      <Input type="number" min="0.01" step="any" className={`w-28 ${invalidWeight ? "border-red-400" : ""}`} value={item.weightage} disabled={disabled || locked} onChange={event => onWeightageChange(id, event.target.value)} />
                    </div>
                    {defaultWeight !== undefined && (
                      <Button variant="outline" size="sm" disabled={disabled || locked || !customized} title={`Restore default weightage: ${defaultWeight}`} onClick={() => onRestoreWeightage(id, availableQuestions)}><RotateCcw className="mr-1 h-3 w-3" />Default: {defaultWeight}</Button>
                    )}
                  </div>
                  {invalidWeight && <p className="text-xs text-red-600">Weightage must be greater than zero.</p>}
                </div>
                {!disabled && !locked && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button variant="ghost" size="icon" aria-label="Move question up" disabled={!canReorder || index === 0} onClick={() => onReorder(id, items[index - 1].parameter_id)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Move question down" disabled={!canReorder || index === items.length - 1} onClick={() => onReorder(id, items[index + 1].parameter_id)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Remove question" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => onRemove(id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <div className={`flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center transition-all ${externalDragOver ? "border-[#F6490D] bg-[#FFF1EC]" : "border-gray-200"}`}>
            <ClipboardList className={`h-9 w-9 ${externalDragOver ? "text-[#F6490D]" : "text-gray-300"}`} />
            <p className="text-sm font-medium text-gray-600">{items.length ? "No matching questions" : externalDragOver ? "Drop Questions Here" : "Questionnaire is empty"}</p>
            <p className="text-xs text-gray-500">{items.length ? "Change the current filters." : "Drag questions from the Available Questions panel or use the Include Question button."}</p>
          </div>
        )}
      </div>
    </section>
  );
}