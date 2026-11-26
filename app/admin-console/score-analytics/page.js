"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";
import NineBoxMatrixCard from "@/components/NineBoxMatrixCard";
import AdminConfirmDialog from "@/components/admin/AdminConfirmDialog";
import DescriptiveScoringConfiguration from "@/components/admin/scoring/DescriptiveScoringConfiguration";
import useScoringPreferences from "@/hooks/useScoringPreferences";
import { useScoringReadiness } from "@/hooks/useScoringReadiness";
import {
  createScoringAPI, requiresInvalidationConfirmation, formatDependencyName,
  getAffectedResultKeys, formatScoringWeight, RESULT_KEYS, RESULT_ENGINE_MAP,
  isCurrentResult, resultPath, calculationPath, getEngineBlockers,
  formatMissingRequirement, emptyResults, emptyVisibility
} from "@/lib/scoring/scoringConsoleUtils";

const ANALYTICS_EVENT = "tor:analytics-release-changed";
const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-[#111827] outline-none transition focus:border-[#F6490D]/25 focus:ring-4 focus:ring-[#F6490D]/8 disabled:opacity-60";
const panelClass = "rounded-2xl border border-gray-200 bg-[#FCFCFD] p-4";
const highlightClass = "rounded-2xl border border-gray-200 bg-[#FFF7F4] p-4";
const primaryClass = "rounded-xl bg-[#F6490D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60";
const darkClass = "rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass = "rounded-xl bg-gray-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60";
const downstreamKeys = {
  score: ["score", "ppi", "ninebox", "appraisal"],
  ppi: ["ppi", "ninebox", "appraisal"],
  potential: ["potential", "ninebox", "appraisal"],
  ninebox: ["ninebox", "appraisal"],
  appraisal: ["appraisal"]
};
const calculationMessages = {
  score: "Performance score calculated successfully.",
  ppi: "PPI calculated successfully.",
  potential: "Potential score calculated successfully.",
  ninebox: "9-box placement generated successfully.",
  appraisal: "Appraisal recommendation generated successfully."
};

function ValuePanel({ label, value, highlight = false }) {
  return <div className={highlight ? highlightClass : panelClass}><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className={`mt-2 font-semibold text-[#111827] ${highlight ? "text-2xl" : "text-lg"}`}>{value ?? "—"}</p></div>;
}

function DetailRow({ label, value }) {
  return <p className="text-sm text-[#111827]">{label}: <span className="font-semibold">{value ?? "—"}</span></p>;
}

function ComponentBreakdown({ data }) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <div className={panelClass}>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Component Scores</p>
        <DetailRow label="Objective Score" value={data.objective_final_score} />
        <DetailRow label="Descriptive Score" value={data.descriptive_final_score} />
        <DetailRow label="Descriptive Applied" value={data.descriptive_scoring_applied ? "Yes" : "No"} />
      </div>
      <div className={panelClass}>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Effective Component Weights</p>
        <DetailRow label="Objective Weight" value={formatScoringWeight(data.effective_objective_component_weight)} />
        <DetailRow label="Descriptive Weight" value={formatScoringWeight(data.effective_descriptive_component_weight)} />
      </div>
    </div>
  );
}

function ScoreBreakdownCard({ scoreData }) {
  if (!scoreData) return null;
  return (
    <div className={cardClass}>
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[#111827]">Score Result</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {[["Self Scores", "self"], ["RM Scores", "rm"], ["Skip Scores", "skip"], ["Peer Scores", "peer"]].map(([title, key]) => (
          <div key={key} className={panelClass}>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
            <DetailRow label="Behavioural" value={scoreData[`${key}_behavioural_score`]} />
            <DetailRow label="Performance" value={scoreData[`${key}_performance_score`]} />
            <DetailRow label="Total" value={scoreData[`${key}_score`]} />
          </div>
        ))}
      </div>
      <ComponentBreakdown data={scoreData} />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className={panelClass}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Effective Evaluator Weights</p>
          {["self", "rm", "skip", "peer"].map(key => <DetailRow key={key} label={key === "rm" ? "RM" : key.charAt(0).toUpperCase() + key.slice(1)} value={formatScoringWeight(scoreData[`effective_${key}_weight`])} />)}
        </div>
        <div className={highlightClass}>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Final Scores</p>
          <DetailRow label="System Final Score" value={scoreData.system_final_score} />
          <DetailRow label="HR Override Score" value={scoreData.hr_override_score} />
          <DetailRow label="Effective Final Score" value={scoreData.final_effective_score} />
          <DetailRow label="Released To Employee" value={scoreData.is_released_to_employee ? "Yes" : "No"} />
        </div>
      </div>
    </div>
  );
}

