"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { toast } from "sonner";
import { Search, RefreshCw, Save, CheckCircle2, FileText, AlertCircle, ChevronDown, ChevronUp, Users } from "lucide-react";

const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-[#111827] outline-none focus:border-[#F6490D]";
const primaryClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#F6490D] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#DC3F0A] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-[#111827] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

function getError(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (data && typeof data === "object") {
    const entry = Object.entries(data).find(([key, value]) => value && !["results", "responses"].includes(key));
    if (entry) return `${entry[0]}: ${Array.isArray(entry[1]) ? entry[1].join(", ") : JSON.stringify(entry[1])}`;
  }
  return fallback;
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
function formatText(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());
}
function evaluatorLabel(type) {
  return { self: "Self Evaluation", rm: "Reporting Manager", skip: "Skip-Level Manager", peer: "Peer Reviewer" }[type] || formatText(type);
}
function getScoreState(response) {
  return { score: response.admin_score == null ? "" : String(response.admin_score), remarks: response.admin_remarks || "" };
}
function questionKey(response) {
  const id = response.question_id ?? response.questionnaire_item_id ?? response.item_id;
  return id != null ? `id:${id}` : `text:${String(response.question || "").trim()}:${response.category || ""}:${response.category_type || ""}`;
}
function validateScore(value, responses) {
  if (value === "" || value == null) return "Consolidated score is required.";
  const score = Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 10) return "Score must be a whole number between 1 and 10.";
  const invalid = responses.find(response => !Number.isInteger(Number(response.max_marks)) || Number(response.max_marks) < score);
  if (invalid) return `The backend allows a maximum of ${invalid.max_marks} for one or more responses in this question.`;
  return null;
}
function StatCard({ label, value, color = "text-[#111827]" }) {
  return <div className="rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className={`mt-2 text-3xl font-semibold ${color}`}>{value}</p></div>;
}

