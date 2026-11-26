"use client";

import { CheckCircle2, Circle, CircleMinus, AlertCircle, MessageSquareText, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPerformanceQuestion, validatePerformanceAnswer } from "@/hooks/usePerformanceEvaluation";

export default function PerformanceEvaluationQuestion({ question, index, response, role, idKey, employeeName, disabled, error, onChange }) {
  const id = question[idKey];
  const answer = response || { score: "", descriptive_answer: "", is_not_applicable: false };
  const descriptive = question.question_type === "descriptive";
  const notApplicable = role === "peer" && answer.is_not_applicable;
  const answered = !validatePerformanceAnswer(question, answer, role, true);
  const maxMarks = Number(question.max_marks ?? 10);
  const validMax = Number.isInteger(maxMarks) && maxMarks >= 0;
  const text = formatPerformanceQuestion(question.question_text, employeeName, role);

  return (
    <article id={`performance-question-${id}`}
      className={`scroll-mt-24 rounded-[24px] border p-5 transition-all duration-200 hover:shadow-md sm:p-6 ${
        error ? "border-red-300 bg-red-50/30" : answered ? "border-emerald-200/80 bg-white" : "border-gray-200 bg-[#FCFCFD]"
      }`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
          answered ? "bg-emerald-50 text-emerald-700" : "bg-[#FFF1EC] text-[#F6490D]"
        }`}>{index + 1}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`border-0 ${descriptive ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-[#F6490D]"}`}>
              {descriptive ? <MessageSquareText className="mr-1 h-3 w-3" /> : <ListChecks className="mr-1 h-3 w-3" />}
              {descriptive ? "Descriptive" : "Objective"}
            </Badge>
            <Badge variant="outline" className="font-normal text-gray-500">Weightage: {question.weightage}</Badge>
            {!descriptive && <Badge variant="outline" className="font-normal text-gray-500">0–{maxMarks} Marks</Badge>}
          </div>
          <p className="mt-3 text-sm font-medium leading-7 text-[#111827]">{text}</p>
        </div>
        {notApplicable ? <CircleMinus className="mt-2 h-5 w-5 shrink-0 text-amber-500" />
          : answered ? <CheckCircle2 className="mt-2 h-5 w-5 shrink-0 text-emerald-500" />
          : <Circle className="mt-2 h-5 w-5 shrink-0 text-gray-300" />}
      </div>

      {role === "peer" && (
        <div className="mt-4 flex justify-end">
          <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
            notApplicable ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-600"
          }`}>
            <input type="checkbox" checked={Boolean(notApplicable)} disabled={disabled}
              className="h-4 w-4 accent-[#F6490D]"
              onChange={event => onChange({ is_not_applicable: event.target.checked, score: "", descriptive_answer: "" })} />
            Not Applicable
          </label>
        </div>
      )}

      {notApplicable ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          <CircleMinus className="mt-0.5 h-4 w-4 shrink-0" />This question is marked Not Applicable and will not receive a numerical score.
        </div>
      ) : descriptive ? (
        <div className="mt-5">
          <label htmlFor={`performance-answer-${id}`} className="mb-2 block text-xs font-semibold text-gray-600">
            {role === "self" ? "Your Response" : "Your Assessment"}
          </label>
          <textarea id={`performance-answer-${id}`} rows={4}
            value={answer.descriptive_answer || ""} disabled={disabled}
            onChange={event => onChange({ descriptive_answer: event.target.value, score: "" })}
            placeholder="Write your response here..."
            className="w-full resize-y rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-[#111827] outline-none transition focus:border-[#F6490D] focus:ring-4 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:bg-gray-50" />
          <p className="mt-1 text-right text-xs text-gray-400">{String(answer.descriptive_answer || "").length} characters</p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-600">Select Rating</p>
            <span className="text-xs font-medium text-[#F6490D]">
              {answer.score !== "" && answer.score !== null && answer.score !== undefined ? `${answer.score} / ${maxMarks}` : "Not rated"}
            </span>
          </div>
          {validMax && maxMarks <= 20 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={`Rating for question ${index + 1}`}>
              {Array.from({ length: maxMarks + 1 }, (_, value) => {
                const selected = answer.score !== "" && answer.score !== null && answer.score !== undefined && Number(answer.score) === value;
                return (
                  <button key={value} type="button" disabled={disabled} aria-pressed={selected}
                    onClick={() => onChange({ score: String(value), descriptive_answer: "" })}
                    className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-2 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed ${
                      selected ? "border-[#F6490D] bg-[#F6490D] text-white shadow-[0_4px_12px_rgba(246,73,13,0.22)]"
                        : "border-gray-200 bg-white text-gray-600 enabled:hover:-translate-y-0.5 enabled:hover:border-[#F6490D] enabled:hover:text-[#F6490D]"
                    }`}>{value}</button>
                );
              })}
            </div>
          ) : (
            <input type="number" min={0} max={maxMarks} step={1}
              value={answer.score ?? ""} disabled={disabled || !validMax}
              onChange={event => onChange({ score: event.target.value, descriptive_answer: "" })}
              className="w-40 rounded-xl border border-gray-200 px-4 py-2 text-sm outline-none focus:border-[#F6490D]" />
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}
    </article>
  );
}