"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import AppHeader from "@/components/layout/AppHeader";
import SkipSelfResponsesModal from "@/components/SkipSelfResponsesModal";
import SkipRMResponsesModal from "@/components/SkipRMResponsesModal";
import {
  emptyEvaluationAnswer,
  restoreEvaluationDraft,
  buildEvaluationResponses,
  validateEvaluation,
  getEvaluationError
} from "@/lib/evaluationDraft";
import { toast } from "sonner";

const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const inputClass = "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#111827] shadow-sm outline-none transition focus:border-[#F6490D] focus:ring-4 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:bg-gray-100";
const primaryClass = "rounded-xl bg-[#F6490D] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60";
const secondaryClass = "rounded-xl bg-gray-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60";

function formatSkipQuestion(text, name) {
  if (!text) return "";
  const target = name || "this employee";

  return text
    .replace(/^On a scale of 1-10,\s*how effectively do I\s+/i, `On a scale of 1-10, how effectively does ${target} `)
    .replace(/^On a scale of 1–10,\s*how effectively do I\s+/i, `On a scale of 1–10, how effectively does ${target} `)
    .replace(/\bdo I\b/gi, `does ${target}`)
    .replace(/\bmy\b/gi, `${target}'s`)
    .replace(/\bme\b/gi, target)
    .replace(/\bI\b/g, target);
}

function RatingInput({ value, maxMarks, onChange, disabled }) {
  const max = Number(maxMarks);

  return (
    <select
      value={value ?? ""}
      onChange={event => onChange(event.target.value)}
      disabled={disabled}
      className="w-32 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#111827] shadow-sm outline-none transition focus:border-[#F6490D] focus:ring-4 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
    >
      <option value="">Select</option>
      {Number.isInteger(max) && max >= 0 && Array.from({ length: max + 1 }, (_, index) => (
        <option key={index} value={index}>{index}</option>
      ))}
    </select>
  );
}