export default function AdminDescriptiveScoringPage() {
  const { accessToken } = useAuth();
  const [questionnaires, setQuestionnaires] = useState([]);
  const [details, setDetails] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [evaluatorFilter, setEvaluatorFilter] = useState("");
  const [scoringFilter, setScoringFilter] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [draftScores, setDraftScores] = useState({});
  const [originalScores, setOriginalScores] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  const api = useCallback(async (path, method = "GET", payload) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const options = { method, headers, cache: "no-store" };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(path, options);
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error("Invalid response received from server."); }
    if (!response.ok) throw new Error(getError(data, `Request failed (${response.status}).`));
    return data;
  }, [accessToken]);

  const loadQuestionnaires = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoadingList(true);
      const params = new URLSearchParams();
      if (cycleFilter) params.set("cycle_id", cycleFilter);
      if (employeeFilter.trim()) params.set("employee_id", employeeFilter.trim());
      if (statusFilter) params.set("status", statusFilter);
      const data = await api(`/api/admin/questionnaires${params.size ? `?${params}` : ""}`);
      setQuestionnaires(Array.isArray(data.results) ? data.results : []);
    } catch (error) { toast.error(error.message); }
    finally { setLoadingList(false); }
  }, [accessToken, api, cycleFilter, employeeFilter, statusFilter]);

  const loadDetails = useCallback(async id => {
    if (!id || !accessToken) return;
    try {
      setLoadingDetails(true);
      const data = await api(`/api/evaluations/admin/descriptive-responses/${id}`);
      const responses = Array.isArray(data.responses) ? data.responses : [];
      const values = Object.fromEntries(responses.map(response => [response.response_id, getScoreState(response)]));
      setDetails(data);
      setDraftScores(values);
      setOriginalScores(values);
    } catch (error) {
      toast.error(error.message);
      setDetails(null);
      setDraftScores({});
      setOriginalScores({});
    } finally { setLoadingDetails(false); }
  }, [accessToken, api]);

  useEffect(() => { if (accessToken) loadQuestionnaires(); }, [accessToken, loadQuestionnaires]);
  useEffect(() => {
    if (selectedId && accessToken) loadDetails(selectedId);
    else { setDetails(null); setDraftScores({}); setOriginalScores({}); }
  }, [selectedId, accessToken, loadDetails]);

  const selectedQuestionnaire = useMemo(() => questionnaires.find(item => String(item.questionnaire_id) === String(selectedId)), [questionnaires, selectedId]);
  const responses = useMemo(() => details?.responses || [], [details]);

  const groups = useMemo(() => {
    const map = new Map();
    responses.forEach(response => {
      const key = questionKey(response);
      if (!map.has(key)) map.set(key, { key, question: response.question, category: response.category, category_type: response.category_type, responses: [] });
      map.get(key).responses.push(response);
    });
    return [...map.values()];
  }, [responses]);

  const groupDrafts = useMemo(() => {
    const result = {};
    groups.forEach(group => {
      const values = group.responses.map(response => draftScores[response.response_id] || getScoreState(response));
      const first = values[0] || { score: "", remarks: "" };
      const uniform = values.every(value => value.score === first.score && value.remarks === first.remarks);
      result[group.key] = { score: uniform ? first.score : "", remarks: uniform ? first.remarks : "", mixed: !uniform };
    });
    return result;
  }, [groups, draftScores]);

  const changedResponses = useMemo(() => responses.filter(response => {
    const id = response.response_id, current = draftScores[id], original = originalScores[id];
    return current && original && (current.score !== original.score || current.remarks !== original.remarks);
  }), [responses, draftScores, originalScores]);

  const groupScored = group => group.responses.every(response => response.admin_score != null && group.responses.every(other => String(other.admin_score) === String(response.admin_score)));
  const scoredCount = groups.filter(groupScored).length;
  const pendingCount = groups.length - scoredCount;
  const progress = groups.length ? Math.round(scoredCount / groups.length * 100) : 0;

  const filteredGroups = useMemo(() => {
    const search = questionSearch.trim().toLowerCase();
    return groups.filter(group => {
      if (evaluatorFilter && !group.responses.some(response => response.evaluator_type === evaluatorFilter)) return false;
      const scored = groupScored(group);
      if (scoringFilter === "scored" && !scored) return false;
      if (scoringFilter === "pending" && scored) return false;
      if (search && ![group.question, group.category, group.category_type, ...group.responses.flatMap(response => [response.descriptive_answer, response.submitted_by])].join(" ").toLowerCase().includes(search)) return false;
      return true;
    });
  }, [groups, evaluatorFilter, scoringFilter, questionSearch]);

  function updateGroup(group, field, value) {
    setDraftScores(previous => {
      const next = { ...previous };
      group.responses.forEach(response => {
        next[response.response_id] = { ...next[response.response_id], [field]: value };
      });
      return next;
    });
  }

  function getPayload(response) {
    const draft = draftScores[response.response_id];
    if (!draft) return null;
    const error = validateScore(draft.score, [response]);
    if (error) throw new Error(`Response #${response.response_id}: ${error}`);
    return { response_id: response.response_id, score: Number(draft.score), remarks: draft.remarks.trim() };
  }

  async function saveGroup(group) {
    if (busy) return;
    try {
      const draft = groupDrafts[group.key];
      if (!draft || draft.mixed) return toast.error("Enter one consolidated score for this question.");
      const error = validateScore(draft.score, group.responses);
      if (error) return toast.error(error);
      const changed = group.responses.filter(response => {
        const id = response.response_id, current = draftScores[id], original = originalScores[id];
        return current && original && (current.score !== original.score || current.remarks !== original.remarks);
      });
      if (!changed.length) return toast.info("No changes to save.");
      setBusy(true);
      const scores = changed.map(getPayload);
      const data = await api("/api/evaluations/admin/descriptive-score/bulk-save", "POST", { scores });
      toast.success(data.message || "Consolidated score saved successfully.");
      await loadDetails(selectedId);
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }

  async function saveBulk() {
    if (busy || !changedResponses.length) return;
    try {
      const changedGroups = groups.filter(group => group.responses.some(response => changedResponses.some(changed => changed.response_id === response.response_id)));
      for (const group of changedGroups) {
        const draft = groupDrafts[group.key];
        if (!draft || draft.mixed) throw new Error(`Question "${group.question}": A consolidated score is required.`);
        const error = validateScore(draft.score, group.responses);
        if (error) throw new Error(`Question "${group.question}": ${error}`);
      }
      const scores = changedResponses.map(getPayload);
      if (!window.confirm(`Save consolidated scores for ${changedGroups.length} descriptive question${changedGroups.length === 1 ? "" : "s"}?`)) return;
      setBusy(true);
      const data = await api("/api/evaluations/admin/descriptive-score/bulk-save", "POST", { scores });
      toast.success(data.message || `${changedGroups.length} consolidated question scores saved successfully.`);
      await loadDetails(selectedId);
    } catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }

  function selectQuestionnaire(id) {
    if (busy || loadingDetails) return;
    if (changedResponses.length && !window.confirm("You have unsaved score changes. Discard them?")) return;
    setSelectedId(String(id));
    setEvaluatorFilter("");
    setScoringFilter("");
    setQuestionSearch("");
    setExpanded({});
  }

  function refreshDetails() {
    if (!selectedId || busy) return;
    if (changedResponses.length && !window.confirm("Discard unsaved changes and reload scores?")) return;
    loadDetails(selectedId);
  }

  return (
    <div className="space-y-8">
      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">Descriptive Response Scoring</h1>
            <p className="mt-2 text-sm text-gray-600">Read all evaluator responses for each descriptive question and assign one consolidated score from 1–10.</p>
          </div>
          <button type="button" onClick={loadQuestionnaires} disabled={loadingList || busy} className={secondaryClass}><RefreshCw size={16} /> Refresh Questionnaires</button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-[#111827]">Select Employee Questionnaire</h2>
          <p className="mt-1 text-sm text-gray-500">Select an employee questionnaire to view its submitted descriptive responses.</p>
        </div>
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <input type="number" min="1" value={cycleFilter} onChange={event => setCycleFilter(event.target.value)} placeholder="Review Cycle ID" className={inputClass} />
          <input type="number" min="1" value={employeeFilter} onChange={event => setEmployeeFilter(event.target.value)} placeholder="Employee Database ID" className={inputClass} />
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className={inputClass}>
            <option value="">All Review Statuses</option>
            {["draft", "self_submitted", "under_rm_review", "rm_reviewed", "under_skip_review", "skip_reviewed", "under_peer_review", "completed"].map(status => <option key={status} value={status}>{formatText(status)}</option>)}
          </select>
          <button type="button" onClick={loadQuestionnaires} disabled={loadingList} className={secondaryClass}><Search size={16} /> Apply Filters</button>
        </div>
        {loadingList ? <p className="py-8 text-center text-sm text-gray-500">Loading questionnaires...</p> : questionnaires.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No questionnaires found for the selected filters.</div>
        ) : (
          <div className="max-h-[450px] space-y-3 overflow-y-auto">
            {questionnaires.map(item => {
              const selected = String(item.questionnaire_id) === String(selectedId);
              return (
                <div key={item.questionnaire_id} className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${selected ? "border-[#F6490D] bg-orange-50" : "border-gray-200 bg-[#FCFCFD]"}`}>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{item.employee_name} ({item.employee_number})</p>
                    <p className="mt-1 text-xs text-gray-500">{item.department || "No Department"} · {item.review_cycle}</p>
                    <p className="mt-1 text-xs text-gray-500">Questionnaire #{item.questionnaire_id} · {item.question_count} Questions</p>
                    <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs text-gray-600">{formatText(item.status)}</span>
                  </div>
                  <button type="button" onClick={() => selectQuestionnaire(item.questionnaire_id)} disabled={busy || loadingDetails} className={selected ? primaryClass : secondaryClass}>
                    <FileText size={16} /> {selected ? "Selected" : "Review Responses"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedId && <>
        <section className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#111827]">Descriptive Evaluation Overview</h2>
              <p className="mt-1 text-sm text-gray-500">{selectedQuestionnaire?.employee_name || details?.employee_name || "Employee"} · {selectedQuestionnaire?.review_cycle || details?.review_cycle || "Review Cycle"}</p>
              <p className="mt-1 text-xs text-gray-500">Questionnaire #{selectedId}</p>
            </div>
            <button type="button" onClick={refreshDetails} disabled={busy || loadingDetails} className={secondaryClass}><RefreshCw size={16} /> Refresh Responses</button>
          </div>
          {loadingDetails ? <p className="mt-6 text-sm text-gray-500">Loading descriptive responses...</p> : !details ? (
            <p className="mt-6 text-sm text-red-600">Unable to load descriptive responses.</p>
          ) : <>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <StatCard label="Total Questions" value={groups.length} />
              <StatCard label="Scored Questions" value={scoredCount} color="text-emerald-600" />
              <StatCard label="Pending Questions" value={pendingCount} color="text-amber-600" />
              <StatCard label="Completion" value={`${progress}%`} color="text-[#F6490D]" />
            </div>
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs font-medium text-gray-600"><span>Consolidated Scoring Progress</span><span>{scoredCount} / {groups.length}</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-[#F6490D] transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
            {groups.length > 0 && pendingCount === 0 && <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 size={18} /> All descriptive questions have received consolidated scores.</div>}
            {responses.length === 0 && <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertCircle size={18} /> No submitted descriptive responses are available for this questionnaire.</div>}
          </>}
        </section>

        {details && responses.length > 0 && <section className={cardClass}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#111827]">Evaluate Descriptive Questions</h2>
              <p className="mt-1 text-sm text-gray-500">Read responses from all evaluators and assign one consolidated score per question.</p>
            </div>
            <button type="button" onClick={saveBulk} disabled={busy || loadingDetails || !changedResponses.length} className={primaryClass}><Save size={16} /> {busy ? "Saving..." : `Save All Changes (${groups.filter(group => group.responses.some(response => changedResponses.some(changed => changed.response_id === response.response_id))).length})`}</button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <select value={evaluatorFilter} onChange={event => setEvaluatorFilter(event.target.value)} className={inputClass}>
              <option value="">All Evaluators</option>
              <option value="self">Self Evaluation</option>
              <option value="rm">Reporting Manager</option>
              <option value="skip">Skip-Level Manager</option>
              <option value="peer">Peer Reviewers</option>
            </select>
            <select value={scoringFilter} onChange={event => setScoringFilter(event.target.value)} className={inputClass}>
              <option value="">All Scoring Statuses</option>
              <option value="pending">Pending Scoring</option>
              <option value="scored">Already Scored</option>
            </select>
            <input type="text" value={questionSearch} onChange={event => setQuestionSearch(event.target.value)} placeholder="Search questions or responses" className={inputClass} />
          </div>
          <p className="mt-4 text-xs text-gray-500">Showing {filteredGroups.length} of {groups.length} descriptive questions · {responses.length} submitted responses.</p>

          <div className="mt-6 space-y-5">
            {filteredGroups.length === 0 ? <p className="rounded-xl bg-gray-50 p-5 text-sm text-gray-500">No descriptive questions match the selected filters.</p> : filteredGroups.map((group, index) => {
              const draft = groupDrafts[group.key] || { score: "", remarks: "", mixed: false };
              const scored = groupScored(group);
              const changed = group.responses.some(response => {
                const id = response.response_id, current = draftScores[id], original = originalScores[id];
                return current && original && (current.score !== original.score || current.remarks !== original.remarks);
              });
              const validationError = draft.score !== "" ? validateScore(draft.score, group.responses) : null;
              const isOpen = Boolean(expanded[group.key]);
              return (
                <div key={group.key} className="rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#FFF1EC] px-3 py-1 text-xs font-semibold text-[#F6490D]">Question {index + 1}</span>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{group.category || "Uncategorized"}</span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{formatText(group.category_type)}</span>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${scored ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{scored ? "Scored" : "Pending"}</span>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Descriptive Question</p>
                  <p className="mt-2 text-sm font-semibold leading-7 text-[#111827]">{group.question}</p>
                  <button type="button" onClick={() => setExpanded(previous => ({ ...previous, [group.key]: !previous[group.key] }))} className={`${secondaryClass} mt-4`}>
                    <Users size={16} /> {isOpen ? "Hide Responses" : `View All Responses (${group.responses.length})`} {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {isOpen && <div className="mt-4 space-y-3">
                    {group.responses.map(response => (
                      <div key={response.response_id} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="rounded-full bg-[#FFF1EC] px-3 py-1 text-xs font-medium text-[#F6490D]">{evaluatorLabel(response.evaluator_type)}</span>
                          <span className="text-xs text-gray-500">Response #{response.response_id}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Submitted By: {response.submitted_by || "—"} · {formatDate(response.submitted_at)}</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#111827]">{response.descriptive_answer}</p>
                      </div>
                    ))}
                  </div>}

                  {draft.mixed && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Existing responses have different scores or remarks. Enter one consolidated score to synchronize them.</p>}
                  <div className="mt-5 grid gap-4 border-t border-gray-200 pt-5 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[#111827]">Consolidated Admin Score (1–10)</label>
                      <input type="number" min="1" max="10" step="1" value={draft.score} disabled={busy} onChange={event => updateGroup(group, "score", event.target.value)} placeholder="Enter score from 1 to 10" className={inputClass} />
                      {validationError && <p className="mt-2 text-xs text-red-600">{validationError}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-[#111827]">Consolidated Admin Remarks (Optional)</label>
                      <textarea rows={3} value={draft.remarks} disabled={busy} onChange={event => updateGroup(group, "remarks", event.target.value)} placeholder="Enter consolidated evaluation remarks..." className={inputClass} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">{changed ? "Unsaved consolidated score changes" : "No unsaved changes"}</p>
                    <button type="button" onClick={() => saveGroup(group)} disabled={busy || !changed || Boolean(validationError) || draft.score === "" || draft.mixed} className={primaryClass}><Save size={15} /> Save Consolidated Score</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-5">
            <p className="text-sm text-gray-600">{changedResponses.length} unsaved response updates across {groups.filter(group => group.responses.some(response => changedResponses.some(changed => changed.response_id === response.response_id))).length} questions</p>
            <button type="button" onClick={saveBulk} disabled={busy || !changedResponses.length} className={primaryClass}><Save size={16} /> {busy ? "Saving..." : "Save All Changed Scores"}</button>
          </div>
        </section>}
      </>}
    </div>
  );
}