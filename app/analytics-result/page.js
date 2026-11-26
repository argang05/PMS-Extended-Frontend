"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import { useAuth } from "@/app/context/AuthContext";
import { toast } from "sonner";
import NineBoxMatrixCard from "@/components/NineBoxMatrixCard";

const ANALYTICS_EVENT = "tor:analytics-release-changed";
const ANALYTICS_INTERVAL = 30000;
const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const panelClass = "rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5";

function FeedbackCard({ section }) {
  const roleLabelMap = {
    self: "Self",
    rm: "Reporting Manager",
    skip: "Skip-Level Manager",
    peer: "Peer Reviewer"
  };
  return (
    <div className={panelClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{roleLabelMap[section.role] || section.role}</p>
          <p className="mt-1 text-base font-semibold text-[#111827]">{section.evaluator_name || "—"}</p>
        </div>
        <p className="text-xs text-gray-500">{section.submitted_at ? new Date(section.submitted_at).toLocaleString() : "—"}</p>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Feedback</p>
          <p className="mt-2 text-sm leading-6 text-[#111827]">{section.feedback || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Scope of Improvement</p>
          <p className="mt-2 text-sm leading-6 text-[#111827]">{section.scope_of_improvement || "—"}</p>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsResultPage() {
  const { user, accessToken } = useAuth();
  const employeeNumber = String(user?.employee_number || "");
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setReportData(null);
    setMessage("");
    setLoading(true);
    if (!accessToken) {
      setLoading(false);
      return;
    }
    let disposed = false;
    let activeRequest = null;

    async function loadAnalyticsReport(initial = false, force = false) {
      if (disposed || document.visibilityState === "hidden") return;
      if (activeRequest) {
        if (!force) return;
        activeRequest.abort();
      }
      const controller = new AbortController();
      activeRequest = controller;
      const isCurrent = () => !disposed && !controller.signal.aborted && activeRequest === controller;
      try {
        if (initial) setLoading(true);
        const options = {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal
        };
        const statusRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/evaluations/self-review-status/`, options);
        const statusData = await statusRes.json();
        if (!isCurrent()) return;
        if (!statusRes.ok || !statusData?.questionnaire_id) {
          setMessage("No questionnaire found for your account.");
          setReportData(null);
          return;
        }
        const res = await fetch(`/api/scoring/my-analytics/${statusData.questionnaire_id}`, options);
        const data = await res.json();
        if (!isCurrent()) return;
        if (!res.ok) {
          setMessage(data?.message || data?.error || "Analytics report not available yet.");
          setReportData(null);
          return;
        }
        setReportData(data);
        setMessage("");
      } catch (error) {
        if (error.name === "AbortError" || !isCurrent()) return;
        console.error(error);
        if (initial) toast.error("Failed to load analytics report.");
        setMessage("Failed to load analytics report.");
        setReportData(null);
      } finally {
        if (isCurrent()) setLoading(false);
        if (activeRequest === controller) activeRequest = null;
      }
    }

    function handleAnalyticsChange(event) {
      const affectedEmployee = String(event.detail?.employeeNumber || "");
      if (affectedEmployee && affectedEmployee !== employeeNumber) return;
      if (event.detail?.isReleased === false) {
        setReportData(null);
        setMessage("Analytics report is not available yet.");
      }
      loadAnalyticsReport(false, true);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") loadAnalyticsReport();
    }

    function handleFocus() {
      loadAnalyticsReport();
    }

    loadAnalyticsReport(true);
    const interval = window.setInterval(() => loadAnalyticsReport(), ANALYTICS_INTERVAL);
    window.addEventListener(ANALYTICS_EVENT, handleAnalyticsChange);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      activeRequest?.abort();
      window.clearInterval(interval);
      window.removeEventListener(ANALYTICS_EVENT, handleAnalyticsChange);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accessToken, employeeNumber]);

  return (
    <main className="min-h-screen bg-[#F3F4F6]">
      <AppHeader />
      <section className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className={cardClass}>
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">Performance Analytics Report</h1>
          <p className="mt-2 text-sm text-gray-600">Consolidated analytics report including final performance score, PPI, final potential score, 9-box placement, and evaluator feedback.</p>
        </div>
        {loading ? (
          <div className={cardClass}>
            <p className="text-sm text-gray-600">Loading analytics report...</p>
          </div>
        ) : !reportData ? (
          <div className={cardClass}>
            <p className="text-sm text-gray-600">{message || "Analytics report is not available yet."}</p>
          </div>
        ) : (
          <>
            <div className={cardClass}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className={panelClass}>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Employee Name</p>
                  <p className="mt-2 text-lg font-semibold text-[#111827]">{reportData.employee_name || user?.full_name || "—"}</p>
                </div>
                <div className={panelClass}>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Review Cycle</p>
                  <p className="mt-2 text-lg font-semibold text-[#111827]">{reportData.review_cycle || "—"}</p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[#111827]">Consolidated Score Summary</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className={panelClass}>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Final Consolidated Performance Score</p>
                  <p className="mt-3 text-3xl font-bold text-[#111827]">{reportData.performance_score?.final_effective_score ?? "—"}</p>
                  <p className="mt-2 text-xs text-gray-500">Out of 10</p>
                </div>
                <div className={panelClass}>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Final PPI</p>
                  <p className="mt-3 text-3xl font-bold text-[#111827]">{reportData.ppi?.ppi_score ?? "—"}</p>
                  <p className="mt-2 text-xs text-gray-500">Out of 10</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-[#FFF7F4] p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Final Consolidated Potential Score</p>
                  <p className="mt-3 text-3xl font-bold text-[#111827]">{reportData.potential?.final_potential_score ?? "—"}</p>
                  <p className="mt-2 text-xs text-gray-500">Out of 10</p>
                </div>
              </div>
            </div>
            <NineBoxMatrixCard data={{
              ...reportData.nine_box,
              employee_name: reportData.employee_name,
              employee_number: reportData.employee_number,
              review_cycle: reportData.review_cycle
            }} />
            <div className={cardClass}>
              <h2 className="mb-6 text-2xl font-semibold tracking-tight text-[#111827]">Feedback & Scope of Improvement</h2>
              <div className="grid gap-5 md:grid-cols-2">
                {reportData.feedback_sections?.length > 0 ? (
                  reportData.feedback_sections.map((section, index) => <FeedbackCard key={`${section.role}-${index}`} section={section} />)
                ) : (
                  <div className={panelClass}>
                    <p className="text-sm text-gray-600">No feedback available.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}