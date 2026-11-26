"use client";

import { CheckCircle2, ListChecks, MessageSquareText, CircleDot, CircleMinus } from "lucide-react";

function ProgressStat({ icon: Icon, label, value, total, description }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <Icon className="h-4 w-4 text-[#F6490D]" />{label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#111827]">
        {value}{total !== undefined && <span className="text-sm font-normal text-gray-400"> / {total}</span>}
      </p>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
    </div>
  );
}

export default function PerformanceEvaluationProgress({ progress, role }) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Evaluation Progress</h2>
          <p className="mt-1 text-xs text-gray-500">Track the completion of your questionnaire.</p>
        </div>
        <div className="rounded-xl bg-[#FFF1EC] px-4 py-2 text-lg font-bold text-[#F6490D]">{progress.percentage}%</div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-gray-100">
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}
          className="h-full rounded-full bg-gradient-to-r from-[#F6490D] to-orange-400 transition-all duration-500 ease-out"
          style={{ width: `${progress.percentage}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-500">
        <span>{progress.answered} of {progress.total} questions completed</span>
        <span>{progress.unanswered} remaining</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProgressStat icon={ListChecks} label="Answered" value={progress.answered} total={progress.total} />
        <ProgressStat icon={CircleDot} label="Objective" value={progress.objectiveAnswered} total={progress.objective} />
        <ProgressStat icon={MessageSquareText} label="Descriptive" value={progress.descriptiveAnswered} total={progress.descriptive} />
        {role === "peer"
          ? <ProgressStat icon={CircleMinus} label="Not Applicable" value={progress.notApplicable} description="Included in completion" />
          : <ProgressStat icon={CheckCircle2} label="Summary" value={progress.summaryComplete ? "2" : "Pending"} total={progress.summaryComplete ? 2 : undefined} description={progress.summaryComplete ? "Both fields completed" : "Feedback and improvement"} />}
      </div>
      {progress.total > 0 && progress.percentage === 100 && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />All questionnaire responses are complete.
        </div>
      )}
    </section>
  );
}