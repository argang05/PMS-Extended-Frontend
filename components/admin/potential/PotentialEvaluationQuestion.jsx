"use client";

import { ListChecks, MessageSquareText, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { validatePotentialAnswer } from "@/lib/potential/evaluationUtils";

export default function PotentialEvaluationQuestion({ question, index, response, onChange, disabled = false, error }) {
  const descriptive = question.question_type === "descriptive";
  const answered = !validatePotentialAnswer(question, response, true);
  const maxMarks = Number(question.max_marks);
  return (
    <div id={`potential-question-${question.questionnaire_item_id}`} className={`scroll-mt-24 rounded-[24px] border bg-[#FCFCFD] p-5 shadow-[0_8px_22px_rgba(0,0,0,0.06)] transition-all duration-300 hover:shadow-lg ${error ? "border-red-300" : "border-gray-100"}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">Q{index + 1}</span>
          <Badge className={descriptive ? "border-0 bg-purple-50 text-purple-700" : "border-0 bg-blue-50 text-blue-700"}>
            {descriptive ? <MessageSquareText className="mr-1 h-3 w-3" /> : <ListChecks className="mr-1 h-3 w-3" />}
            {descriptive ? "Descriptive" : "Objective"}
          </Badge>
          <Badge variant="outline" className="bg-white">{question.category_name || "Uncategorized"}</Badge>
        </div>
        {answered ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" />Answered</span>
        ) : (
          <span className="text-xs font-medium text-gray-400">Not answered</span>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm font-medium leading-7 text-[#111827]">{question.question_text}</p>
      {descriptive ? (
        <div className="mt-4 space-y-2">
          <label htmlFor={`answer-${question.questionnaire_item_id}`} className="text-xs font-medium text-gray-600">Your evaluation</label>
          <textarea
            id={`answer-${question.questionnaire_item_id}`}
            rows={5}
            value={response?.descriptive_answer ?? ""}
            disabled={disabled}
            onChange={event => onChange({ descriptive_answer: event.target.value })}
            placeholder="Provide a thoughtful evaluation based on the employee's demonstrated capabilities and future potential..."
            className={`w-full resize-y rounded-2xl border bg-white p-4 text-sm leading-6 text-gray-800 outline-none transition-all focus:border-[#F6490D]/50 focus:ring-4 focus:ring-[#F6490D]/10 disabled:bg-gray-50 ${error ? "border-red-300" : "border-gray-200"}`}
          />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500">
            <span>Written evaluation required. No numerical rating is needed.</span>
            <span>{String(response?.descriptive_answer ?? "").length} characters</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4">
          <div>
            <label htmlFor={`score-${question.questionnaire_item_id}`} className="text-xs font-semibold text-gray-600">Employee rating</label>
            <p className="mt-1 text-xs text-gray-500">Allowed range: 0–{maxMarks}</p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              id={`score-${question.questionnaire_item_id}`}
              type="number"
              min={0}
              max={maxMarks}
              step="any"
              value={response?.score ?? ""}
              disabled={disabled}
              placeholder="Score"
              onChange={event => onChange({ score: event.target.value })}
              className={`w-28 rounded-xl ${error ? "border-red-300" : ""}`}
            />
            <span className="text-sm font-semibold text-gray-500">/ {maxMarks}</span>
          </div>
        </div>
      )}
      {error && <p className="mt-3 flex items-center gap-2 text-xs text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
    </div>
  );
}