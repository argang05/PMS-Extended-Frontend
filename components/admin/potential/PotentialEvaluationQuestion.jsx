"use client";
import { ListChecks, MessageSquareText, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPotentialQuestionId, validatePotentialAnswer } from "@/lib/potential/evaluationUtils";

export default function PotentialEvaluationQuestion({ question, index, response, onChange, disabled = false, error }) {
  const id = getPotentialQuestionId(question);
  const descriptive = question.question_type === "descriptive";
  const answered = !validatePotentialAnswer(question, response, true);
  const maxMarks = Number(question.max_marks);
  const score = response?.score;
  const hasScore = score !== null && score !== undefined && String(score).trim() !== "";
  const validMaxMarks = Number.isFinite(maxMarks) && maxMarks >= 0;
  const useRatingButtons = validMaxMarks && Number.isInteger(maxMarks) && maxMarks <= 20;
  const ratings = useRatingButtons ? Array.from({ length: maxMarks + 1 }, (_, index) => index) : [];
  const completed = answered && !error;

  return (
    <div id={`potential-question-${id}`} className={`scroll-mt-24 rounded-[24px] border bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md ${error ? "border-red-300" : completed ? "border-emerald-200" : "border-gray-200"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${completed ? "bg-emerald-50 text-emerald-700" : error ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"}`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`rounded-full border-0 px-2.5 py-1 text-[10px] font-medium ${descriptive ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-[#F6490D]"}`}>
                {descriptive ? <MessageSquareText className="mr-1 h-3 w-3" /> : <ListChecks className="mr-1 h-3 w-3" />}
                {descriptive ? "Descriptive" : "Objective"}
              </Badge>
              {question.weightage != null && (
                <Badge variant="outline" className="rounded-full border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-normal text-gray-500">
                  Weightage: {question.weightage}
                </Badge>
              )}
              {!descriptive && validMaxMarks && (
                <Badge variant="outline" className="rounded-full border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-normal text-gray-500">
                  0–{maxMarks} Marks
                </Badge>
              )}
            </div>
            <div role="status" aria-label={error ? "Invalid response" : completed ? "Answered" : "Not answered"} className="shrink-0">
              {error ? <AlertCircle className="h-5 w-5 text-red-500" /> : completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-gray-300" />}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium leading-7 text-[#111827]">
            {question.question_text}
          </p>
        </div>
      </div>
      {descriptive ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={`answer-${id}`} className="text-xs font-semibold text-gray-600">Your Evaluation</label>
            <span className="text-xs text-gray-400">{String(response?.descriptive_answer ?? "").length} characters</span>
          </div>
          <textarea
            id={`answer-${id}`}
            rows={5}
            value={response?.descriptive_answer ?? ""}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={event => onChange({ descriptive_answer: event.target.value })}
            placeholder="Provide a thoughtful evaluation based on the employee's demonstrated capabilities and future potential..."
            className={`w-full resize-y rounded-2xl border bg-white p-4 text-sm leading-6 text-gray-800 outline-none transition-all focus:border-[#F6490D]/50 focus:ring-4 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:bg-gray-50 ${error ? "border-red-300" : "border-gray-200"}`}
          />
          <p className="text-xs text-gray-500">Written evaluation required. No numerical rating is needed.</p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label id={`rating-label-${id}`} className="text-xs font-semibold text-gray-600">Select Rating</label>
            <span className={`text-xs font-semibold ${hasScore ? "text-[#F6490D]" : "text-gray-400"}`}>
              {hasScore ? score : "—"} / {validMaxMarks ? maxMarks : "—"}
            </span>
          </div>
          {useRatingButtons ? (
            <>
              <div role="group" aria-labelledby={`rating-label-${id}`} className="flex flex-wrap items-center gap-2">
                {ratings.map(rating => {
                  const selected = hasScore && Number(score) === rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={`Rate ${rating} out of ${maxMarks}`}
                      onClick={() => onChange({ score: String(rating) })}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-2xl border px-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F6490D]/20 disabled:cursor-not-allowed ${selected ? "border-[#F6490D] bg-[#F6490D] text-white shadow-[0_5px_12px_rgba(246,73,13,0.22)]" : "border-gray-200 bg-white text-gray-600 enabled:hover:border-[#F6490D]/40 enabled:hover:bg-[#FFF7F4] enabled:hover:text-[#F6490D] disabled:opacity-60"}`}
                    >
                      {rating}
                    </button>
                  );
                })}
              </div>
              {hasScore && !Number.isInteger(Number(score)) && (
                <p className="mt-3 text-xs text-gray-500">Previously saved rating: {score}. Select a button to update it.</p>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <input
                id={`score-${id}`}
                type="number"
                min={0}
                max={validMaxMarks ? maxMarks : undefined}
                step="any"
                value={score ?? ""}
                disabled={disabled || !validMaxMarks}
                aria-labelledby={`rating-label-${id}`}
                aria-invalid={Boolean(error)}
                placeholder="Enter rating"
                onChange={event => onChange({ score: event.target.value })}
                className={`w-36 rounded-xl border bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-[#F6490D]/50 focus:ring-4 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:bg-gray-50 ${error ? "border-red-300" : "border-gray-200"}`}
              />
              <span className="text-xs text-gray-500">{validMaxMarks ? `Allowed range: 0–${maxMarks}` : "Invalid maximum marks configuration."}</span>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}