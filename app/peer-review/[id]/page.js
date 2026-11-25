"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import AppHeader from "@/components/layout/AppHeader";
import PeerSelfResponsesModal from "@/components/PeerSelfResponsesModal";
import { toast } from "sonner";

const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#F6490D] focus:ring-2 focus:ring-[#F6490D]/10 disabled:cursor-not-allowed disabled:opacity-60";
const primaryClass = "rounded-xl bg-[#F6490D] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "rounded-xl bg-gray-700 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";

function getError(data, fallback) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.detail === "string") return data.detail;
  if (data?.error && typeof data.error === "object") return JSON.stringify(data.error);
  if (data && typeof data === "object") {
    const entry = Object.entries(data).find(([key, value]) => !["message", "results"].includes(key) && value);
    if (entry) return `${entry[0]}: ${Array.isArray(entry[1]) ? entry[1].join(", ") : JSON.stringify(entry[1])}`;
  }
  return fallback;
}

function formatPeerQuestion(text, name) {
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

function emptyResponse() {
  return { score: "", descriptive_answer: "", is_not_applicable: false };
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
          const answer = responses[question.item_id] || emptyResponse();
          const descriptive = question.question_type === "descriptive";
          const maxMarks = Number(question.max_marks) || 10;

          return (
            <div
              key={question.item_id}
              className="rounded-[24px] bg-[#FCFCFD] p-5 shadow-[0_8px_22px_rgba(0,0,0,0.06)] transition hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl flex-1">
                  <p className="text-sm font-medium leading-7 text-[#111827]">
                    Q{index + 1}. {formatPeerQuestion(question.question_text, employeeName)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-white px-3 py-1">
                      {descriptive ? "Descriptive" : `Objective · 0–${maxMarks}`}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      Weightage: {question.weightage}
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(answer.is_not_applicable)}
                    disabled={disabled}
                    onChange={event => updateResponse(question.item_id, {
                      is_not_applicable: event.target.checked,
                      score: "",
                      descriptive_answer: ""
                    })}
                  />
                  Not Applicable
                </label>
              </div>

              {!answer.is_not_applicable ? (
                descriptive ? (
                  <textarea
                    rows={4}
                    value={answer.descriptive_answer || ""}
                    disabled={disabled}
                    onChange={event => updateResponse(question.item_id, {
                      descriptive_answer: event.target.value,
                      score: ""
                    })}
                    placeholder="Enter your assessment of this employee..."
                    className={inputClass}
                  />
                ) : (
                  <div className="max-w-xs">
                    <label className="mb-2 block text-xs font-medium text-gray-600">
                      Rating (0 to {maxMarks})
                    </label>
                    <select
                      value={answer.score ?? ""}
                      disabled={disabled}
                      onChange={event => updateResponse(question.item_id, {
                        score: event.target.value,
                        descriptive_answer: ""
                      })}
                      className={inputClass}
                    >
                      <option value="">Select Rating</option>
                      {Array.from({ length: maxMarks + 1 }, (_, value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This question is marked Not Applicable and will not receive a numerical score.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PeerReviewPage() {
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
  const [peerStatus, setPeerStatus] = useState("");
  const [selfModalOpen, setSelfModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  const submitted = peerStatus === "completed" || peerStatus === "submitted";
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
      throw new Error("Invalid response from server.");
    }

    if (!response.ok) throw new Error(getError(data, `Request failed (${response.status}).`));
    return data;
  }, [accessToken]);

  const loadForm = useCallback(async () => {
    if (!questionnaireId || !accessToken) return;

    try {
      setLoading(true);
      setLoadError("");

      const form = await api(`/api/evaluations/peer/review-form/${questionnaireId}`);
      const fetchedQuestions = Array.isArray(form.questions) ? form.questions : [];

      setQuestions(fetchedQuestions);
      setEmployeeName(form.employee_name || "");
      setDepartment(form.department || "");
      setPeerStatus(form.peer_status || "");

      const initial = Object.fromEntries(
        fetchedQuestions.map(question => [question.item_id, emptyResponse()])
      );

      const draft = await api(`/api/evaluations/peer/my-draft/${questionnaireId}`);

      if (Array.isArray(draft.responses)) {
        draft.responses.forEach(response => {
          const itemId = Number(response.item_id);
          if (!Object.prototype.hasOwnProperty.call(initial, itemId)) return;

          initial[itemId] = {
            score: response.score === null || response.score === undefined ? "" : String(response.score),
            descriptive_answer: response.descriptive_answer || "",
            is_not_applicable: Boolean(response.is_not_applicable)
          };
        });
      }

      setFeedback(draft.feedback || "");
      setScope(draft.scope_of_improvement || "");
      if (draft.peer_status) setPeerStatus(draft.peer_status);
      setResponses(initial);
    } catch (error) {
      setLoadError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [questionnaireId, accessToken, api]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  function updateResponse(itemId, patch) {
    setResponses(previous => ({
      ...previous,
      [itemId]: { ...(previous[itemId] || emptyResponse()), ...patch }
    }));
  }

  const groupedQuestions = useMemo(() => {
    const behavioral = [];
    const performance = [];
    const uncategorized = [];

    questions.forEach(question => {
      const category = String(question.category || "").toLowerCase();
      const type = String(question.category_type || "").toLowerCase();

      if (type === "behavioral" || category.includes("behavior") || category.includes("behaviour") || category.includes("skillset")) {
        behavioral.push(question);
      } else if (type === "performance" || category.includes("performance")) {
        performance.push(question);
      } else {
        uncategorized.push(question);
      }
    });

    return { behavioral, performance, uncategorized };
  }, [questions]);

  function buildResponses(onlyAnswered = false) {
    return questions.flatMap(question => {
      const answer = responses[question.item_id] || emptyResponse();
      const descriptive = question.question_type === "descriptive";

      if (answer.is_not_applicable) {
        return [{ item_id: question.item_id, is_not_applicable: true }];
      }

      if (descriptive) {
        const text = (answer.descriptive_answer || "").trim();
        if (!text && onlyAnswered) return [];
        return [{ item_id: question.item_id, descriptive_answer: text }];
      }

      if (answer.score === "" || answer.score === null || answer.score === undefined) {
        return onlyAnswered ? [] : [{ item_id: question.item_id, score: null }];
      }

      return [{ item_id: question.item_id, score: Number(answer.score) }];
    });
  }

  function validateSubmission() {
    if (!questions.length) return "There are no questions available for submission.";

    for (const question of questions) {
      const answer = responses[question.item_id] || emptyResponse();

      if (answer.is_not_applicable) continue;

      if (question.question_type === "descriptive") {
        if (!(answer.descriptive_answer || "").trim()) {
          return "Please answer all descriptive questions or mark them N/A.";
        }
      } else {
        if (answer.score === "" || answer.score === null || answer.score === undefined) {
          return "Please rate all objective questions or mark them N/A.";
        }

        const score = Number(answer.score);
        const maxMarks = Number(question.max_marks) || 10;

        if (!Number.isInteger(score) || score < 0 || score > maxMarks) {
          return `Scores must be between 0 and ${maxMarks}.`;
        }
      }
    }

    if (!feedback.trim()) return "Please provide feedback before submission.";
    if (!scope.trim()) return "Please provide scope of improvement before submission.";

    return null;
  }

  async function saveDraft() {
    if (busy || submitted) return;

    try {
      setSaving(true);

      const result = await api("/api/evaluations/peer/save-draft", "POST", {
        questionnaire_id: Number(questionnaireId),
        responses: buildResponses(true),
        feedback,
        scope_of_improvement: scope
      });

      toast.success(result.message || "Peer review draft saved successfully.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmSubmitReview() {
    if (busy || submitted) return;

    const error = validateSubmission();
    if (error) return toast.error(error);

    setConfirmOpen(true);
  }

  async function submitReview() {
    if (busy || submitted) return;

    const error = validateSubmission();
    if (error) {
      setConfirmOpen(false);
      return toast.error(error);
    }

    try {
      setSubmitting(true);
      setConfirmOpen(false);

      const result = await api("/api/evaluations/peer/submit", "POST", {
        questionnaire_id: Number(questionnaireId),
        responses: buildResponses(),
        feedback: feedback.trim(),
        scope_of_improvement: scope.trim()
      });

      setPeerStatus("completed");
      toast.success(result.message || "Peer review submitted successfully.");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error.message);
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
              <h2 className="text-lg font-semibold text-[#111827]">Loading Peer Review Form</h2>
              <p className="text-sm text-gray-500">Retrieving questions and your saved draft...</p>
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
            <h2 className="text-lg font-semibold text-red-600">Unable to Load Peer Review</h2>
            <p className="mt-2 text-sm text-gray-600">{loadError}</p>
            <button onClick={loadForm} className={`${primaryClass} mt-5`}>Retry</button>
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
              Peer Review Questionnaire
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Review the employee self questionnaire and provide your independent peer assessment.
            </p>

            {employeeName && (
              <p className="mt-2 text-sm font-medium text-[#111827]">
                Employee: {employeeName}
              </p>
            )}

            {department && (
              <p className="mt-1 text-sm text-gray-500">
                Department: <span className="font-medium text-[#111827]">{department}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelfModalOpen(true)}
            className="rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white"
          >
            View Employee Self Responses
          </button>
        </div>

        {submitted && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Your peer evaluation has already been submitted. Further editing is disabled.
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
            items={groupedQuestions.uncategorized}
            responses={responses}
            updateResponse={updateResponse}
            employeeName={employeeName}
            disabled={busy || submitted}
          />

          <section className={cardClass}>
            <h2 className="mb-5 text-xl font-semibold tracking-tight text-[#111827]">
              Peer Summary
            </h2>

            <label className="mb-2 block text-sm font-medium text-gray-700">
              Feedback
            </label>
            <textarea
              rows={4}
              placeholder="Feedback"
              value={feedback}
              disabled={busy || submitted}
              onChange={event => setFeedback(event.target.value)}
              className={`${inputClass} mb-5`}
            />

            <label className="mb-2 block text-sm font-medium text-gray-700">
              Scope of Improvement
            </label>
            <textarea
              rows={4}
              placeholder="Scope of Improvement"
              value={scope}
              disabled={busy || submitted}
              onChange={event => setScope(event.target.value)}
              className={inputClass}
            />
          </section>

          {!submitted && (
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={saveDraft}
                disabled={busy}
                className={secondaryClass}
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={confirmSubmitReview}
                disabled={busy}
                className={primaryClass}
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          )}
        </div>
      </section>

      <PeerSelfResponsesModal
        open={selfModalOpen}
        onClose={() => setSelfModalOpen(false)}
        questionnaireId={questionnaireId}
      />

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />

          <div className="relative z-10 w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold text-[#111827]">
              Confirm Submission
            </h2>

            <p className="mb-6 text-sm leading-6 text-gray-600">
              Are you sure you want to submit this peer review?
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
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-[#111827]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitReview}
                disabled={submitting}
                className={primaryClass}
              >
                {submitting ? "Submitting..." : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}