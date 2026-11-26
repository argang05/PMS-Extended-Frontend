"use client";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Loader2, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";

const cardClass = "rounded-2xl border border-gray-200 bg-[#FCFCFD] p-4 shadow-sm";

function getError(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

function normalizeResponseData(result) {
  if (Array.isArray(result)) {
    return { responses: result, feedback: "", scope_of_improvement: "" };
  }
  if (!result || typeof result !== "object") throw new Error("Invalid response data received from server.");
  const source = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data : result;
  const responses = [
    source.responses, source.self_responses, source.rm_responses,
    source.results, result.responses
  ].find(Array.isArray);
  if (!responses) throw new Error("The server did not return a valid question-wise response list.");
  return {
    responses,
    feedback: source.feedback ?? result.feedback ?? "",
    scope_of_improvement: source.scope_of_improvement ?? result.scope_of_improvement ?? ""
  };
}

function ResponseItem({ response, index }) {
  const descriptiveAnswer = String(response.descriptive_answer ?? "");
  const descriptive = response.question_type === "descriptive" || Boolean(descriptiveAnswer.trim());
  const notApplicable = response.is_not_applicable === true;
  const hasScore = response.score !== null && response.score !== undefined && String(response.score).trim() !== "";
  const hasMaxMarks = response.max_marks !== null && response.max_marks !== undefined && response.max_marks !== "";
  const maxMarks = Number(response.max_marks);
  const score = Number(response.score);
  const answered = notApplicable || (descriptive ? Boolean(descriptiveAnswer.trim()) : hasScore);
  const showRatingButtons = hasMaxMarks && Number.isInteger(maxMarks) && maxMarks >= 0 && maxMarks <= 20;
  const questionText = typeof response.question === "string"
    ? response.question
    : response.question_text || response.question?.question_text || `Question ${index + 1}`;

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${answered ? "border-emerald-200" : "border-gray-200"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${answered ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-[10px] font-medium ${notApplicable ? "bg-gray-100 text-gray-600" : descriptive ? "bg-blue-50 text-blue-700" : "bg-[#FFF1EC] text-[#F6490D]"}`}>
                {notApplicable ? "Not Applicable" : descriptive ? "Descriptive" : "Objective"}
              </span>
              {response.category && typeof response.category === "string" && (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] text-gray-600">{response.category}</span>
              )}
              {response.weightage != null && (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[10px] text-gray-600">Weightage: {response.weightage}</span>
              )}
            </div>
            {answered && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium leading-7 text-[#111827]">{questionText}</p>
        </div>
      </div>
      {notApplicable ? (
        <div className="mt-5 rounded-xl bg-gray-100 px-4 py-3">
          <p className="text-sm font-medium text-gray-600">Not Applicable (N/A)</p>
        </div>
      ) : descriptive ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-[#FCFCFD] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Descriptive Response</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#111827]">
            {descriptiveAnswer.trim() || "No descriptive answer provided."}
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-gray-600">Submitted Rating</p>
            <span className={`text-sm font-semibold ${hasScore ? "text-[#F6490D]" : "text-gray-400"}`}>
              {hasScore ? response.score : "Not Rated"}{hasScore && hasMaxMarks ? ` / ${response.max_marks}` : ""}
            </span>
          </div>
          {showRatingButtons && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: maxMarks + 1 }, (_, rating) => (
                <span key={rating} className={`flex h-9 min-w-9 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold ${hasScore && score === rating ? "border-[#F6490D] bg-[#F6490D] text-white shadow-sm" : "border-gray-200 bg-gray-50 text-gray-400"}`}>
                  {rating}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ title, value, fallback }) {
  return (
    <div className={cardClass}>
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{value || fallback}</p>
    </div>
  );
}

export default function ReviewResponsesModal({
  open, onClose, questionnaireId, endpoint, title,
  loadingText = "Fetching submitted responses..."
}) {
  const { accessToken } = useAuth();
  const requestKey = `${endpoint}:${questionnaireId}:${accessToken || ""}`;
  const [state, setState] = useState({ key: null, data: null, loading: false, error: "" });
  const [retryCount, setRetryCount] = useState(0);
  const current = state.key === requestKey ? state : { data: null, loading: true, error: "" };
  const { data, loading, error } = current;

  useEffect(() => {
    if (!open) {
      setState({ key: null, data: null, loading: false, error: "" });
      return;
    }
    if (!questionnaireId || !accessToken) {
      setState({
        key: requestKey, data: null, loading: false,
        error: "Questionnaire information or authentication is unavailable."
      });
      return;
    }
    const controller = new AbortController();
    async function load() {
      setState({ key: requestKey, data: null, loading: true, error: "" });
      try {
        const response = await fetch(`${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(questionnaireId)}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal
        });
        const raw = await response.text();
        let result;
        try {
          result = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(`Invalid response received from server (${response.status}).`);
        }
        if (!response.ok) throw new Error(getError(result, `Failed to load responses (${response.status}).`));
        const normalized = normalizeResponseData(result);
        if (controller.signal.aborted) return;
        setState({ key: requestKey, data: normalized, loading: false, error: "" });
      } catch (err) {
        if (controller.signal.aborted || err.name === "AbortError") return;
        console.error(`Failed to load ${title}:`, err);
        setState({
          key: requestKey, data: null, loading: false,
          error: err.message || "Unable to load responses."
        });
      }
    }
    load();
    return () => controller.abort();
  }, [open, questionnaireId, accessToken, endpoint, title, requestKey, retryCount]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = event => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#FFF1EC] p-3">
              <ClipboardList className="h-6 w-6 text-[#F6490D]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[#111827]">{title}</h2>
              <p className="mt-1 text-xs text-gray-500">Submitted evaluation responses · Read-only</p>
            </div>
          </div>
          <button type="button" aria-label="Close responses" onClick={onClose} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-[#FCFCFD] p-6">
              <Loader2 className="h-9 w-9 shrink-0 animate-spin text-[#F6490D]" />
              <div>
                <p className="text-sm font-semibold text-[#111827]">Loading Responses</p>
                <p className="mt-1 text-sm text-gray-500">{loadingText}</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm font-semibold text-red-700">Unable to Load Responses</p>
              </div>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <button type="button" onClick={() => setRetryCount(previous => previous + 1)} className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100">
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-[#FFF7F4] p-4">
                <p className="text-sm font-medium text-gray-700">Submitted Question-wise Responses</p>
                <span className="rounded-full bg-[#FFF1EC] px-3 py-1 text-xs font-semibold text-[#F6490D]">{data.responses.length} Responses</span>
              </div>
              <div className="space-y-4">
                {data.responses.length ? data.responses.map((response, index) => (
                  <ResponseItem key={response.response_id ?? response.item_id ?? response.questionnaire_item_id ?? index} response={response} index={index} />
                )) : (
                  <div className={cardClass}>
                    <p className="text-sm text-gray-600">No submitted question-wise responses are available.</p>
                  </div>
                )}
              </div>
              <div className="mt-6 space-y-4">
                <FeedbackCard title="Feedback" value={data.feedback} fallback="No feedback provided." />
                <FeedbackCard title="Scope of Improvement" value={data.scope_of_improvement} fallback="No scope of improvement provided." />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No response data available.</p>
          )}
        </div>
        <div className="flex justify-end border-t border-gray-100 bg-white p-4">
          <button type="button" onClick={onClose} className="rounded-xl bg-[#F6490D] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#DD400B] hover:shadow-md">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}