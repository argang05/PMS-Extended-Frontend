"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, RefreshCw, Save, CheckCircle2, FileText, AlertCircle,
  ChevronDown, ChevronUp, Users, LockKeyhole, BrainCircuit,
  ChartNoAxesCombined, AlertTriangle, History, Trash2, Undo2,
  Loader2, ArrowUpRight
} from "lucide-react";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import {
  DESCRIPTIVE_MODES, REVIEW_STATUSES, READINESS_LABELS,
  formatText, formatDate, evaluatorLabel, getEmployeeName,
  filterDescriptiveQuestions, validateDescriptiveScore
} from "@/lib/descriptive/descriptiveUtils";

const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#F6490D] focus:ring-4 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:bg-gray-50";
const primaryClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F6490D] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#DC3F0A] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const dangerClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50";

function StatusBadge({ children, color = "gray" }) {
  const colors = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-blue-50 text-blue-700",
    orange: "bg-[#FFF1EC] text-[#F6490D]",
    purple: "bg-purple-50 text-purple-700"
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${colors[color] || colors.gray}`}>{children}</span>;
}

function Notice({ title, description, variant = "warning", children }) {
  const styles = {
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-blue-200 bg-blue-50 text-blue-700"
  };
  const Icon = variant === "success" ? CheckCircle2 : variant === "error" ? AlertCircle : AlertTriangle;
  return (
    <div className={`rounded-2xl border p-4 ${styles[variant]}`}>
      <div className="flex items-start gap-3">
        <Icon size={19} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className="mt-1 whitespace-pre-wrap text-xs leading-6">{description}</p>}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-[#111827]" }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function getScoringQuestionnaireId(c) {
  const id = c.mode === "performance" ? c.selectedId : c.workspace?.questionnaire_id || c.selectedRecord?.questionnaire_id;
  const value = String(id ?? "");
  return /^\d+$/.test(value) && Number(value) > 0 ? value : "";
}

function ModeTabs({ mode, onChange, disabled }) {
  return (
    <div role="tablist" aria-label="Descriptive scoring mode" className="relative grid max-w-xl grid-cols-2 rounded-2xl bg-gray-100 p-1.5">
      <div aria-hidden="true" className={`absolute bottom-1.5 top-1.5 w-[calc(50%-6px)] rounded-xl bg-white shadow-sm transition-transform duration-300 ease-out ${mode === "potential" ? "translate-x-full" : "translate-x-0"}`} style={{ left: 6 }} />
      {[
        { id: "performance", label: "Performance", icon: ChartNoAxesCombined },
        { id: "potential", label: "Potential", icon: BrainCircuit }
      ].map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" aria-selected={mode === id} disabled={disabled}
          onClick={() => onChange(id)}
          className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${mode === id ? "text-[#F6490D]" : "text-gray-500 hover:text-gray-800"}`}>
          <Icon size={19} /> {label}
        </button>
      ))}
    </div>
  );
}

