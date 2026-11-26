"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/layout/AppHeader";
import { useAuth } from "@/app/context/AuthContext";
import ReviewStatusTracker from "@/components/ReviewStatusTracker";
import PeerAssignmentManager from "@/components/PeerAssignmentManager";

const cardClass = "rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
const primaryClass = "rounded-xl bg-[#F6490D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";
const badgeClass = "rounded-full bg-[#FFF1EC] px-3 py-1 text-xs font-medium text-[#F6490D]";

function formatStatus(status) {
  return String(status || "").replaceAll("_", " ").toUpperCase();
}

function formatDate(date) {
  if (!date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

function getReviewCycle(item) {
  const candidates = [
    item?.review_cycle_name, item?.cycle_name,
    item?.review_cycle, item?.cycle
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() && !/^\d+$/.test(value.trim())) return value.trim();
    if (value && typeof value === "object") {
      const name = value.name || value.cycle_name || value.review_cycle_name || value.title;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return "—";
}

function getSkipReviewRequired(item, role, user) {
  if (role === "skip") return true;
  if (["under_skip_review", "skip_reviewed"].includes(item?.status)) return true;
  if (typeof item?.skip_review_required === "boolean") return item.skip_review_required;
  if (typeof item?.requires_skip_review === "boolean") return item.requires_skip_review;
  const rmBand = String(
    item?.reporting_manager_band || item?.rm_band ||
    item?.reporting_manager?.band || (role === "rm" ? user?.band : "") || ""
  ).trim().toUpperCase();
  return rmBand ? !rmBand.startsWith("SM") : undefined;
}

function QueueHeader({ title, count }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-[#111827]">{title}</h2>
      {count !== undefined && <span className={badgeClass}>{count} Record{count !== 1 ? "s" : ""}</span>}
    </div>
  );
}

function EmployeeCardHeader({ item, status }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-[#111827]">{item.employee_name}</h3>
        <p className="text-sm text-gray-500">Employee No: {item.employee_number}</p>
      </div>
      <span className={badgeClass}>{status || formatStatus(item.status)}</span>
    </div>
  );
}

function EmployeeDetails({ item, potential = false }) {
  return (
    <div className="mb-4 space-y-1 text-sm text-gray-600">
      <p>Department: {item.department || "—"}</p>
      <p>Cycle: {getReviewCycle(item)}</p>
      {potential ? (
        <>
          <p>RM Submitted: {item.rm_submitted ? "Yes" : "No"}</p>
          <p>Skip Submitted: {item.skip_submitted ? "Yes" : "No"}</p>
        </>
      ) : (
        <p>Submitted At: {formatDate(item.submitted_at)}</p>
      )}
    </div>
  );
}

function ReviewQueue({ title, items, role, user, canReview, reviewPath, buttonLabel = "Review Questionnaire" }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <QueueHeader title={title} count={items.length} />
      <div className="grid gap-5 md:grid-cols-2">
        {items.map(item => (
          <div key={item.questionnaire_id} className={cardClass}>
            <EmployeeCardHeader item={item} status={item.status === "draft" ? "NOT SUBMITTED YET" : formatStatus(item.status)} />
            <EmployeeDetails item={item} />
            <div className="mb-4">
              <ReviewStatusTracker status={item.status} role={role} skipReviewRequired={getSkipReviewRequired(item, role, user)} compact />
            </div>
            {canReview(item) && (
              <Link href={reviewPath(item)} className={`inline-block ${primaryClass}`}>{buttonLabel}</Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PotentialQueue({ title, items, role }) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <QueueHeader title={title} count={items.length} />
      <div className="grid gap-5 md:grid-cols-2">
        {items.map(item => {
          const canReview = role === "rm" ? !item.rm_submitted : !item.skip_submitted && item.rm_submitted;
          return (
            <div key={item.assessment_id} className={cardClass}>
              <EmployeeCardHeader item={item} />
              <EmployeeDetails item={item} potential />
              {canReview && (
                <Link href={`/potential/${role}/${item.assessment_id}`} className={`inline-block ${primaryClass}`}>Fill Potential Questionnaire</Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PeerReviewQueue({ items, peerTab, setPeerTab }) {
  if (!items.length) return null;
  const pending = items.filter(item => !["completed", "submitted"].includes(item.peer_status));
  const completed = items.filter(item => ["completed", "submitted"].includes(item.peer_status));
  const visible = peerTab === "pending" ? pending : completed;
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Peer Review Requests</h2>
        <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <button type="button" onClick={() => setPeerTab("pending")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${peerTab === "pending" ? "bg-[#F6490D] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            Pending Reviews ({pending.length})
          </button>
          <button type="button" onClick={() => setPeerTab("completed")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${peerTab === "completed" ? "bg-[#F6490D] text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            Completed Reviews ({completed.length})
          </button>
        </div>
      </div>
      {visible.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {visible.map(item => {
            const isCompleted = ["completed", "submitted"].includes(item.peer_status);
            return (
              <div key={item.questionnaire_id} className={cardClass}>
                <EmployeeCardHeader item={item} status={isCompleted ? "COMPLETED" : "PENDING"} />
                <EmployeeDetails item={item} />
                <p className="mb-4 text-xs text-gray-500">Your Review Status: {formatStatus(item.peer_status || "pending")}</p>
                {!isCompleted && (
                  <Link href={`/peer-review/${item.questionnaire_id}`} className={`inline-block ${primaryClass}`}>Review Peer Questionnaire</Link>
                )}
                {isCompleted && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Your peer evaluation has been submitted successfully.</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">No {peerTab === "pending" ? "pending" : "completed"} peer reviews.</p>
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const [statusData, setStatusData] = useState(null);
  const [rmQueue, setRmQueue] = useState([]);
  const [skipQueue, setSkipQueue] = useState([]);
  const [peerQueue, setPeerQueue] = useState([]);
  const [rmPotentialQueue, setRmPotentialQueue] = useState([]);
  const [skipPotentialQueue, setSkipPotentialQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [peerTab, setPeerTab] = useState("pending");

  const loadDashboardData = useCallback(async (showLoader = true) => {
    if (!accessToken) return;
    try {
      if (showLoader) setLoading(true);
      const backend = process.env.NEXT_PUBLIC_API_BASE_URL;
      const headers = { Authorization: `Bearer ${accessToken}` };
      const requests = [
        `${backend}/api/evaluations/self-review-status/`,
        `${backend}/api/evaluations/rm/pending-reviews/`,
        "/api/evaluations/skip/pending-reviews/",
        "/api/evaluations/peer/pending-reviews/",
        "/api/scoring/potential/rm/pending/",
        "/api/scoring/potential/skip/pending/"
      ];
      const responses = await Promise.all(requests.map(url => fetch(url, { method: "GET", headers, cache: "no-store" })));
      const data = await Promise.all(responses.map(async response => {
        try { return await response.json(); }
        catch { return null; }
      }));
      const asArray = index => {
        if (!responses[index].ok) return [];
        if (Array.isArray(data[index])) return data[index];
        if (Array.isArray(data[index]?.results)) return data[index].results;
        return [];
      };
      setStatusData(responses[0].ok ? data[0] : { exists: false });
      setRmQueue(asArray(1));
      setSkipQueue(asArray(2));
      setPeerQueue(asArray(3));
      setRmPotentialQueue(asArray(4));
      setSkipPotentialQueue(asArray(5));
    } catch (error) {
      console.error("Dashboard load error:", error);
      if (showLoader) {
        setStatusData({ exists: false });
        setRmQueue([]);
        setSkipQueue([]);
        setPeerQueue([]);
        setRmPotentialQueue([]);
        setSkipPotentialQueue([]);
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) loadDashboardData();
  }, [accessToken, loadDashboardData]);

  const showQuestionnaireCard = !statusData?.exists || statusData?.status === "draft";
  const showStatusTracker = Boolean(statusData?.exists && statusData?.status && statusData.status !== "draft");
  const peerProgress = statusData?.peer_review;
  const assignedPeers = peerProgress?.assigned ?? 0;
  const completedPeers = peerProgress?.completed ?? 0;
  const peerSummary = useMemo(() => {
    if (!peerProgress || !assignedPeers) return "No peer reviewers assigned";
    if (peerProgress.all_completed) return "All peer reviews completed";
    return `${completedPeers} of ${assignedPeers} peer reviews completed`;
  }, [peerProgress, assignedPeers, completedPeers]);

  return (
    <main className="min-h-screen bg-[#F3F4F6]">
      <AppHeader />
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-6 text-3xl font-semibold tracking-tight text-[#111827]">Welcome, {user?.full_name || user?.first_name}</h1>
        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {showQuestionnaireCard && (
              <div className="max-w-md">
                <Link href="/questionnaire">
                  <div className="group rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <h2 className="text-xl font-semibold text-[#111827]">Self Questionnaire</h2>
                      <span className={badgeClass}>Active</span>
                    </div>
                    <p className="mb-6 text-sm leading-relaxed text-gray-600">Fill your behavioural and performance self-evaluation form for the current review cycle.</p>
                    <div className="text-sm font-medium text-[#F6490D] transition group-hover:translate-x-1">Open Module →</div>
                  </div>
                </Link>
              </div>
            )}
            {showStatusTracker && (
              <div className="mx-auto max-w-4xl rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-[#111827]">Your Performance Review Workflow Status</h2>
                    <p className="mt-1 text-sm text-gray-600">Track the progress of your submitted performance questionnaire.</p>
                  </div>
                  <span className={badgeClass}>{String(statusData?.status || "").replaceAll("_", " ")}</span>
                </div>
                <div className="grid gap-4 rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Employee Name</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">{statusData?.employee_name || user?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Department</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">{statusData?.department || user?.department || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Review Cycle</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">{getReviewCycle(statusData)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Peer Review Progress</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">{peerSummary}</p>
                  </div>
                </div>
                <div className="mt-6">
                  <ReviewStatusTracker status={statusData?.status} role="self" skipReviewRequired={getSkipReviewRequired(statusData, "self", user)} />
                </div>
                <PeerAssignmentManager questionnaireId={statusData?.questionnaire_id} accessToken={accessToken} onUpdate={() => loadDashboardData(false)} />
              </div>
            )}
            <ReviewQueue title="Direct Reports Performance Review Workflow Status" items={rmQueue} role="rm" user={user}
              canReview={item => ["self_submitted", "under_rm_review"].includes(item.status)}
              reviewPath={item => `/rm-review/${item.questionnaire_id}`} />
            <PotentialQueue title="RM Potential Questionnaires" items={rmPotentialQueue} role="rm" />
            <ReviewQueue title="Skip-Manager-Level Reviews" items={skipQueue} role="skip" user={user}
              canReview={item => item.status === "under_skip_review"}
              reviewPath={item => `/skip-review/${item.questionnaire_id}`} />
            <PotentialQueue title="Skip-Level Potential Questionnaires" items={skipPotentialQueue} role="skip" />
            <PeerReviewQueue items={peerQueue} peerTab={peerTab} setPeerTab={setPeerTab} />
          </>
        )}
      </section>
    </main>
  );
}