"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";

const cardClass = "rounded-2xl border border-gray-200 bg-[#FCFCFD] p-4 shadow-sm";

function getError(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

function ResponseItem({ response, index }) {
  const descriptive = response.question_type === "descriptive" ||
    (response.descriptive_answer !== null &&
     response.descriptive_answer !== undefined &&
     String(response.descriptive_answer).trim() !== "");

  const notApplicable = response.is_not_applicable === true;
  const hasScore = response.score !== null &&
    response.score !== undefined &&
    response.score !== "";

  const hasMaxMarks = response.max_marks !== null &&
    response.max_marks !== undefined &&
    response.max_marks !== "";

  return (
    <div className={cardClass}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <p className="flex-1 text-sm font-medium leading-6 text-[#111827]">
          {response.question || response.question_text || `Question ${index + 1}`}
        </p>

        <span className="rounded-full bg-[#FFF1EC] px-3 py-1 text-xs font-medium text-[#F6490D]">
          {notApplicable ? "Not Applicable" : descriptive ? "Descriptive" : "Objective"}
        </span>
      </div>

      {response.category && (
        <p className="mb-3 text-xs text-gray-500">
          Category: {response.category}
        </p>
      )}

      {notApplicable ? (
        <div className="rounded-xl bg-gray-100 px-4 py-3">
          <p className="text-sm font-medium text-gray-600">
            Not Applicable (N/A)
          </p>
        </div>
      ) : descriptive ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Descriptive Response
          </p>

          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#111827]">
            {response.descriptive_answer?.trim() || "No descriptive answer provided."}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-gray-600">Rating:</p>

          <span className="text-base font-semibold text-[#111827]">
            {hasScore ? response.score : "Not Rated"}
            {hasScore && hasMaxMarks ? ` / ${response.max_marks}` : ""}
          </span>
        </div>
      )}

      {response.weightage !== null &&
        response.weightage !== undefined && (
          <p className="mt-3 text-xs text-gray-500">
            Weightage: {response.weightage}
          </p>
        )}
    </div>
  );
}

export default function ReviewResponsesModal({
  open,
  onClose,
  questionnaireId,
  endpoint,
  title,
  loadingText = "Fetching submitted responses..."
}) {
  const { accessToken } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !questionnaireId || !accessToken) return;

    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError("");
        setData(null);

        const response = await fetch(
          `${endpoint}/${questionnaireId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
            signal: controller.signal
          }
        );

        const raw = await response.text();
        let result;

        try {
          result = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error("Invalid response received from server.");
        }

        if (!response.ok) {
          throw new Error(
            getError(result, `Failed to load responses (${response.status}).`)
          );
        }

        if (controller.signal.aborted) return;

        setData({
          responses: Array.isArray(result.responses) ? result.responses : [],
          feedback: result.feedback || "",
          scope_of_improvement: result.scope_of_improvement || ""
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(`Failed to load ${title}:`, err);
        setError(err.message || "Unable to load responses.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [open, questionnaireId, accessToken, endpoint, title]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
      >
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-[#111827]">
          {title}
        </h2>

        {loading ? (
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-[#FCFCFD] p-6">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-[#F6490D]" />

            <div>
              <p className="text-sm font-semibold text-[#111827]">
                Loading Responses
              </p>
              <p className="text-sm text-gray-500">{loadingText}</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-700">
              Unable to Load Responses
            </p>
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </div>
        ) : data ? (
          <>
            <div className="space-y-4">
              {data.responses.length > 0 ? (
                data.responses.map((response, index) => (
                  <ResponseItem
                    key={response.response_id ?? response.item_id ?? index}
                    response={response}
                    index={index}
                  />
                ))
              ) : (
                <div className={cardClass}>
                  <p className="text-sm text-gray-600">
                    No submitted question-wise responses are available.
                  </p>
                </div>
              )}
            </div>

            <div className={`mt-6 ${cardClass}`}>
              <p className="text-sm font-semibold text-[#111827]">
                Feedback
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                {data.feedback || "No feedback provided."}
              </p>
            </div>

            <div className={`mt-4 ${cardClass}`}>
              <p className="text-sm font-semibold text-[#111827]">
                Scope of Improvement
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                {data.scope_of_improvement || "No scope of improvement provided."}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">No response data available.</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-xl bg-[#F6490D] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md"
        >
          OK
        </button>
      </div>
    </div>
  );
}