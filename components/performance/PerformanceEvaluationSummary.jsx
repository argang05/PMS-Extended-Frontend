"use client";

import { MessageSquareText, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react";

function SummaryField({ id, icon: Icon, label, value, onChange, disabled, placeholder, required, error }) {
  return (
    <div id={`performance-question-${id}`} className="scroll-mt-24">
      <div className="mb-3 flex items-center justify-between gap-2">
        <label htmlFor={`performance-summary-${id}`} className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <Icon className="h-4 w-4 text-[#F6490D]" />{label}
          {required && <span className="text-[#F6490D]">*</span>}
        </label>
        {value.trim() && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      </div>
      <textarea id={`performance-summary-${id}`} rows={5}
        value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full resize-y rounded-2xl border bg-white px-4 py-3 text-sm leading-6 text-[#111827] outline-none transition focus:border-[#F6490D] focus:ring-4 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:bg-gray-50 ${error ? "border-red-300" : "border-gray-200"}`} />
      <div className="mt-2 flex justify-between gap-2 text-xs">
        {error ? <span className="flex items-center gap-1 text-red-600"><AlertCircle className="h-3.5 w-3.5" />{error}</span> : <span />}
        <span className="text-gray-400">{value.length} characters</span>
      </div>
    </div>
  );
}

export default function PerformanceEvaluationSummary({ evaluation, role }) {
  const required = ["self", "peer"].includes(role);
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-[#111827]">{evaluation.config.summary}</h2>
        <p className="mt-1 text-xs leading-5 text-gray-500">Provide overall feedback and identify opportunities for improvement.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SummaryField id="feedback" icon={MessageSquareText} label="Feedback"
          value={evaluation.feedback} onChange={evaluation.updateFeedback} disabled={!evaluation.editable}
          required={required} error={evaluation.validationErrors.feedback}
          placeholder={role === "self" ? "Write your overall feedback for this review cycle..." : "Provide your overall feedback about the employee..."} />
        <SummaryField id="scope" icon={TrendingUp} label="Scope of Improvement"
          value={evaluation.scope} onChange={evaluation.updateScope} disabled={!evaluation.editable}
          required={required} error={evaluation.validationErrors.scope}
          placeholder={role === "self" ? "Mention areas where you want to improve further..." : "Identify areas where the employee can improve..."} />
      </div>
    </section>
  );
}