"use client";
import {
  AlertTriangle, ShieldCheck, Trash2, RotateCcw, Database,
  CheckCircle2, RefreshCw, Loader2, ClipboardList, X
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import usePMSReset from "@/hooks/usePMSReset";
import {
  RESET_SCOPE, DELETION_GROUPS, PRESERVED_CONFIGURATION,
  formatResetLabel, getResetScopeLabel, getTotalDeletedRecords,
  getResetConfirmationDescription
} from "@/lib/reset/resetUtils";

const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#F6490D]/25 focus:ring-4 focus:ring-[#F6490D]/8 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60";
const primaryClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F6490D] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";
const darkClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";

function SummaryCard({ label, value, variant = "neutral" }) {
  const styles = {
    neutral: "border-gray-200 bg-[#FCFCFD]",
    orange: "border-[#F6490D]/15 bg-[#FFF7F4]",
    success: "border-emerald-200 bg-emerald-50",
    danger: "border-red-200 bg-red-50"
  };
  return (
    <div className={`rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${styles[variant]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-[#111827]">{value ?? "—"}</p>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description, variant = "orange" }) {
  const styles = {
    orange: "bg-[#FFF1EC] text-[#F6490D]",
    success: "bg-emerald-100 text-emerald-700",
    danger: "bg-red-100 text-red-700"
  };
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles[variant]}`}><Icon className="h-5 w-5" /></div>
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-[#111827]">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>}
      </div>
    </div>
  );
}

function CountGrid({ data, variant = "neutral" }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(data || {}).map(([key, value]) => <SummaryCard key={key} label={formatResetLabel(key)} value={value} variant={variant} />)}
    </div>
  );
}

function WarningPanel({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> Important Warnings</div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-amber-800">
        {warnings.map((warning, index) => <p key={index}>• {warning}</p>)}
      </div>
    </div>
  );
}

function ErrorPanel({ title, message, onRetry, disabled }) {
  if (!message) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />{title}</div>
      <p className="mt-2 text-xs leading-5 text-red-700">{message}</p>
      {onRetry && <button type="button" disabled={disabled} onClick={onRetry} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-red-700 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Retry Refresh</button>}
    </div>
  );
}