function QuestionnaireSelector({ controller: c }) {
  const updateFilter = (key, value) => c.setFilters(previous => ({ ...previous, [key]: value }));
  return (
    <section className={cardClass}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#111827]">Select Employee Questionnaire</h2>
          <p className="mt-1 text-sm text-gray-500">Choose an employee and review cycle to access {DESCRIPTIVE_MODES[c.mode]} descriptive scoring.</p>
        </div>
        <button type="button" onClick={c.refreshQuestionnaires} disabled={c.loadingList || c.operationLocked} className={secondaryClass}>
          <RefreshCw size={16} className={c.loadingList ? "animate-spin" : ""} /> Refresh Questionnaires
        </button>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <input type="number" min="1" value={c.filters.cycle_id} disabled={c.operationLocked} onChange={event => updateFilter("cycle_id", event.target.value)} placeholder="Review Cycle ID" className={inputClass} />
        <input type="number" min="1" value={c.filters.employee_id} disabled={c.operationLocked} onChange={event => updateFilter("employee_id", event.target.value)} placeholder="Employee Database ID" className={inputClass} />
        <select value={c.filters.status} disabled={c.operationLocked} onChange={event => updateFilter("status", event.target.value)} className={inputClass}>
          <option value="">All Review Statuses</option>
          {REVIEW_STATUSES[c.mode].map(status => <option key={status} value={status}>{formatText(status)}</option>)}
        </select>
        <button type="button" onClick={c.applyFilters} disabled={c.loadingList || c.operationLocked} className={secondaryClass}><Search size={16} /> Apply Filters</button>
      </div>
      {c.listError && <Notice title="Unable to load questionnaires" description={c.listError} variant="error" />}
      {c.loadingList ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 size={18} className="animate-spin text-[#F6490D]" /> Loading questionnaires...</div>
      ) : !c.questionnaires.length ? (
        <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No questionnaires found for the selected filters.</div>
      ) : (
        <div className="max-h-[450px] space-y-3 overflow-y-auto pr-1">
          {c.questionnaires.map(item => {
            const selected = item.id === c.selectedId;
            const enabled = selected && c.preference ? c.preference.enabled : item.preference_enabled;
            return (
              <div key={item.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 transition-all duration-200 ${selected ? "border-[#F6490D] bg-[#FFF7F4]" : "border-gray-200 bg-[#FCFCFD] hover:shadow-sm"}`}>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{item.employee_name}{item.employee_number ? ` (${item.employee_number})` : ""}</p>
                  <p className="mt-1 text-xs text-gray-500">{item.department || "No Department"} · {item.review_cycle_name || "Review Cycle"}</p>
                  <p className="mt-1 text-xs text-gray-500">{c.mode === "potential" ? "Assessment" : "Questionnaire"} #{item.id}{item.question_count != null ? ` · ${item.question_count} Questions` : ""}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge color={item.status === "completed" ? "green" : "gray"}>{formatText(item.status)}</StatusBadge>
                    {typeof enabled === "boolean" && <StatusBadge color={enabled ? "green" : "amber"}>Descriptive Scoring {enabled ? "Enabled" : "Disabled"}</StatusBadge>}
                    {c.mode === "potential" && item.is_published === false && <StatusBadge color="amber">Unpublished</StatusBadge>}
                  </div>
                </div>
                <button type="button" onClick={() => c.selectQuestionnaire(item.id)} disabled={c.operationLocked} className={selected ? primaryClass : secondaryClass}>
                  <FileText size={16} /> {selected ? "Selected" : "Review Responses"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PreferenceStatus({ controller: c, onOpenScoring }) {
  if (!c.selectedId) return null;
  if (c.loadingPreference) return (
    <section className={cardClass}><div className="flex items-center gap-3 text-sm text-gray-600"><Loader2 size={18} className="animate-spin text-[#F6490D]" /> Checking descriptive scoring preference...</div></section>
  );
  if (c.preferenceError || !c.preference) return (
    <section className={cardClass}>
      <Notice title="Unable to verify descriptive scoring preference" description={c.preferenceError || c.workspaceError || "Preference data is unavailable."} variant="error">
        <button type="button" onClick={c.refreshWorkspace} disabled={c.operationLocked} className={secondaryClass}><RefreshCw size={16} /> Retry</button>
      </Notice>
    </section>
  );
  if (!c.preference.enabled) return (
    <section className={cardClass}>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-700"><LockKeyhole size={24} /></div>
          <div>
            <h2 className="text-lg font-semibold text-amber-900">{DESCRIPTIVE_MODES[c.mode]} Descriptive Scoring Disabled</h2>
            <p className="mt-2 text-sm leading-6 text-amber-800">{DESCRIPTIVE_MODES[c.mode]} calculations will use objective scores only while this preference is disabled.</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">Existing written evaluations and previously assigned descriptive marks are preserved. Enable this preference from Score & Analytics to access descriptive scoring.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={onOpenScoring} disabled={c.operationLocked} className={primaryClass}>Go to Score & Analytics <ArrowUpRight size={16} /></button>
              <button type="button" onClick={c.refreshWorkspace} disabled={c.operationLocked} className={secondaryClass}><RefreshCw size={16} /> Check Again</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
  return null;
}

function ReadinessStatus({ controller: c }) {
  const readiness = c.workspace?.readiness;
  if (c.mode !== "potential" || !readiness) return null;
  const status = readiness.readiness_status;
  const ready = readiness.ready_for_calculation === true;
  const descriptions = {
    evaluation_pending: "All required managers must submit their Potential evaluations before descriptive marks can be assigned.",
    legacy_reconciliation_required: "Unlinked historical descriptive responses must be reconciled before scoring can be completed.",
    objective_only: "Potential scoring currently uses objective ratings only.",
    responses_incomplete: "One or more required evaluation responses are missing or inconsistent.",
    no_descriptive_questions: "This Potential questionnaire does not contain descriptive questions.",
    descriptive_scoring_pending: "Assign consistent consolidated marks to all required descriptive questions.",
    ready: "All required evaluations and descriptive marks are complete. Potential score calculation can proceed."
  };
  return (
    <Notice title={READINESS_LABELS[status] || formatText(status)} description={descriptions[status]} variant={ready ? "success" : "warning"}>
      <div className="flex flex-wrap gap-2">
        <StatusBadge color={readiness.evaluation_complete ? "green" : "amber"}>{readiness.evaluation_complete ? "Evaluation Complete" : "Evaluation Pending"}</StatusBadge>
        <StatusBadge color="blue">{readiness.skip_required ? "RM + Skip-Level" : "RM Only"}</StatusBadge>
        {readiness.conflicting_questions > 0 && <StatusBadge color="red">{readiness.conflicting_questions} Conflicting Questions</StatusBadge>}
        {readiness.incomplete_questions > 0 && <StatusBadge color="amber">{readiness.incomplete_questions} Incomplete Questions</StatusBadge>}
        {readiness.unlinked_descriptive_responses > 0 && <StatusBadge color="red">{readiness.unlinked_descriptive_responses} Unlinked Responses</StatusBadge>}
      </div>
      {Array.isArray(readiness.missing_requirements) && readiness.missing_requirements.length > 0 && (
        <div className="mt-3 space-y-1">
          {readiness.missing_requirements.map((item, index) => <p key={index} className="text-xs leading-5">• {typeof item === "string" ? item : item.reason || item.message || JSON.stringify(item)}</p>)}
        </div>
      )}
    </Notice>
  );
}

function ScoringCompletion({ controller: c, onOpenScoring }) {
  const { progress, workspace, selectedRecord } = c;
  const modeLabel = DESCRIPTIVE_MODES[c.mode];
  const questionnaireId = getScoringQuestionnaireId(c);
  const complete = Boolean(
    c.selectedId && workspace && c.scoringEnabled &&
    !c.loadingWorkspace && !c.workspaceError && !c.preferenceError &&
    !c.conflict && !c.requiresReload && !c.dirty && !c.busy &&
    progress.total > 0 && progress.scored === progress.total &&
    progress.pending === 0 &&
    c.questions.every(question => question.is_scored && !question.has_conflict && question.responses_complete !== false) &&
    (c.mode !== "potential" || workspace.readiness?.ready_for_calculation === true)
  );
  if (!complete) return null;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm transition-all duration-300">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-emerald-100 p-3 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-emerald-900">{modeLabel} Descriptive Scoring Completed</h3>
              <StatusBadge color="green">100% Completed</StatusBadge>
            </div>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              All {progress.total} descriptive questions for <span className="font-semibold">{selectedRecord?.employee_name || workspace?.employee_name || "the selected employee"}</span> have received their consolidated scores successfully.
            </p>
            <p className="mt-2 text-xs leading-6 text-emerald-700">
              Continue to the Scoring Console to review calculation readiness and calculate or recalculate the applicable {modeLabel} score.
            </p>
            {!questionnaireId && (
              <p className="mt-2 text-xs font-medium text-amber-700">The linked Performance questionnaire ID is unavailable. Refresh the workspace before continuing.</p>
            )}
          </div>
        </div>
        <button type="button" onClick={onOpenScoring} disabled={c.operationLocked || !questionnaireId} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
          <ChartNoAxesCombined size={18} /> Go to Scoring Console <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  );
}

function WorkspaceOverview({ controller: c, onOpenScoring }) {
  const { progress, workspace, selectedRecord } = c;
  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-[#111827]">{DESCRIPTIVE_MODES[c.mode]} Descriptive Evaluation Overview</h2>
            <StatusBadge color="green">Scoring Enabled</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-gray-500">{selectedRecord?.employee_name || workspace?.employee_name || "Employee"} · {selectedRecord?.review_cycle_name || workspace?.review_cycle_name || "Review Cycle"}</p>
          <p className="mt-1 text-xs text-gray-500">{c.mode === "potential" ? "Assessment" : "Questionnaire"} #{c.selectedId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.mode === "potential" && <button type="button" onClick={c.loadHistory} disabled={c.operationLocked || c.historyLoading} className={secondaryClass}><History size={16} /> Scoring History</button>}
          <button type="button" onClick={c.refreshWorkspace} disabled={c.operationLocked} className={secondaryClass}><RefreshCw size={16} className={c.loadingWorkspace ? "animate-spin" : ""} /> Refresh Responses</button>
        </div>
      </div>
      {c.loadingWorkspace ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading descriptive responses...</p>
      ) : c.workspaceError ? (
        <div className="mt-6"><Notice title="Unable to load descriptive responses" description={c.workspaceError} variant="error" /></div>
      ) : workspace ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Questions" value={progress.total} />
            <StatCard label="Scored Questions" value={progress.scored} color="text-emerald-600" />
            <StatCard label="Pending Questions" value={progress.pending} color="text-amber-600" />
            <StatCard label="Completion" value={`${progress.percentage}%`} color="text-[#F6490D]" />
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs font-medium text-gray-600"><span>Consolidated Scoring Progress</span><span>{progress.scored} / {progress.total}</span></div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage} aria-label="Descriptive scoring completion" className="h-3 overflow-hidden rounded-full bg-gray-200">
              <div className={`h-full rounded-full transition-all duration-500 ${progress.percentage === 100 ? "bg-emerald-500" : "bg-[#F6490D]"}`} style={{ width: `${progress.percentage}%` }} />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <ReadinessStatus controller={c} />
            <ScoringCompletion controller={c} onOpenScoring={onOpenScoring} />
            {progress.total === 0 && <Notice title="No descriptive questions available" description="No descriptive questions or submitted descriptive responses are available for this questionnaire." />}
          </div>
        </>
      ) : <p className="mt-6 text-sm text-red-600">Unable to load descriptive workspace.</p>}
    </section>
  );
}

function DescriptiveQuestionCard({ controller: c, question, index }) {
  const draft = c.drafts[question.key] || { score: "", remarks: "", resolve_conflict: false };
  const changed = c.changedKeys.has(question.key);
  const isOpen = Boolean(c.expanded[question.key]);
  const disabled = c.controlsLocked || !question.can_score;
  const validationError = draft.score !== "" ? validateDescriptiveScore(question, draft) : null;
  const update = (field, value) => c.updateDraft(question.key, field, value);
  return (
    <div className="rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5 transition-all duration-300 hover:shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge color="orange">Question {index + 1}</StatusBadge>
          <StatusBadge color="blue">{question.category_name}</StatusBadge>
          {question.category_type && <StatusBadge>{formatText(question.category_type)}</StatusBadge>}
          {c.mode === "potential" && question.weightage != null && <StatusBadge color="purple">Weightage: {question.weightage}</StatusBadge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {changed && <StatusBadge color="orange">Unsaved Changes</StatusBadge>}
          <StatusBadge color={question.has_conflict ? "red" : !question.responses_complete ? "amber" : question.is_scored ? "green" : "amber"}>
            {question.has_conflict ? "Conflicting Marks" : !question.responses_complete ? "Incomplete Responses" : question.is_scored ? "Scored" : "Pending"}
          </StatusBadge>
        </div>
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Descriptive Question</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#111827]">{question.question_text}</p>
      <button type="button" disabled={Boolean(c.confirmation)} onClick={() => c.setExpanded(previous => ({ ...previous, [question.key]: !previous[question.key] }))} className={`${secondaryClass} mt-4`}>
        <Users size={16} /> {isOpen ? "Hide Responses" : `View All Responses (${question.responses.length})`} {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && (
        <div className="mt-4 space-y-3">
          {!question.responses.length && <p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-500">No submitted responses available.</p>}
          {question.responses.map(response => (
            <div key={response.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge color="orange">{evaluatorLabel(response.evaluator_type)}</StatusBadge>
                <span className="text-xs text-gray-500">Response #{response.id}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Submitted By: {response.submitted_by || "—"} · {formatDate(response.submitted_at)}</p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#111827]">{response.descriptive_answer}</p>
              {response.admin_score != null && (
                <div className="mt-3 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-600">Saved Admin Score: {response.admin_score}/{question.max_marks}</p>
                  {response.admin_remarks && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-gray-500">{response.admin_remarks}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!question.can_score && (
        <div className="mt-4"><Notice title="Scoring currently unavailable" description="All required manager evaluations and valid responses must be available before this question can be scored." /></div>
      )}
      {question.has_conflict && (
        <div className="mt-4">
          <Notice title="Conflicting consolidated marks" description="Existing evaluator responses have inconsistent scores, remarks or incomplete marks. Enter one consolidated score and consistent remarks to synchronize them.">
            <label className="flex items-start gap-2 text-xs font-medium">
              <input type="checkbox" checked={draft.resolve_conflict} disabled={disabled} onChange={event => update("resolve_conflict", event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#F6490D]" />
              Apply the consolidated score and remarks below to all applicable responses.
            </label>
          </Notice>
        </div>
      )}
      <div className="mt-5 grid gap-4 border-t border-gray-200 pt-5 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#111827]">Consolidated Admin Score (1–{question.max_marks})</label>
          <input type="number" min="1" max={question.max_marks} step="1" value={draft.score} disabled={disabled}
            onChange={event => update("score", event.target.value)} placeholder={`Enter score from 1 to ${question.max_marks}`} className={inputClass} />
          {validationError && !disabled && <p className="mt-2 text-xs text-red-600">{validationError}</p>}
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[#111827]">Consolidated Admin Remarks (Optional)</label>
          <textarea rows={3} value={draft.remarks} disabled={disabled} onChange={event => update("remarks", event.target.value)}
            placeholder="Enter consolidated evaluation remarks..." className={inputClass} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">{changed ? "Unsaved consolidated score changes" : "No unsaved changes"}</p>
        <div className="flex flex-wrap gap-2">
          {c.mode === "potential" && question.has_saved_marks && (
            <button type="button" onClick={() => c.clearQuestionScores(question)} disabled={disabled} className={dangerClass}><Trash2 size={15} /> Clear Saved Score</button>
          )}
          <button type="button" onClick={() => c.saveQuestion(question)} disabled={disabled || !changed || Boolean(validationError) || draft.score === ""} className={primaryClass}>
            <Save size={15} /> Save Consolidated Score
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoringHistory({ controller: c }) {
  if (!c.historyOpen || c.mode !== "potential") return null;
  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#111827]">Potential Descriptive Scoring History</h2>
          <p className="mt-1 text-sm text-gray-500">Audit trail of scoring, preference and calculation changes.</p>
        </div>
        <button type="button" onClick={() => c.setHistoryOpen(false)} className={secondaryClass}>Close History</button>
      </div>
      <div className="mt-5 space-y-3">
        {c.historyLoading ? <p className="text-sm text-gray-500">Loading scoring history...</p> : c.historyError ? (
          <Notice title="Unable to load scoring history" description={c.historyError} variant="error">
            <button type="button" onClick={c.loadHistory} className={secondaryClass}>Retry</button>
          </Notice>
        ) : !c.history.length ? (
          <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No scoring history available.</p>
        ) : (
          <div className="max-h-[450px] space-y-3 overflow-y-auto">
            {c.history.map(item => (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-[#FCFCFD] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge color="orange">{formatText(item.action)}</StatusBadge>
                  <span className="text-xs text-gray-500">{formatDate(item.changed_at)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-800">{getEmployeeName(item.changed_by) || "System / Administrator"}</p>
                <p className="mt-1 text-xs text-gray-500">Status: {formatText(item.previous_status) || "—"} → {formatText(item.new_status) || "—"}</p>
                {(item.previous_score != null || item.new_score != null) && <p className="mt-1 text-xs text-gray-500">Descriptive Score: {item.previous_score ?? "—"} → {item.new_score ?? "—"}</p>}
                {item.change_details?.invalidated_results?.length > 0 && <p className="mt-2 text-xs text-amber-700">Invalidated: {item.change_details.invalidated_results.map(formatText).join(", ")}</p>}
                {Array.isArray(item.change_details?.questions) && (
                  <div className="mt-3 space-y-2">
                    {item.change_details.questions.map(question => (
                      <div key={question.questionnaire_item_id} className="rounded-lg bg-white p-3 text-xs text-gray-600">
                        <p>Question #{question.questionnaire_item_id}: {question.previous_score ?? "Unscored"} → {question.new_score ?? "Unscored"}</p>
                        {question.new_remarks && <p className="mt-1 whitespace-pre-wrap">{question.new_remarks}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function DescriptiveWorkspace({ controller: c }) {
  const router = useRouter();
  const filteredQuestions = useMemo(() => filterDescriptiveQuestions(c.questions, c.questionFilters), [c.questions, c.questionFilters]);
  const updateQuestionFilter = (key, value) => c.setQuestionFilters(previous => ({ ...previous, [key]: value }));
  const openScoring = () => {
    if (c.operationLocked) return;
    const questionnaireId = getScoringQuestionnaireId(c);
    const params = new URLSearchParams();
    if (questionnaireId) params.set("questionnaire_id", questionnaireId);
    c.guardUnsaved(() => router.push(`/admin-console/score-analytics${params.size ? `?${params}` : ""}`), "Leave Descriptive Scoring?");
  };

  useEffect(() => {
    if (!c.dirty && !c.busy) return;
    const handler = event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      if (c.busy) return;
      c.guardUnsaved(() => router.push(`${destination.pathname}${destination.search}${destination.hash}`), "Leave Descriptive Scoring?");
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [c.dirty, c.busy, c.guardUnsaved, router]);

  return (
    <div className="space-y-8">
      <AdminConfirmDialog open={Boolean(c.confirmation)} title={c.confirmation?.title} description={c.confirmation?.description}
        confirmText={c.confirmation?.confirmText} cancelText={c.confirmation?.cancelText} variant={c.confirmation?.variant}
        loading={c.confirmationLoading} onConfirm={c.handleConfirmation} onCancel={c.closeConfirmation} />
      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">Descriptive Response Scoring</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">Review evaluator responses and assign consolidated descriptive marks independently for Performance and Potential questionnaires.</p>
            <p className="mt-2 text-xs text-gray-500">Only questionnaires with their respective descriptive scoring preference enabled can be scored.</p>
          </div>
          <div className="rounded-2xl bg-[#FFF1EC] p-4 text-[#F6490D]"><FileText size={28} /></div>
        </div>
        <div className="mt-6"><ModeTabs mode={c.mode} onChange={c.switchMode} disabled={c.operationLocked} /></div>
      </section>
      <QuestionnaireSelector controller={c} />
      <PreferenceStatus controller={c} onOpenScoring={openScoring} />
      {c.selectedId && c.conflict && (
        <Notice title="Descriptive scoring revision conflict" description="The assessment has changed on the server. Your unsaved edits are preserved locally. Refresh the workspace before attempting another save.">
          <button type="button" onClick={c.refreshWorkspace} disabled={c.operationLocked} className={secondaryClass}><RefreshCw size={16} /> Refresh Workspace</button>
        </Notice>
      )}
      {c.selectedId && c.requiresReload && (
        <Notice title="Changes saved — refresh required" description="Your changes were saved successfully, but the latest workspace could not be retrieved. Editing is disabled until the workspace is refreshed.">
          <button type="button" onClick={c.refreshWorkspace} disabled={c.operationLocked} className={secondaryClass}><RefreshCw size={16} /> Reload Workspace</button>
        </Notice>
      )}
      {c.selectedId && c.scoringEnabled && (
        <>
          <WorkspaceOverview controller={c} onOpenScoring={openScoring} />
          <ScoringHistory controller={c} />
          {c.workspace && c.questions.length > 0 && !c.workspaceError && (
            <section className={cardClass}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#111827]">Evaluate {DESCRIPTIVE_MODES[c.mode]} Descriptive Questions</h2>
                  <p className="mt-1 text-sm text-gray-500">Read all applicable evaluator responses and assign one consolidated score per question.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={c.discardDrafts} disabled={c.operationLocked || !c.dirty} className={secondaryClass}><Undo2 size={16} /> Discard Changes</button>
                  <button type="button" onClick={c.saveAll} disabled={c.controlsLocked || !c.dirty} className={primaryClass}>
                    {c.busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {c.busy ? "Saving..." : `Save All Changes (${c.changedQuestions.length})`}
                  </button>
                </div>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <select value={c.questionFilters.evaluator} disabled={c.operationLocked} onChange={event => updateQuestionFilter("evaluator", event.target.value)} className={inputClass}>
                  <option value="">All Evaluators</option>
                  {c.mode === "performance" && <option value="self">Self Evaluation</option>}
                  <option value="rm">Reporting Manager</option>
                  <option value="skip">Skip-Level Manager</option>
                  {c.mode === "performance" && <option value="peer">Peer Reviewers</option>}
                </select>
                <select value={c.questionFilters.scoring} disabled={c.operationLocked} onChange={event => updateQuestionFilter("scoring", event.target.value)} className={inputClass}>
                  <option value="">All Scoring Statuses</option>
                  <option value="pending">Pending Scoring</option>
                  <option value="scored">Already Scored</option>
                  <option value="conflict">Conflicting Marks</option>
                  {c.mode === "potential" && <option value="incomplete">Incomplete Responses</option>}
                </select>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  <input type="text" value={c.questionFilters.search} disabled={c.operationLocked} onChange={event => updateQuestionFilter("search", event.target.value)} placeholder="Search questions or responses" className={`${inputClass} pl-9`} />
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500">Showing {filteredQuestions.length} of {c.questions.length} descriptive questions · {c.progress.responses} submitted responses.</p>
              <div className="mt-6 space-y-5">
                {!filteredQuestions.length ? (
                  <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No descriptive questions match the selected filters.</p>
                ) : filteredQuestions.map(question => (
                  <DescriptiveQuestionCard key={question.key} controller={c} question={question} index={c.questions.findIndex(item => item.key === question.key)} />
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-5">
                <p className="text-sm text-gray-600">{c.changedQuestions.length} descriptive question(s) with unsaved changes.</p>
                <button type="button" onClick={c.saveAll} disabled={c.controlsLocked || !c.dirty} className={primaryClass}>
                  {c.busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {c.busy ? "Saving..." : "Save All Changed Scores"}
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}