"use client";

import { ClipboardCheck, ListChecks, MessageSquareText, CircleDashed } from "lucide-react";

function ProgressCard({ title, value, description, icon: Icon, color, background }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${background}`}><Icon className={`h-5 w-5 ${color}`} /></div>
      </div>
    </div>
  );
}

export default function PotentialEvaluationProgress({ progress }) {
  return (
    <section className="space-y-4 rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Evaluation Progress</h2>
          <p className="mt-1 text-xs text-gray-500">Complete all required questions before final submission.</p>
        </div>
        <span className="text-xl font-bold text-[#F6490D]">{progress.percentage}%</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage} aria-label="Evaluation completion" className="h-3 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all duration-500 ${progress.percentage === 100 ? "bg-emerald-500" : "bg-[#F6490D]"}`} style={{ width: `${progress.percentage}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProgressCard title="Total Answered" value={`${progress.answered}/${progress.total}`} description="Valid responses" icon={ClipboardCheck} color="text-emerald-600" background="bg-emerald-50" />
        <ProgressCard title="Objective" value={`${progress.objectiveAnswered}/${progress.objective}`} description="Numerical ratings" icon={ListChecks} color="text-blue-600" background="bg-blue-50" />
        <ProgressCard title="Descriptive" value={`${progress.descriptiveAnswered}/${progress.descriptive}`} description="Written evaluations" icon={MessageSquareText} color="text-purple-600" background="bg-purple-50" />
        <ProgressCard title="Remaining" value={progress.remaining} description="Required responses" icon={CircleDashed} color="text-amber-600" background="bg-amber-50" />
      </div>
    </section>
  );
}