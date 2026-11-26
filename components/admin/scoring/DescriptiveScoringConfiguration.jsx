"use client";
import Link from "next/link";
import { ArrowRight, ClipboardList, TrendingUp, Loader2, RefreshCw, AlertCircle, CheckCircle2, Settings2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  getPreferenceReadiness, getDescriptiveWorkspaceLink,
  formatScoringWeight, getEngineBlockers
} from "@/lib/scoring/scoringConsoleUtils";

function StatusBadge({ children, variant = "neutral" }) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    error: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-gray-200 bg-gray-100 text-gray-600"
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[variant]}`}>{children}</span>;
}

function ReadinessPanel({ engine, descriptiveReadiness, enabled, loading }) {
  const ready = engine?.canCalculate === true;
  const blockers = getEngineBlockers(engine);
  const counts = [
    ["Total", descriptiveReadiness?.total_descriptive_questions ?? descriptiveReadiness?.total_questions],
    ["Scored", descriptiveReadiness?.scored_questions],
    ["Pending", descriptiveReadiness?.pending_questions],
    ["Incomplete", descriptiveReadiness?.incomplete_questions]
  ].filter(([, value]) => value !== undefined && value !== null);
  return (
    <div className={`mt-4 rounded-xl border p-3 ${loading ? "border-gray-200 bg-gray-50" : ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${loading ? "text-gray-600" : ready ? "text-emerald-700" : "text-amber-800"}`}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        {loading ? "Checking calculation readiness..." : ready ? "Ready for Calculation" : engine?.label || "Readiness Unavailable"}
      </div>
      {enabled && counts.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {counts.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-white/80 p-2">
              <p className="text-[10px] text-gray-500">{label}</p>
              <p className="mt-1 text-sm font-bold text-[#111827]">{value}</p>
            </div>
          ))}
        </div>
      )}
      {enabled && descriptiveReadiness?.conflicting_questions > 0 && <p className="mt-2 text-xs text-amber-800">{descriptiveReadiness.conflicting_questions} conflicting question scores require reconciliation.</p>}
      {!loading && !ready && blockers.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs leading-5 text-amber-800">
          {blockers.map((blocker, index) => <li key={index}>• {blocker}</li>)}
        </ul>
      )}
    </div>
  );
}

function PreferencePanel({ type, id, state, engine, descriptiveReadiness, readinessLoading, disabled, onChange, onRetry }) {
  const isPerformance = type === "performance";
  const title = isPerformance ? "Performance" : "Potential";
  const Icon = isPerformance ? ClipboardList : TrendingUp;
  const preference = state?.data;
  const enabled = preference?.enabled === true;
  const ready = getPreferenceReadiness(state);
  const hasDescriptive = preference?.hasDescriptiveQuestions === true;
  const switchDisabled = disabled || !ready || (!hasDescriptive && !enabled);
  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 ${enabled && ready ? "border-[#F6490D]/25 bg-[#FFF9F6] shadow-sm" : "border-gray-200 bg-[#FCFCFD]"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${enabled && ready ? "bg-[#F6490D]/10 text-[#F6490D]" : "bg-gray-100 text-gray-600"}`}><Icon className="h-5 w-5" /></div>
          <div>
            <h4 className="font-semibold text-[#111827]">{title} Descriptive Scoring</h4>
            <p className="mt-1 text-xs text-gray-500">{isPerformance ? "Employee performance evaluation" : "Employee future-readiness evaluation"}</p>
          </div>
        </div>
        {state?.saving ? <Loader2 className="h-5 w-5 animate-spin text-[#F6490D]" /> : <Switch aria-label={`Enable ${title} descriptive scoring`} checked={enabled} disabled={switchDisabled} onCheckedChange={value => onChange(type, value)} className="data-[state=checked]:bg-[#F6490D]" />}
      </div>
      {!id ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-500">No {title.toLowerCase()} assessment is available for this employee and review cycle.</div>
      ) : state?.loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white p-3 text-xs text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading configuration...</div>
      ) : state?.error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2 text-xs leading-5 text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{state.error}</div>
          <button type="button" disabled={disabled} onClick={() => onRetry(type)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>
        </div>
      ) : preference ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge variant={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</StatusBadge>
            <StatusBadge variant={enabled ? "success" : "warning"}>{enabled ? "Descriptive Scoring Applied" : "Objective Only"}</StatusBadge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[["Objective Weight", preference.objectiveWeight], ["Descriptive Weight", preference.descriptiveWeight]].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-[11px] font-medium text-gray-500">{label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-[#111827]">{formatScoringWeight(value)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-gray-600">
            {!hasDescriptive ? "This questionnaire does not contain descriptive questions." : enabled ? "Descriptive marks contribute to the final score using the effective component weightages." : "Descriptive answers and existing marks are preserved but excluded from score calculation."}
          </p>
          <ReadinessPanel engine={engine} descriptiveReadiness={descriptiveReadiness || preference.readiness} enabled={enabled} loading={readinessLoading} />
          {enabled && hasDescriptive && (
            <Link href={getDescriptiveWorkspaceLink(type, id)} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={event => { if (disabled) event.preventDefault(); }} className={`mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#F6490D] transition-all hover:gap-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>Open {title} Descriptive Scoring <ArrowRight className="h-4 w-4" /></Link>
          )}
        </>
      ) : <p className="mt-4 text-xs text-gray-500">Configuration unavailable.</p>}
    </div>
  );
}

export default function DescriptiveScoringConfiguration({
  questionnaireId, assessmentId, performance, potential,
  readiness, engines, readinessLoading = false, disabled, onChange, onRetry
}) {
  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1EC] text-[#F6490D]"><Settings2 className="h-5 w-5" /></div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-[#111827]">Descriptive Scoring Configuration</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">Configure Performance and Potential descriptive scoring independently for the selected employee and review cycle.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PreferencePanel type="performance" id={questionnaireId} state={performance} engine={engines?.performance} descriptiveReadiness={readiness?.performance?.descriptive_readiness || readiness?.performance_preference?.readiness} readinessLoading={readinessLoading} disabled={disabled} onChange={onChange} onRetry={onRetry} />
        <PreferencePanel type="potential" id={assessmentId} state={potential} engine={engines?.potential} descriptiveReadiness={readiness?.potential?.descriptive_readiness || potential?.data?.readiness} readinessLoading={readinessLoading} disabled={disabled} onChange={onChange} onRetry={onRetry} />
      </div>
      <div className="mt-4 rounded-xl border border-gray-200 bg-[#FCFCFD] px-4 py-3 text-xs leading-5 text-gray-500">Changes are saved immediately. Performance and Potential configurations are independent. Existing descriptive answers and marks are preserved when either configuration is disabled.</div>
    </div>
  );
}