function QuestionSection({ title, items, responses, updateResponse, employeeName, disabled }) {
  if (!items.length) return null;

  return (
    <section className={cardClass}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-[#111827]">{title}</h2>
        <span className="rounded-full bg-[#FFF1EC] px-3 py-1 text-xs font-semibold text-[#F6490D]">
          {items.length} Question{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-4">
        {items.map((question, index) => {
          const answer = responses[question.item_id] || emptyEvaluationAnswer();
          const descriptive = question.question_type === "descriptive";

          return (
            <div key={question.item_id} className="rounded-[24px] bg-[#FCFCFD] p-5 shadow-[0_8px_22px_rgba(0,0,0,0.06)] transition hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl flex-1">
                  <p className="text-sm font-medium leading-7 text-[#111827]">
                    Q{index + 1}. {formatSkipQuestion(question.question_text, employeeName)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-white px-3 py-1">
                      {descriptive ? "Descriptive" : `Objective · 0–${question.max_marks}`}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      Weightage: {question.weightage}
                    </span>
                  </div>
                </div>

                {!descriptive && (
                  <RatingInput
                    value={answer.score}
                    maxMarks={question.max_marks}
                    disabled={disabled}
                    onChange={score => updateResponse(question.item_id, {
                      score,
                      descriptive_answer: ""
                    })}
                  />
                )}
              </div>

              {descriptive && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-600">
                    Skip-Level Manager's Assessment
                  </label>
                  <textarea
                    rows={4}
                    value={answer.descriptive_answer ?? ""}
                    disabled={disabled}
                    onChange={event => updateResponse(question.item_id, {
                      descriptive_answer: event.target.value,
                      score: ""
                    })}
                    placeholder="Enter your assessment of this employee..."
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SkipReviewPage() {
  const params = useParams();
  const questionnaireId = params?.id;
  const router = useRouter();
  const { accessToken } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [feedback, setFeedback] = useState("");
  const [scope, setScope] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [selfModalOpen, setSelfModalOpen] = useState(false);
  const [rmModalOpen, setRmModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadError, setLoadError] = useState("");

  const busy = saving || submitting;

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
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("Invalid response received from server.");
    }

    if (!response.ok) {
      throw new Error(getEvaluationError(data, `Request failed (${response.status}).`));
    }

    return data;
  }, [accessToken]);

  const loadForm = useCallback(async () => {
    if (!questionnaireId || !accessToken) return;

    try {
      setLoading(true);
      setLoadError("");

      const data = await api(`/api/evaluations/skip/review-form/${questionnaireId}`);
      const fetchedQuestions = Array.isArray(data?.questions) ? data.questions : [];
      const restored = restoreEvaluationDraft(fetchedQuestions, data?.draft);

      setQuestions(fetchedQuestions);
      setEmployeeName(data?.employee_name || "");
      setDepartment(data?.department || "");
      setResponses(restored.responses);
      setFeedback(restored.feedback);
      setScope(restored.scope_of_improvement);
      setSubmitted(data?.review_status === "submitted");
    } catch (error) {
      console.error("Failed to load skip review form:", error);
      setLoadError(error.message);
      setQuestions([]);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [questionnaireId, accessToken, api]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const groupedQuestions = useMemo(() => {
    const behavioral = [], performance = [], additional = [];

    questions.forEach(question => {
      const category = String(question.category || "").toLowerCase();
      const type = String(question.category_type || "").toLowerCase();

      if (type === "behavioral" || category.includes("behavior") || category.includes("behaviour") || category.includes("skillset")) {
        behavioral.push(question);
      } else if (type === "performance" || category.includes("performance")) {
        performance.push(question);
      } else {
        additional.push(question);
      }
    });

    return { behavioral, performance, additional };
  }, [questions]);

  function updateResponse(itemId, patch) {
    setResponses(previous => ({
      ...previous,
      [itemId]: { ...(previous[itemId] || emptyEvaluationAnswer()), ...patch }
    }));
  }

  function buildPayload(onlyAnswered = false) {
    return {
      questionnaire_id: Number(questionnaireId),
      responses: buildEvaluationResponses(questions, responses, "item_id", onlyAnswered),
      feedback,
      scope_of_improvement: scope
    };
  }

  function validateSubmission() {
    if (!questionnaireId) return "Invalid questionnaire ID.";
    return validateEvaluation(questions, responses, "item_id");
  }

  async function saveDraft() {
    if (busy || submitted || loading || loadError) return;

    try {
      setSaving(true);
      const data = await api("/api/evaluations/skip/save-draft", "POST", buildPayload(true));
      toast.success(data?.message || "Skip-level review draft saved successfully.");
    } catch (error) {
      console.error("Failed to save skip-level draft:", error);
      toast.error(error.message || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  function confirmSubmitReview() {
    if (busy || submitted || loading || loadError) return;

    const validationError = validateSubmission();
    if (validationError) return toast.error(validationError);

    setConfirmOpen(true);
  }

  async function submitReview() {
    if (busy || submitted) return;

    const validationError = validateSubmission();

    if (validationError) {
      setConfirmOpen(false);
      return toast.error(validationError);
    }

    try {
      setSubmitting(true);
      setConfirmOpen(false);

      const payload = buildPayload();
      payload.feedback = feedback.trim();
      payload.scope_of_improvement = scope.trim();

      const data = await api("/api/evaluations/skip/submit", "POST", payload);

      setSubmitted(true);
      toast.success(data?.message || "Skip-level review submitted successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Failed to submit skip-level review:", error);
      toast.error(error.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!questionnaireId) {
    return (
      <main className="min-h-screen bg-[#F3F4F6]">
        <AppHeader />
        <section className="mx-auto max-w-5xl px-6 py-8">
          <div className={cardClass}>
            <p className="text-sm text-red-600">Invalid questionnaire ID.</p>
          </div>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F3F4F6]">
        <AppHeader />
        <section className="mx-auto max-w-5xl px-6 py-8">
          <div className={`${cardClass} flex items-center gap-4`}>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#F6490D]" />
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Loading Skip Review Form</h2>
              <p className="text-sm text-gray-500">Retrieving questionnaire details...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-[#F3F4F6]">
        <AppHeader />
        <section className="mx-auto max-w-5xl px-6 py-8">
          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-red-600">Unable to Load Skip Review</h2>
            <p className="mt-2 text-sm text-gray-600">{loadError}</p>
            <button type="button" onClick={loadForm} className={`${primaryClass} mt-5`}>
              Retry
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F3F4F6]">
      <AppHeader />

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">
              Skip-Level Review Questionnaire
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Review the employee questionnaire after RM assessment and provide your final manager evaluation.
            </p>
            {employeeName && (
              <p className="mt-2 text-sm font-medium text-[#111827]">Employee: {employeeName}</p>
            )}
            {department && (
              <p className="mt-1 text-sm text-gray-500">
                Department: <span className="font-medium text-[#111827]">{department}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelfModalOpen(true)}
              className="rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md"
            >
              View Employee Self Responses
            </button>
            <button
              type="button"
              onClick={() => setRmModalOpen(true)}
              className="rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:shadow-md"
            >
              View Reporting Manager Responses
            </button>
          </div>
        </div>

        {submitted && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Your skip-level evaluation has already been submitted.
          </div>
        )}

        <div className="space-y-8">
          <QuestionSection
            title="Skillset & Behavioural Parameters"
            items={groupedQuestions.behavioral}
            responses={responses}
            updateResponse={updateResponse}
            employeeName={employeeName}
            disabled={busy || submitted}
          />

          <QuestionSection
            title="Performance Parameters"
            items={groupedQuestions.performance}
            responses={responses}
            updateResponse={updateResponse}
            employeeName={employeeName}
            disabled={busy || submitted}
          />

          <QuestionSection
            title="Additional Parameters"
            items={groupedQuestions.additional}
            responses={responses}
            updateResponse={updateResponse}
            employeeName={employeeName}
            disabled={busy || submitted}
          />

          <section className={cardClass}>
            <h2 className="mb-5 text-xl font-semibold tracking-tight text-[#111827]">
              Skip-Level Summary
            </h2>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#111827]">
                  Feedback
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide your overall feedback..."
                  value={feedback}
                  disabled={busy || submitted}
                  onChange={event => setFeedback(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#111827]">
                  Scope of Improvement
                </label>
                <textarea
                  rows={4}
                  placeholder="Mention areas where the employee can improve..."
                  value={scope}
                  disabled={busy || submitted}
                  onChange={event => setScope(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {!submitted && (
            <div className="flex flex-wrap gap-4">
              <button type="button" onClick={saveDraft} disabled={busy} className={secondaryClass}>
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button type="button" onClick={confirmSubmitReview} disabled={busy} className={primaryClass}>
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          )}
        </div>
      </section>

      <SkipSelfResponsesModal
        open={selfModalOpen}
        onClose={() => setSelfModalOpen(false)}
        questionnaireId={questionnaireId}
      />

      <SkipRMResponsesModal
        open={rmModalOpen}
        onClose={() => setRmModalOpen(false)}
        questionnaireId={questionnaireId}
      />

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-[#111827]">
              Confirm Submission
            </h2>
            <p className="mb-6 text-sm leading-6 text-gray-600">
              Are you sure you want to submit this skip-level review?
              <br />
              <span className="font-medium text-red-500">
                Once submitted, it cannot be edited again.
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-[#111827] transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button type="button" onClick={submitReview} disabled={submitting} className={primaryClass}>
                {submitting ? "Submitting..." : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}