function PotentialScoreCard({ data }) {
  if (!data) return null;
  return (
    <div className={cardClass}>
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[#111827]">Potential Score</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <ValuePanel label="RM Potential Score" value={data.rm_score} />
        <ValuePanel label="Skip Potential Score" value={data.skip_score} />
        <ValuePanel label="Effective RM Weight" value={formatScoringWeight(data.effective_rm_weight)} />
        <ValuePanel label="Effective Skip Weight" value={formatScoringWeight(data.effective_skip_weight)} />
      </div>
      <ComponentBreakdown data={data} />
      <div className="mt-5"><ValuePanel label="Final Potential Score" value={data.final_potential_score} highlight /></div>
    </div>
  );
}

function AppraisalRecommendationCard({ appraisalData }) {
  if (!appraisalData) return null;
  return (
    <div className={cardClass}>
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[#111827]">Appraisal Recommendation</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={panelClass}>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Classification Used</p>
          <p className="my-3 text-lg font-semibold">{appraisalData.box_label ?? "—"}</p>
          <DetailRow label="PPI Score Used" value={appraisalData.ppi_score_used} />
          <DetailRow label="Potential Score Used" value={appraisalData.potential_score_used} />
        </div>
        <div className={panelClass}>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Configured Range</p>
          <p className="my-3 text-lg font-semibold">{appraisalData.min_appraisal_percent ?? "—"}% - {appraisalData.max_appraisal_percent ?? "—"}%</p>
          <DetailRow label="Suggested Appraisal" value={appraisalData.suggested_appraisal_percent != null ? `${appraisalData.suggested_appraisal_percent}%` : null} />
          <DetailRow label="Final Effective Appraisal" value={appraisalData.final_effective_appraisal_percent != null ? `${appraisalData.final_effective_appraisal_percent}%` : null} />
        </div>
      </div>
      <div className={`mt-4 ${highlightClass}`}>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Override Status</p>
        <DetailRow label="HR Override Percent" value={appraisalData.hr_override_percent != null ? `${appraisalData.hr_override_percent}%` : null} />
        <DetailRow label="Override Reason" value={appraisalData.override_reason} />
        <DetailRow label="Overridden By" value={appraisalData.overridden_by} />
      </div>
    </div>
  );
}

function WorkflowActionCard({ workflow, busy, onCalculate, onView }) {
  const badgeStyles = {
    current: "bg-emerald-50 text-emerald-700",
    ready: "bg-blue-50 text-blue-700",
    outdated: "bg-amber-50 text-amber-700",
    blocked: "bg-gray-100 text-gray-600",
    loading: "bg-gray-100 text-gray-500",
    unavailable: "bg-red-50 text-red-700"
  };
  return (
    <div className="group rounded-2xl bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#111827]">{workflow.title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${badgeStyles[workflow.status] || badgeStyles.unavailable}`}>{workflow.label}</span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-gray-600">{workflow.description}</p>
      {workflow.blockers?.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3">
          <p className="mb-1 text-xs font-semibold text-amber-800">{workflow.available ? "Recalculation Information" : "Pending Requirements"}</p>
          <ul className="space-y-1 text-xs leading-5 text-amber-700">{workflow.blockers.map((item, index) => <li key={index}>• {item}</li>)}</ul>
        </div>
      )}
      {workflow.error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-xs leading-5 text-red-700">{workflow.error}</p>}
      <div className="flex flex-wrap items-center gap-6 text-sm font-medium">
        <button type="button" disabled={!workflow.available} onClick={() => onCalculate(workflow.key)} className="flex items-center gap-1 text-[#F6490D] transition hover:gap-2 disabled:cursor-not-allowed disabled:opacity-40">{busy === `calculate-${workflow.key}` ? "Processing..." : workflow.primary}<span>→</span></button>
        <button type="button" disabled={!workflow.viewable} onClick={() => onView(workflow.key)} className="flex items-center gap-1 text-[#111827] transition hover:gap-2 disabled:cursor-not-allowed disabled:opacity-40">{busy === `view-${workflow.key}` ? "Loading..." : workflow.secondary}<span>→</span></button>
      </div>
    </div>
  );
}

function ScoringProgressCard({ progress, verified, loading, updatedAt }) {
  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#111827]">Scoring Workflow Progress</h3>
          <p className="mt-1 text-xs text-gray-500">{loading ? "Verifying current backend readiness..." : verified ? `${progress.current} of ${progress.total} scoring results are current.` : "Scoring readiness has not been verified."}</p>
        </div>
        <span className="text-xl font-bold text-[#F6490D]">{verified ? `${progress.percentage}%` : "—"}</span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#F6490D] transition-all duration-500" style={{ width: `${verified ? progress.percentage : 0}%` }} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Calculated", progress.calculated], ["Current", progress.current], ["Outdated", progress.outdated], ["Blocked", progress.blocked]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#F9FAFB] p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">{verified ? value : "—"}</p>
          </div>
        ))}
      </div>
      {verified && updatedAt && <p className="mt-3 text-[11px] text-gray-400">Last verified: {new Date(updatedAt).toLocaleString()}</p>}
    </div>
  );
}

function AnalyticsReleaseSuccess({ employee, employeeNumber }) {
  const isOwnReport = String(employee.employee_number || "") === String(employeeNumber || "");
  return (
    <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800">Analytics Report Successfully Released</p>
            <p className="mt-1 text-sm leading-6 text-emerald-700">The performance analytics report is now available to {employee.employee_name}.</p>
            <p className="mt-1 text-xs text-emerald-600">The employee can access the report from the Analytics Result section.</p>
          </div>
        </div>
        {isOwnReport && (
          <Link href="/analytics-result" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md">
            View Analytics Report
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AdminScoringPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const isAdminScoringUser = String(user?.employee_number || "") === "100607";
  if (authLoading) return <div className={cardClass}><p className="text-sm text-gray-600">Loading scoring console...</p></div>;
  if (!isAdminScoringUser || !accessToken) return <div className={cardClass}><p className="text-sm text-red-600">You are not authorized to access this page.</p></div>;
  return <ScoringConsole key={`${user.employee_number}:${accessToken}`} accessToken={accessToken} employeeNumber={user.employee_number} />;
}

function ScoringConsole({ accessToken, employeeNumber }) {
  const api = useMemo(() => createScoringAPI(accessToken), [accessToken]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [questionnaireQuery, setQuestionnaireQuery] = useState("");
  const [showQuestionnaireResults, setShowQuestionnaireResults] = useState(false);
  const [results, setResults] = useState(emptyResults);
  const [visibility, setVisibility] = useState(emptyVisibility);
  const [resultErrors, setResultErrors] = useState({});
  const [busy, setBusy] = useState("");
  const [analyticsReleaseData, setAnalyticsReleaseData] = useState(null);
  const [releaseError, setReleaseError] = useState("");
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [appraisalOverridePercent, setAppraisalOverridePercent] = useState("");
  const [appraisalOverrideReason, setAppraisalOverrideReason] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [invalidationNotice, setInvalidationNotice] = useState(null);
  const [reconciliationError, setReconciliationError] = useState("");
  const activeIdRef = useRef("");
  const selectionVersion = useRef(0);
  const listVersion = useRef(0);
  const operationRef = useRef(null);
  const confirmationRef = useRef(null);
  const confirmingRef = useRef(null);
  const mountedRef = useRef(true);
  const deepLinkHandledRef = useRef(false);
  const resultRequestsRef = useRef({});
  const releaseRequestRef = useRef(null);
  const selectedQuestionnaire = questionnaires.find(item => String(item.questionnaire_id) === selectedId) || null;
  const selectedAssessmentId = selectedQuestionnaire?.assessment_id || null;
  const scoring = useScoringReadiness(accessToken, selectedId, employeeNumber);
  const preferences = useScoringPreferences(accessToken, selectedId, selectedAssessmentId);
  const { performance, potential, performanceReady, potentialReady, savePreference, refreshPreference, refreshAllPreferences } = preferences;
  const { readiness, engines, analyticsRelease, progress, verified, refresh: refreshReadiness } = scoring;
  const workflowBusy = Boolean(busy || confirmation || confirmationLoading || preferences.saving);
  const canOperate = !workflowBusy && verified;
  const scoreData = scoring.isCurrent("performance") && isCurrentResult("score", results.score) ? results.score : null;
  const ppiData = scoring.isCurrent("ppi") && isCurrentResult("ppi", results.ppi) ? results.ppi : null;
  const potentialData = scoring.isCurrent("potential") && isCurrentResult("potential", results.potential) ? results.potential : null;
  const nineBoxData = scoring.isCurrent("ninebox") && isCurrentResult("ninebox", results.ninebox) ? results.ninebox : null;
  const appraisalData = scoring.isCurrent("appraisal") && isCurrentResult("appraisal", results.appraisal) ? results.appraisal : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      selectionVersion.current++;
      listVersion.current++;
      operationRef.current = null;
      confirmationRef.current = null;
      confirmingRef.current = null;
      Object.values(resultRequestsRef.current).forEach(controller => controller.abort());
      resultRequestsRef.current = {};
      releaseRequestRef.current?.abort();
    };
  }, []);

  const loadQuestionnaires = useCallback(async (initial = false) => {
    const version = ++listVersion.current;
    if (initial) setLoading(true);
    setListError("");
    try {
      const data = await api("/api/scoring/admin/questionnaires");
      const rows = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      if (mountedRef.current && version === listVersion.current) setQuestionnaires(rows);
      return rows;
    } catch (error) {
      if (mountedRef.current && version === listVersion.current) setListError(error.message || "Unable to load questionnaires.");
      throw error;
    } finally {
      if (mountedRef.current && version === listVersion.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadQuestionnaires(true).catch(() => {});
    return () => { listVersion.current++; };
  }, [loadQuestionnaires]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest("[data-questionnaire-search]")) setShowQuestionnaireResults(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isCurrentSelection = useCallback((id, version) => mountedRef.current && activeIdRef.current === String(id) && selectionVersion.current === version, []);

  function setResult(key, data, show = false, resetOverride = false) {
    setResults(previous => ({ ...previous, [key]: data }));
    if (show || !data) setVisibility(previous => ({ ...previous, [key]: Boolean(data && show) }));
    if (key === "score" && (show || resetOverride || !data)) {
      setOverrideScore(data?.hr_override_score ?? "");
      setOverrideReason(data?.override_reason ?? "");
    }
    if (key === "appraisal" && (show || resetOverride || !data)) {
      setAppraisalOverridePercent(data?.hr_override_percent ?? "");
      setAppraisalOverrideReason(data?.override_reason ?? "");
    }
  }

  const clearResults = useCallback(keys => {
    keys.forEach(key => {
      resultRequestsRef.current[key]?.abort();
      delete resultRequestsRef.current[key];
    });
    setResults(previous => ({ ...previous, ...Object.fromEntries(keys.map(key => [key, null])) }));
    setVisibility(previous => ({ ...previous, ...Object.fromEntries(keys.map(key => [key, false])) }));
    setResultErrors(previous => {
      const next = { ...previous };
      keys.forEach(key => delete next[key]);
      return next;
    });
    if (keys.includes("score")) {
      setOverrideScore("");
      setOverrideReason("");
    }
    if (keys.includes("appraisal")) {
      setAppraisalOverridePercent("");
      setAppraisalOverrideReason("");
    }
  }, []);

  const handleSelectQuestionnaire = useCallback(selected => {
    if (operationRef.current || confirmationRef.current || confirmingRef.current) return;
    const id = selected ? String(selected.questionnaire_id) : "";
    selectionVersion.current++;
    activeIdRef.current = id;
    Object.values(resultRequestsRef.current).forEach(controller => controller.abort());
    resultRequestsRef.current = {};
    releaseRequestRef.current?.abort();
    releaseRequestRef.current = null;
    setSelectedId(id);
    setQuestionnaireQuery(selected ? `${selected.employee_name} (${selected.employee_number})` : "");
    setShowQuestionnaireResults(false);
    setResults(emptyResults());
    setVisibility(emptyVisibility());
    setResultErrors({});
    setOverrideScore("");
    setOverrideReason("");
    setAppraisalOverridePercent("");
    setAppraisalOverrideReason("");
    setAnalyticsReleaseData(null);
    setReleaseError("");
    setInvalidationNotice(null);
    setReconciliationError("");
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("questionnaire_id", id);
    else url.searchParams.delete("questionnaire_id");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    if (loading || listError || deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    const id = new URLSearchParams(window.location.search).get("questionnaire_id");
    if (!id) return;
    const selected = questionnaires.find(item => String(item.questionnaire_id) === id);
    if (selected) handleSelectQuestionnaire(selected);
    else toast.error("The requested questionnaire is unavailable.");
  }, [loading, listError, questionnaires, handleSelectQuestionnaire]);

  const fetchAnalyticsReleaseStatus = useCallback(async (id, version) => {
    releaseRequestRef.current?.abort();
    const controller = new AbortController();
    releaseRequestRef.current = controller;
    try {
      const data = await api(`/api/scoring/analytics-release/${id}`, "GET", undefined, controller.signal);
      if (!data || typeof data.is_released_to_employee !== "boolean") throw new Error("Invalid analytics release response.");
      if (isCurrentSelection(id, version) && releaseRequestRef.current === controller) {
        setAnalyticsReleaseData(data);
        setReleaseError("");
      }
      return data;
    } catch (error) {
      if (error.name !== "AbortError" && isCurrentSelection(id, version) && releaseRequestRef.current === controller) {
        setAnalyticsReleaseData(null);
        setReleaseError(error.message || "Unable to verify analytics release metadata.");
      }
      return null;
    } finally {
      if (releaseRequestRef.current === controller) releaseRequestRef.current = null;
    }
  }, [api, isCurrentSelection]);

  useEffect(() => {
    if (!selectedId) return;
    fetchAnalyticsReleaseStatus(selectedId, selectionVersion.current);
  }, [selectedId, fetchAnalyticsReleaseStatus]);

  useEffect(() => {
    if (!verified || !readiness || String(readiness.questionnaire_id) !== selectedId) return;
    const outdated = RESULT_KEYS.filter(key => readiness[RESULT_ENGINE_MAP[key]]?.is_current !== true);
    if (outdated.length) clearResults(outdated);
    setInvalidationNotice(previous => {
      if (!previous) return null;
      return previous.keys.every(key => readiness[RESULT_ENGINE_MAP[key]]?.is_current === true) ? null : previous;
    });
  }, [verified, readiness, selectedId, clearResults]);

  const filteredQuestionnaires = questionnaires.filter(q => {
    const query = questionnaireQuery.trim().toLowerCase();
    return !query || [q.employee_name, q.employee_number, q.department, q.review_cycle, q.cycle, q.questionnaire_id, `${q.employee_name} (${q.employee_number})`].some(value => String(value ?? "").toLowerCase().includes(query));
  });

  async function fetchResultData(key, id, version, assessmentId, show = false, resetOverride = false) {
    if (!isCurrentSelection(id, version)) return null;
    if (key === "potential" && !assessmentId) return null;
    resultRequestsRef.current[key]?.abort();
    const controller = new AbortController();
    resultRequestsRef.current[key] = controller;
    try {
      const data = await api(resultPath(key, id, assessmentId), "GET", undefined, controller.signal);
      if (!isCurrentSelection(id, version) || resultRequestsRef.current[key] !== controller) return null;
      if (!isCurrentResult(key, data)) throw new Error("This result is outdated or the server returned an invalid result.");
      setResult(key, data, show, resetOverride);
      setResultErrors(previous => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
      return data;
    } catch (error) {
      if (error.name === "AbortError" || !isCurrentSelection(id, version) || resultRequestsRef.current[key] !== controller) return null;
      setResult(key, null);
      setResultErrors(previous => ({ ...previous, [key]: error.message || "Unable to retrieve result." }));
      return null;
    } finally {
      if (resultRequestsRef.current[key] === controller) delete resultRequestsRef.current[key];
    }
  }

  async function reconcileBackend(id, version, assessmentId, options = {}) {
    const {
      affectedKeys = [], showKey = null, refreshList = false,
      refreshPreferences = true
    } = options;
    if (!isCurrentSelection(id, version)) return null;
    setReconciliationError("");
  
    const auxiliaryRequests = Promise.allSettled([
      fetchAnalyticsReleaseStatus(id, version),
      refreshPreferences ? refreshAllPreferences() : Promise.resolve(null),
      refreshList ? loadQuestionnaires() : Promise.resolve(null)
    ]);
  
    let fresh;
    try {
      fresh = await refreshReadiness();
    } catch {
      fresh = null;
    }
  
    if (!isCurrentSelection(id, version)) return null;
  
    if (!fresh || String(fresh.questionnaire_id) !== String(id)) {
      clearResults(affectedKeys);
      setReconciliationError("Unable to verify the latest scoring readiness. Refresh status before continuing.");
      await auxiliaryRequests;
      return null;
    }
  
    const outdatedKeys = RESULT_KEYS.filter(key => fresh[RESULT_ENGINE_MAP[key]]?.is_current !== true);
    if (outdatedKeys.length) clearResults(outdatedKeys);
  
    const keysToFetch = [...new Set([
      ...affectedKeys.filter(key => visibility[key] || results[key]),
      ...(showKey ? [showKey] : [])
    ])].filter(key => fresh[RESULT_ENGINE_MAP[key]]?.is_current === true);
  
    const resolvedAssessmentId = fresh.assessment_id ?? assessmentId;
  
    await Promise.allSettled([
      auxiliaryRequests,
      ...keysToFetch.map(key => fetchResultData(
        key, id, version, resolvedAssessmentId,
        key === showKey, affectedKeys.includes(key)
      ))
    ]);
  
    if (!isCurrentSelection(id, version)) return null;
  
    setInvalidationNotice(previous =>
      previous && previous.keys.every(key =>
        fresh[RESULT_ENGINE_MAP[key]]?.is_current === true
      ) ? null : previous
    );
  
    return fresh;
  }

  async function runOperation(name, action, options = {}) {
    const { fromConfirmation = false, rethrow = false, requireVerification = false } = options;
    if (!selectedId || operationRef.current) return null;
    if ((confirmationRef.current || confirmingRef.current) && !fromConfirmation) return null;
    if (requireVerification && !verified) {
      toast.error("Scoring readiness must be verified first.");
      return null;
    }
    const id = selectedId;
    const version = selectionVersion.current;
    const assessmentId = selectedAssessmentId;
    const operation = Symbol(name);
    operationRef.current = operation;
    setBusy(name);
    try {
      return await action(id, version, assessmentId);
    } catch (error) {
      if (!isCurrentSelection(id, version)) return null;
      if (rethrow) throw error;
      toast.error(error.message || "Operation failed.");
      return null;
    } finally {
      if (operationRef.current === operation) {
        operationRef.current = null;
        if (isCurrentSelection(id, version)) setBusy("");
      }
    }
  }

  async function executeMutation(id, version, assessmentId, mutation, options = {}) {
    const {
      affectedKeys = [], showKey = null,
      successMessage = "Operation completed successfully.",
      refreshList = false, refreshPreferences = true
    } = options;
  
    let response;
    try {
      response = await mutation();
    } catch (error) {
      if (!isCurrentSelection(id, version)) return null;
      if (requiresInvalidationConfirmation(error)) throw error;
      clearResults(affectedKeys);
      setAnalyticsReleaseData(null);
      await reconcileBackend(id, version, assessmentId, {
        affectedKeys, refreshList, refreshPreferences: true
      });
      throw error;
    }
  
    if (!isCurrentSelection(id, version) || response?.stale) return null;
  
    if (response?.invalidation?.invalidated === true) {
      clearResults(affectedKeys);
      setAnalyticsReleaseData(null);
    }
  
    const fresh = await reconcileBackend(id, version, assessmentId, {
      affectedKeys, showKey, refreshList, refreshPreferences
    });
  
    if (!isCurrentSelection(id, version)) return null;
  
    if (fresh) {
      toast.success(response?.message || successMessage);
    } else {
      toast.warning("The operation was saved, but the latest scoring state could not be verified. Refresh status before continuing.");
    }
  
    return { response, readiness: fresh };
  }

  function openConfirmation(config) {
    if (operationRef.current || confirmationRef.current || confirmingRef.current) return;
    confirmationRef.current = config;
    setConfirmation(config);
  }

  function closeConfirmation() {
    if (confirmingRef.current) return;
    confirmationRef.current = null;
    setConfirmation(null);
  }

  async function handleConfirmation() {
    const config = confirmationRef.current;
    if (!config || confirmingRef.current || operationRef.current) return;
    if (!isCurrentSelection(config.questionnaireId, config.version)) {
      closeConfirmation();
      return toast.error("Questionnaire selection has changed.");
    }
    const operation = Symbol("confirmation");
    confirmingRef.current = operation;
    setConfirmationLoading(true);
    try {
      await config.action();
    } catch (error) {
      if (isCurrentSelection(config.questionnaireId, config.version)) toast.error(error.message || "Unable to complete the requested action.");
    } finally {
      if (confirmingRef.current === operation) {
        confirmingRef.current = null;
        confirmationRef.current = null;
        if (mountedRef.current) {
          setConfirmationLoading(false);
          setConfirmation(null);
        }
      }
    }
  }

  function confirmPreferenceChange(type, enabled, dependencies) {
    const title = type === "performance" ? "Performance" : "Potential";
    const affected = Object.entries(dependencies || {}).filter(([, exists]) => exists).map(([key]) => formatDependencyName(key));
    const employee = `${selectedQuestionnaire?.employee_name || "Selected employee"} (${selectedQuestionnaire?.employee_number || "—"})`;
    const preserved = type === "performance" ? "The Potential Score will remain unaffected." : "Performance Score, PPI and Performance-specific release will remain unaffected.";
    openConfirmation({
      questionnaireId: selectedId,
      version: selectionVersion.current,
      title: `${enabled ? "Enable" : "Disable"} ${title} Descriptive Scoring?`,
      description: `${employee}\n\n${enabled ? "Descriptive marks will contribute to score calculation." : "Only objective scores will contribute to score calculation. Existing descriptive answers and marks will be preserved."}\n\n${affected.length ? `Existing affected results:\n${affected.map(label => `• ${label}`).join("\n")}` : "Existing dependent results may require recalculation."}\n\n${preserved}`,
      confirmText: enabled ? "Enable & Continue" : "Disable & Continue",
      cancelText: "Cancel",
      variant: "warning",
      action: () => updateDescriptivePreference(type, enabled, true)
    });
  }

  async function requestDescriptivePreferenceChange(type, enabled) {
    const state = type === "performance" ? performance : potential;
    const ready = type === "performance" ? performanceReady : potentialReady;
    if (!selectedQuestionnaire || !ready || workflowBusy || operationRef.current || enabled === state.data.enabled) return;
    if (enabled && !state.data.hasDescriptiveQuestions) return toast.error("This questionnaire does not contain descriptive questions.");
    if (state.data.hasDependentResults) return confirmPreferenceChange(type, enabled, state.data.dependentResults);
    await updateDescriptivePreference(type, enabled, false);
  }

  async function updateDescriptivePreference(type, enabled, confirmed) {
    const requestedId = selectedId;
    const requestedVersion = selectionVersion.current;
    try {
      await runOperation(`preference-${type}`, async (id, version, assessmentId) => {
        const affectedKeys = getAffectedResultKeys(type);
        const result = await executeMutation(id, version, assessmentId, async () => {
          const response = await savePreference(type, enabled, confirmed);
          if (response?.invalidation?.invalidated === true && isCurrentSelection(id, version)) {
            setInvalidationNotice({ type, keys: affectedKeys, affected: response.invalidation.affected_results || [] });
          }
          return response;
        }, {
          affectedKeys,
          successMessage: `${type === "performance" ? "Performance" : "Potential"} descriptive scoring ${enabled ? "enabled" : "disabled"} successfully.`
        });
        return result;
      }, { fromConfirmation: confirmed, rethrow: true });
    } catch (error) {
      if (!isCurrentSelection(requestedId, requestedVersion)) return;
      if (!confirmed && requiresInvalidationConfirmation(error)) {
        confirmPreferenceChange(type, enabled, error.data?.dependent_results);
        return;
      }
      if (confirmed) throw error;
      toast.error(error.message || "Unable to update descriptive scoring preference.");
    }
  }

  async function fetchResult(key) {
    const engine = RESULT_ENGINE_MAP[key];
    if (!scoring.isCurrent(engine)) return toast.error("This result is not current. Complete the required calculations first.");
    await runOperation(`view-${key}`, async (id, version, assessmentId) => {
      const data = await fetchResultData(key, id, version, assessmentId, true, true);
      if (!data && isCurrentSelection(id, version)) {
        await reconcileBackend(id, version, assessmentId, { refreshPreferences: false });
        toast.error("Unable to retrieve a current result.");
      }
    }, { requireVerification: true });
  }

  async function calculateResult(key) {
    const engine = RESULT_ENGINE_MAP[key];
    if (!scoring.canCalculate(engine)) {
      return toast.error("Complete the required prerequisites before calculating this result.");
    }
  
    await runOperation(`calculate-${key}`, async (id, version, assessmentId) => {
      if (key === "potential" && !assessmentId) {
        throw new Error("Potential assessment is unavailable.");
      }
  
      await executeMutation(
        id, version, assessmentId,
        () => api(calculationPath(key, id, assessmentId), "POST"),
        {
          affectedKeys: downstreamKeys[key],
          showKey: key,
          successMessage: calculationMessages[key],
          refreshList: false
        }
      );
    }, { requireVerification: true });
  }

  async function applyOverride() {
    if (!scoring.isCurrent("performance") || !scoreData) {
      return toast.error("A current Performance Score is required.");
    }
    if (overrideScore === "" || !overrideReason.trim()) {
      return toast.error("Please provide both override score and reason.");
    }
  
    const value = Number(overrideScore);
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      return toast.error("Enter a valid override score between 0 and 10.");
    }
  
    await runOperation("override-score", async (id, version, assessmentId) => {
      await executeMutation(
        id, version, assessmentId,
        () => api(`/api/scoring/override/${id}`, "PUT", {
          hr_override_score: value,
          override_reason: overrideReason.trim()
        }),
        {
          affectedKeys: downstreamKeys.score,
          showKey: "score",
          successMessage: "Override applied successfully.",
          refreshList: false
        }
      );
    }, { requireVerification: true });
  }

  async function applyAppraisalOverride() {
    if (!scoring.isCurrent("appraisal") || !appraisalData) return toast.error("A current appraisal recommendation is required.");
    if (appraisalOverridePercent === "" || !appraisalOverrideReason.trim()) return toast.error("Please provide both appraisal override percent and reason.");
    const value = Number(appraisalOverridePercent);
    if (!Number.isFinite(value) || value < 0) return toast.error("Enter a valid non-negative appraisal percentage.");
    await runOperation("override-appraisal", async (id, version, assessmentId) => {
      await executeMutation(id, version, assessmentId, () => api(`/api/scoring/appraisal/override/${id}`, "PUT", { hr_override_percent: value, override_reason: appraisalOverrideReason.trim() }), {
        affectedKeys: ["appraisal"],
        showKey: "appraisal",
        successMessage: "Appraisal override applied successfully."
      });
    }, { requireVerification: true });
  }

  async function updateReleaseStatus(isReleased) {
    if (isReleased && !scoring.isCurrent("performance")) return toast.error("A current Performance Score is required.");
    await runOperation("release-score", async (id, version, assessmentId) => {
      await executeMutation(id, version, assessmentId, () => api(`/api/scoring/release/${id}`, "PUT", { is_released_to_employee: isReleased }), {
        affectedKeys: ["score"],
        showKey: "score",
        successMessage: isReleased ? "Score released to employee successfully." : "Score unreleased successfully.",
        refreshList: true
      });
    }, { requireVerification: isReleased });
  }

  async function updateAnalyticsRelease(isReleased) {
    if (isReleased && !analyticsRelease.canRelease) return toast.error("Complete all required analytics calculations before release.");
    if (!isReleased && !analyticsRelease.canUnrelease && !analyticsReleaseData?.is_released_to_employee) return toast.error("Analytics is not currently released.");
    const affectedEmployee = String(selectedQuestionnaire?.employee_number || "");
    await runOperation("release-analytics", async (id, version, assessmentId) => {
      await executeMutation(id, version, assessmentId, async () => {
        const response = await api(`/api/scoring/analytics-release/toggle/${id}`, "PUT", { is_released_to_employee: isReleased });
        if (!response?.stale && isCurrentSelection(id, version)) {
          window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, {
            detail: { employeeNumber: affectedEmployee, questionnaireId: id, isReleased }
          }));
        }
        return response;
      }, {
        successMessage: isReleased ? "Analytics released to employee successfully." : "Analytics unreleased successfully.",
        refreshList: true
      });
    }, { requireVerification: isReleased });
  }

  async function refreshConsole() {
    await runOperation("refresh-console", async (id, version, assessmentId) => {
      const visibleKeys = RESULT_KEYS.filter(key => visibility[key]);
      const fresh = await reconcileBackend(id, version, assessmentId, { affectedKeys: visibleKeys, refreshList: true });
      if (fresh && isCurrentSelection(id, version)) toast.success("Scoring status refreshed.");
    });
  }

  async function retryPreference(type) {
    await runOperation(`refresh-${type}-preference`, async (id, version) => {
      await refreshPreference(type);
      if (!isCurrentSelection(id, version)) return;
      try {
        await refreshReadiness();
      } catch {
        if (isCurrentSelection(id, version)) setReconciliationError("Unable to refresh scoring readiness.");
      }
    });
  }

  if (loading) return <div className={cardClass}><p className="text-sm text-gray-600">Loading scoring console...</p></div>;

  const workflowDefinitions = [
    { key: "score", title: "Score Engine", description: "Calculate and inspect the weighted performance score using self, RM, skip, and peer review inputs.", primary: "Calculate Score", secondary: "View Score" },
    { key: "ppi", title: "PPI Engine", description: "Compute the Past Performance Index using current and previous review cycle score history.", primary: "Calculate PPI", secondary: "View PPI" },
    { key: "potential", title: "Potential Engine", description: "Generate the future-readiness score using required manager evaluations and optional descriptive marks.", primary: "Calculate Potential", secondary: "View Potential" },
    { key: "ninebox", title: "9-Box Matrix", description: "Map the employee onto the 9-box talent grid using PPI on X-axis and Potential Score on Y-axis.", primary: "Generate 9-Box", secondary: "View 9-Box" },
    { key: "appraisal", title: "Appraisal Engine", description: "Generate the recommended appraisal percentage using the employee's 9-box placement and configured range rules.", primary: "Generate Appraisal", secondary: "View Appraisal" }
  ];
  const workflows = workflowDefinitions.map(workflow => {
    const engine = engines[RESULT_ENGINE_MAP[workflow.key]];
    return {
      ...workflow,
      status: engine?.status || "unavailable",
      label: engine?.label || "Readiness Unavailable",
      available: canOperate && engine?.canCalculate === true && (workflow.key !== "potential" || Boolean(selectedAssessmentId)),
      viewable: canOperate && engine?.isCurrent === true,
      blockers: verified ? getEngineBlockers(engine) : [],
      error: resultErrors[workflow.key]
    };
  });
  const releaseKnown = verified || Boolean(analyticsReleaseData);
  const isReleased = verified ? analyticsRelease.isReleased : analyticsReleaseData?.is_released_to_employee === true;
  const canRelease = canOperate && analyticsRelease.canRelease && !isReleased;
  const canUnrelease = !workflowBusy && (verified ? analyticsRelease.canUnrelease : analyticsReleaseData?.is_released_to_employee === true);
  const releaseRequirements = verified ? analyticsRelease.missingRequirements : [];
  const readinessError = scoring.error || reconciliationError;

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <AdminConfirmDialog open={Boolean(confirmation)} title={confirmation?.title} description={confirmation?.description} confirmText={confirmation?.confirmText} cancelText={confirmation?.cancelText} variant={confirmation?.variant} loading={confirmationLoading} onConfirm={handleConfirmation} onCancel={closeConfirmation} />
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">Scoring Console</h1>
            <p className="mt-2 text-sm text-gray-600">Admin scoring view for score, PPI, potential, 9-box placement, and appraisal recommendation.</p>
          </div>
          {selectedId && <button type="button" disabled={workflowBusy} onClick={refreshConsole} className={darkClass}>{busy === "refresh-console" ? "Refreshing..." : "Refresh Status"}</button>}
        </div>
      </div>
      <div className={cardClass}>
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-[#111827]">Questionnaire Selection</h2>
        {listError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{listError}</p>
            <button type="button" disabled={workflowBusy} onClick={() => loadQuestionnaires().catch(() => {})} className="mt-2 text-xs font-semibold underline disabled:opacity-50">Retry loading questionnaires</button>
          </div>
        )}
        <div className="space-y-4">
          <div className="relative" data-questionnaire-search>
            <input type="text" value={questionnaireQuery} disabled={workflowBusy} onChange={event => {
              const value = event.target.value;
              setQuestionnaireQuery(value);
              setShowQuestionnaireResults(true);
              if (!value.trim()) {
                handleSelectQuestionnaire(null);
                setShowQuestionnaireResults(true);
              }
            }} onFocus={() => setShowQuestionnaireResults(true)} placeholder="Search by employee name, employee number, department, or cycle" className={inputClass} />
            {showQuestionnaireResults && !workflowBusy && (
              <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {filteredQuestionnaires.length ? filteredQuestionnaires.map(q => (
                  <button key={q.questionnaire_id} type="button" onClick={() => handleSelectQuestionnaire(q)} className="flex w-full items-start justify-between gap-4 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 last:border-b-0">
                    <div><p className="text-sm font-medium text-[#111827]">{q.employee_name} ({q.employee_number})</p><p className="text-xs text-gray-500">{q.department || "—"} • {q.review_cycle || q.cycle || "—"}</p></div>
                    <span className="mt-0.5 rounded-full bg-[#FFF1EC] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#F6490D]">{String(q.status || "—").replaceAll("_", " ")}</span>
                  </button>
                )) : <div className="px-4 py-3 text-sm text-gray-500">No matching questionnaires found.</div>}
              </div>
            )}
          </div>
          {selectedQuestionnaire && (
            <div className={panelClass}>
              <p className="text-sm font-medium text-[#111827]">{selectedQuestionnaire.employee_name} ({selectedQuestionnaire.employee_number})</p>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>Questionnaire ID: {selectedId}</p>
                <p>Department: {selectedQuestionnaire.department || "—"}</p>
                <p>Cycle: {selectedQuestionnaire.review_cycle || selectedQuestionnaire.cycle || "—"}</p>
                <p>Status: {selectedQuestionnaire.status || "—"}</p>
                <p>Score Exists: {verified ? engines.performance.exists ? "Yes" : "No" : "Verifying..."}</p>
                <p>Performance Score Current: {verified ? engines.performance.isCurrent ? "Yes" : "No" : "Verifying..."}</p>
                <p>Potential Assessment ID: {selectedAssessmentId || "Not available yet"}</p>
              </div>
              <DescriptiveScoringConfiguration questionnaireId={selectedId} assessmentId={selectedAssessmentId} performance={performance} potential={potential} readiness={readiness} engines={engines} readinessLoading={scoring.loading} disabled={workflowBusy} onChange={requestDescriptivePreferenceChange} onRetry={retryPreference} />
              <ScoringProgressCard progress={progress} verified={verified} loading={scoring.loading} updatedAt={scoring.updatedAt} />
              {invalidationNotice && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  <p className="font-semibold">Scoring Recalculation Required</p>
                  <p className="mt-1">{invalidationNotice.type === "performance" ? "Performance-dependent results were invalidated. Recalculate the affected Performance Score, PPI, 9-box placement and appraisal recommendation. Potential Score remains unaffected." : "Potential-dependent results were invalidated. Recalculate the affected Potential Score, 9-box placement and appraisal recommendation. Performance Score and PPI remain unaffected."}</p>
                  {invalidationNotice.affected.length > 0 && <p className="mt-2 text-xs">Affected results: {invalidationNotice.affected.map(formatDependencyName).join(", ")}</p>}
                </div>
              )}
              {readinessError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold">Unable to verify scoring readiness.</p>
                  <p className="mt-1 text-xs">{readinessError}</p>
                  <button type="button" disabled={workflowBusy} onClick={refreshConsole} className="mt-3 text-xs font-semibold underline disabled:opacity-50">Refresh scoring status</button>
                </div>
              )}
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {workflows.map(workflow => <WorkflowActionCard key={workflow.key} workflow={workflow} busy={busy} onCalculate={calculateResult} onView={fetchResult} />)}
              </div>
              {!selectedAssessmentId && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">No Potential assessment is available for this employee and review cycle.</div>}
            </div>
          )}
        </div>
      </div>
      {selectedQuestionnaire && (
        <div className={cardClass}>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-[#111827]">Analytics Release Controls</h2>
          {verified && isReleased && analyticsRelease.isCurrent && !workflowBusy && (
            <AnalyticsReleaseSuccess employee={selectedQuestionnaire} employeeNumber={employeeNumber} />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className={panelClass}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Current Status</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{!releaseKnown ? "Status Unavailable" : isReleased ? "Released" : "Not Released"}</p>
              {verified && isReleased && !analyticsRelease.isCurrent && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-700">Released analytics is no longer current. Review the missing requirements.</p>}
              <div className="mt-4 space-y-2">
                <DetailRow label="Ready For Release" value={verified ? readiness?.analytics_release?.can_release || analyticsRelease.isCurrent ? "Yes" : "No" : "Not verified"} />
                <DetailRow label="Released At" value={analyticsReleaseData?.released_at ? new Date(analyticsReleaseData.released_at).toLocaleString() : null} />
                <DetailRow label="Released By" value={analyticsReleaseData?.released_by} />
              </div>
              {releaseError && <p className="mt-3 text-xs text-red-600">{releaseError}</p>}
            </div>
            <div className={panelClass}>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Missing Requirements</p>
              {releaseRequirements.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-[#111827]">{releaseRequirements.map((item, index) => <li key={index}>• {formatMissingRequirement(item)}</li>)}</ul>
              ) : <p className="mt-3 text-sm text-[#111827]">{!verified ? "Analytics readiness has not been verified." : analyticsRelease.canRelease || analyticsRelease.isCurrent ? "All required analytics components are available." : "Analytics release requirements have not been satisfied."}</p>}
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => updateAnalyticsRelease(true)} disabled={!canRelease} className={darkClass}>{busy === "release-analytics" ? "Updating..." : "Release Analytics Data to Employee"}</button>
                <button type="button" onClick={() => updateAnalyticsRelease(false)} disabled={!canUnrelease} className={secondaryClass}>Unrelease Analytics Data</button>
                <button type="button" disabled={workflowBusy} onClick={refreshConsole} className="text-xs font-semibold text-[#F6490D] disabled:opacity-50">Refresh Status</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {visibility.score && scoreData && (
        <>
          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-[#111827]">HR Controls</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className={panelClass}>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Override Score</label>
                <input type="number" min="0" max="10" step="0.01" value={overrideScore} disabled={workflowBusy} onChange={event => setOverrideScore(event.target.value)} placeholder="Enter override score" className={`mb-3 ${inputClass}`} />
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Override Reason</label>
                <textarea value={overrideReason} disabled={workflowBusy} onChange={event => setOverrideReason(event.target.value)} placeholder="Enter override reason" className={inputClass} />
                <button type="button" onClick={applyOverride} disabled={!canOperate || !scoring.isCurrent("performance")} className={`mt-4 ${primaryClass}`}>{busy === "override-score" ? "Applying..." : "Apply Override"}</button>
              </div>
              <div className={panelClass} hidden>
                <p className="text-sm font-semibold text-[#111827]">Release Controls</p>
                <DetailRow label="Current Release Status" value={scoreData.is_released_to_employee ? "Released" : "Not Released"} />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={() => updateReleaseStatus(true)} disabled={!canOperate || !scoring.isCurrent("performance")} className={darkClass}>Release To Employee</button>
                  <button type="button" onClick={() => updateReleaseStatus(false)} disabled={workflowBusy} className={secondaryClass}>Unrelease Score</button>
                </div>
              </div>
            </div>
          </div>
          <ScoreBreakdownCard scoreData={scoreData} />
        </>
      )}
      {visibility.ppi && ppiData && (
        <div className={cardClass}>
          <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[#111827]">Past Performance Index (PPI)</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[["Current Cycle Score", "current_cycle_score"], ["Previous Cycle Score", "previous_cycle_score_1"], ["Older Cycle Score", "previous_cycle_score_2"], ["Final PPI Score", "ppi_score"]].map(([label, key]) => <ValuePanel key={key} label={label} value={ppiData[key]} highlight={key === "ppi_score"} />)}
          </div>
        </div>
      )}
      {visibility.potential && potentialData && <PotentialScoreCard data={potentialData} />}
      {visibility.ninebox && nineBoxData && <NineBoxMatrixCard data={nineBoxData} />}
      {visibility.appraisal && appraisalData && (
        <>
          <div className={cardClass}>
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-[#111827]">Appraisal Override Controls</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className={panelClass}>
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Appraisal Override Percent</label>
                <input type="number" min="0" step="0.01" value={appraisalOverridePercent} disabled={workflowBusy} onChange={event => setAppraisalOverridePercent(event.target.value)} placeholder="Enter override appraisal percent" className={`mb-3 ${inputClass}`} />
                <label className="mb-2 block text-sm font-semibold text-[#111827]">Appraisal Override Reason</label>
                <textarea value={appraisalOverrideReason} disabled={workflowBusy} onChange={event => setAppraisalOverrideReason(event.target.value)} placeholder="Enter override appraisal reason" className={inputClass} />
                <button type="button" onClick={applyAppraisalOverride} disabled={!canOperate || !scoring.isCurrent("appraisal")} className={`mt-4 ${primaryClass}`}>{busy === "override-appraisal" ? "Applying..." : "Apply Appraisal Override"}</button>
              </div>
              <div className={highlightClass}>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Recommendation Summary</p>
                <DetailRow label="Box Label" value={appraisalData.box_label} />
                <DetailRow label="Suggested Appraisal" value={appraisalData.suggested_appraisal_percent != null ? `${appraisalData.suggested_appraisal_percent}%` : null} />
                <DetailRow label="Final Effective Appraisal" value={appraisalData.final_effective_appraisal_percent != null ? `${appraisalData.final_effective_appraisal_percent}%` : null} />
              </div>
            </div>
          </div>
          <AppraisalRecommendationCard appraisalData={appraisalData} />
        </>
      )}
    </section>
  );
}