function DeletionSummary({ summary, completed = false }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-[#FFFCFC] p-5">
      <SectionHeading icon={Trash2} title={completed ? "Deleted Transaction Records" : "Records To Be Deleted"} description="Evaluation transactions, descriptive scoring records and calculated analytics." variant="danger" />
      <div className="space-y-5">
        {DELETION_GROUPS.map(group => (
          <div key={group.title}>
            <h4 className="mb-3 text-sm font-semibold text-[#111827]">{group.title}</h4>
            <CountGrid data={Object.fromEntries(group.keys.map(key => [key, summary?.[key] ?? 0]))} />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-800">{completed ? "Total Records Deleted" : "Total Transaction Records Identified"}</p>
        <span className="text-2xl font-bold text-red-700">{getTotalDeletedRecords(summary)}</span>
      </div>
    </div>
  );
}

function PreservationSummary({ summary }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-[#FCFFFD] p-5">
      <SectionHeading icon={ShieldCheck} title="Preserved Data & Configurations" description="The following questionnaire structures and master configurations remain intact." variant="success" />
      <CountGrid data={summary} variant="success" />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {PRESERVED_CONFIGURATION.map(label => (
          <div key={label} className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-white p-3 text-xs leading-5 text-gray-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{label}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResetStateSummary({ summary, potentialAssessment, completed = false, preferences }) {
  const preferenceLabel = value => !completed ? "OFF after reset" : value === false ? "OFF" : "Not verified";
  return (
    <div className="rounded-2xl border border-[#F6490D]/15 bg-[#FFFDFC] p-5">
      <SectionHeading icon={RotateCcw} title={completed ? "Reset State Summary" : "Records To Be Reset"} description="These questionnaire and assessment records are retained while their evaluation state is reset." />
      <CountGrid data={summary} variant="orange" />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SummaryCard label="Performance Status" value="Draft" variant="orange" />
        <SummaryCard label="Potential Status" value={potentialAssessment?.status_after_reset || "Pending RM if published; Draft otherwise"} variant="orange" />
        <SummaryCard label="Performance Descriptive Scoring" value={preferenceLabel(preferences?.performance_enabled)} />
        <SummaryCard label="Potential Descriptive Scoring" value={preferenceLabel(preferences?.potential_enabled)} />
      </div>
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-600">RM and Skip-Level submission flags are cleared. Performance peer assignments and evaluation submission timestamps are removed. Existing questionnaire publication states are preserved.</div>
    </div>
  );
}

function ResetPreview({ data }) {
  if (!data) return null;
  return (
    <div className={`${cardClass} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#111827]">Reset Preview</h2>
          <p className="mt-1 text-sm text-gray-600">Review the exact employee, reset scope and affected records before confirming.</p>
        </div>
        <span className={`rounded-full px-4 py-2 text-xs font-semibold ${data.safe_to_reset ? "bg-[#FFF1EC] text-[#F6490D]" : "bg-gray-100 text-gray-600"}`}>{data.safe_to_reset ? "Reset Available" : "Nothing To Reset"}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard label="Employee Name" value={data.employee?.full_name} />
        <SummaryCard label="Employee Number" value={data.employee?.employee_number} />
        <SummaryCard label="Department" value={data.employee?.department} />
        <SummaryCard label="Reset Scope" value={getResetScopeLabel(data.selection.scope)} variant="orange" />
        {data.review_cycle && <>
          <SummaryCard label="Review Cycle" value={data.review_cycle.name} />
          <SummaryCard label="Review Cycle ID" value={data.review_cycle.id} />
        </>}
      </div>
      {data.questionnaire && (
        <div className="rounded-2xl border border-gray-200 p-4">
          <SectionHeading icon={ClipboardList} title="Current Performance Questionnaire" />
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryCard label="Questionnaire ID" value={data.questionnaire.id} />
            <SummaryCard label="Current Status" value={String(data.questionnaire.status || "—").replaceAll("_", " ")} />
            <SummaryCard label="Submitted At" value={data.questionnaire.submitted_at ? new Date(data.questionnaire.submitted_at).toLocaleString() : "Not submitted"} />
          </div>
        </div>
      )}
      {data.potential_assessment && (
        <div className="rounded-2xl border border-gray-200 p-4">
          <SectionHeading icon={Database} title="Current Potential Assessment" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard label="Assessment ID" value={data.potential_assessment.id} />
            <SummaryCard label="Current Status" value={String(data.potential_assessment.status || "—").replaceAll("_", " ")} />
            <SummaryCard label="Published" value={data.potential_assessment.is_published ? "Yes" : "No"} />
            <SummaryCard label="RM Submitted" value={data.potential_assessment.rm_submitted ? "Yes" : "No"} />
            <SummaryCard label="Skip Submitted" value={data.potential_assessment.skip_submitted ? "Yes" : "No"} />
            <SummaryCard label="Status After Reset" value={String(data.potential_assessment.status_after_reset || "—").replaceAll("_", " ")} variant="orange" />
          </div>
        </div>
      )}
      <WarningPanel warnings={data.warnings} />
      <DeletionSummary summary={data.delete_summary} />
      <ResetStateSummary summary={data.reset_summary} potentialAssessment={data.potential_assessment} />
      <PreservationSummary summary={data.preserved_summary} />
      <p className="text-xs leading-5 text-gray-500">Preview counts reflect the current server state. Actual execution counts may differ if evaluation records change before the reset is performed.</p>
    </div>
  );
}

function ResetExecutionResult({ result, synchronizing, synchronizationError, onDismiss }) {
  if (!result) return null;
  return (
    <div className={`${cardClass} space-y-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></div>
          <div>
            <h2 className="text-xl font-semibold text-[#111827]">PMS Reset Completed</h2>
            <p className="mt-1 text-sm text-gray-600">The backend reset transaction completed successfully.</p>
          </div>
        </div>
        <button type="button" aria-label="Dismiss reset result" disabled={synchronizing} onClick={onDismiss} className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard label="Employee Number" value={result.employee_number} />
        <SummaryCard label="Reset Scope" value={getResetScopeLabel(result.scope)} />
        <SummaryCard label="Review Cycle ID" value={result.review_cycle_id ?? "All Review Cycles"} />
        <SummaryCard label="Completed At" value={result.timestamp ? new Date(result.timestamp).toLocaleString() : "—"} />
      </div>
      <div className={`rounded-xl border p-4 text-sm ${synchronizing ? "border-amber-200 bg-amber-50 text-amber-800" : synchronizationError ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
        <div className="flex items-center gap-2 font-semibold">
          {synchronizing ? <Loader2 className="h-4 w-4 animate-spin" /> : synchronizationError ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {synchronizing ? "Synchronizing frontend data..." : synchronizationError ? "Reset completed; frontend refresh requires attention." : "Frontend query cache synchronized."}
        </div>
      </div>
      {result.later_review_cycles_requiring_verification?.length > 0 && (
        <WarningPanel warnings={[
          `Later review cycles requiring PPI and dependent analytics verification: ${result.later_review_cycles_requiring_verification.join(", ")}.`,
          "Verify and recalculate affected later-cycle results in the Scoring Console before releasing analytics."
        ]} />
      )}
      <DeletionSummary summary={result.deleted} completed />
      <ResetStateSummary summary={result.reset_summary} completed preferences={result.descriptive_preferences} />
      <PreservationSummary summary={result.preserved} />
    </div>
  );
}

export default function ResetPMSPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const authorized = String(user?.employee_number || "") === "100607";
  const reset = usePMSReset(accessToken, authorized);
  if (authLoading) return <div className={cardClass}><p className="text-sm text-gray-600">Loading PMS Reset Console...</p></div>;
  if (!authorized) return <div className={cardClass}><p className="text-sm text-red-600">You are not authorized to access this page.</p></div>;
  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <AdminConfirmDialog
        open={Boolean(reset.confirmation)}
        title="Confirm Permanent PMS Reset?"
        description={reset.confirmation ? getResetConfirmationDescription(reset.confirmation.preview) : ""}
        confirmText="Confirm & Reset PMS"
        cancelText="Cancel"
        variant="warning"
        loading={reset.executing || reset.synchronizing}
        onConfirm={reset.confirmReset}
        onCancel={reset.cancelReset}
      />
      <div className={cardClass}>
        <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">PMS Reset Console</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">Reset Performance and Potential evaluation transaction data for authorized testing and correction workflows.</p>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div><p className="font-semibold">Permanent and irreversible operation</p><p>This tool deletes evaluation responses, descriptive marks, scores, overrides and analytics release records. Employee master records, question banks, questionnaire structures and scoring configurations are preserved.</p></div>
      </div>
      <div className={cardClass}>
        <SectionHeading icon={RotateCcw} title="Reset Selection" description="Select the employee and review cycle whose PMS transaction data must be reset." />
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#111827]">Employee Number</label>
            <input type="text" value={reset.employeeNumber} disabled={reset.locked} onChange={event => reset.changeSelection("employeeNumber", event.target.value)} placeholder="Enter employee number" className={inputClass} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#111827]">Reset Scope</label>
            <select value={reset.scope} disabled={reset.locked} onChange={event => reset.changeSelection("scope", event.target.value)} className={inputClass}>
              <option value={RESET_SCOPE.CYCLE}>Cycle Reset</option>
              <option value={RESET_SCOPE.ALL}>Full Employee PMS Reset</option>
            </select>
          </div>
          {reset.scope === RESET_SCOPE.CYCLE ? (
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#111827]">Review Cycle</label>
              <select value={reset.cycleId} disabled={reset.locked || reset.loadingCycles || !reset.cycles.length} onChange={event => reset.changeSelection("cycleId", event.target.value)} className={inputClass}>
                {reset.loadingCycles ? <option value="">Loading review cycles...</option> : !reset.cycles.length ? <option value="">No review cycles available</option> : reset.cycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.name}{cycle.is_active ? " (Active)" : ""}</option>)}
              </select>
              {reset.cyclesError && <div className="mt-3"><ErrorPanel title="Review cycles unavailable" message={reset.cyclesError} onRetry={reset.loadCycles} disabled={reset.locked || reset.loadingCycles} /></div>}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Full Employee PMS Reset applies to every review cycle belonging to the selected employee, not to every employee in the organization.</div>
          )}
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#111827]">Reset Reason <span className="font-normal text-gray-400">(Optional)</span></label>
            <textarea rows={3} value={reset.reason} disabled={reset.locked} onChange={event => reset.changeReason(event.target.value)} placeholder="Admin reset via console" className={inputClass} />
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" onClick={reset.loadPreview} disabled={reset.locked || !reset.employeeNumber.trim() || (reset.scope === RESET_SCOPE.CYCLE && (reset.loadingCycles || !reset.cycleId))} className={darkClass}>
              {reset.loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              {reset.loadingPreview ? "Loading Preview..." : "Preview Reset"}
            </button>
            {reset.preview && (
              <button type="button" onClick={reset.requestReset} disabled={reset.locked || !reset.preview.safe_to_reset} className={primaryClass}><Trash2 className="h-4 w-4" /> Confirm Reset</button>
            )}
          </div>
          <ErrorPanel title="Reset preview failed" message={reset.previewError} />
          <ErrorPanel title="Reset execution could not be verified" message={reset.executionError} />
          <ErrorPanel title="Frontend synchronization failed" message={reset.synchronizationError} onRetry={reset.retrySynchronization} disabled={reset.locked} />
        </div>
      </div>
      {reset.preview && <ResetPreview data={reset.preview} />}
      {reset.executionResult && <ResetExecutionResult result={reset.executionResult} synchronizing={reset.synchronizing} synchronizationError={reset.synchronizationError} onDismiss={reset.dismissResult} />}
    </section>
  );
}