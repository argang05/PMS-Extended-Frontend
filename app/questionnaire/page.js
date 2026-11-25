"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/layout/AppHeader";
import { useAuth } from "@/app/context/AuthContext";
import SubmitConfirmModal from "@/components/SubmitConfirmModal";
import {
  fetchCurrentQuestionnaire,
  saveQuestionnaireDraft,
  submitQuestionnaire
} from "@/services/questionnaire";
import {
  emptyEvaluationAnswer,
  restoreEvaluationDraft,
  buildEvaluationResponses,
  validateEvaluation
} from "@/lib/evaluationDraft";
import { toast } from "sonner";

const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";
const inputClass = "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-[#111827] outline-none focus:border-[#F6490D] focus:ring-2 focus:ring-[#F6490D]/20 disabled:cursor-not-allowed disabled:bg-gray-100";

function RatingInput({ value, maxMarks, onChange, disabled }) {
  const max = Number(maxMarks);

  return (
    <select
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-32 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-[#111827] shadow-sm outline-none focus:border-[#F6490D] disabled:cursor-not-allowed disabled:bg-gray-100"
    >
      <option value="">Select</option>
      {Number.isInteger(max) && max >= 0 && Array.from({ length: max + 1 }, (_, index) => (
        <option key={index} value={index}>{index}</option>
      ))}
    </select>
  );
}

function SectionCard({ title, items, responses, updateResponse, disabled }) {
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
        {items.map((item, index) => {
          const answer = responses[item.id] || emptyEvaluationAnswer();
          const descriptive = item.question_type === "descriptive";

          return (
            <div key={item.id} className="rounded-2xl border border-gray-200 bg-[#FCFCFD] p-5 shadow-sm transition hover:shadow-md">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl flex-1">
                  <p className="text-sm font-semibold leading-7 text-[#111827]">
                    Q{index + 1}. {item.question_text}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className="rounded-full bg-white px-3 py-1">
                      {descriptive ? "Descriptive" : `Objective · 0–${item.max_marks}`}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      Weightage: {item.weightage}
                    </span>
                  </div>
                </div>

                {!descriptive && (
                  <RatingInput
                    value={answer.score}
                    maxMarks={item.max_marks}
                    disabled={disabled}
                    onChange={score => updateResponse(item.id, { score, descriptive_answer: "" })}
                  />
                )}
              </div>

              {descriptive && (
                <div className="mt-4">
                  <label className="mb-2 block text-xs font-medium text-gray-600">Your Response</label>
                  <textarea
                    rows={4}
                    value={answer.descriptive_answer ?? ""}
                    disabled={disabled}
                    onChange={e => updateResponse(item.id, {
                      descriptive_answer: e.target.value,
                      score: ""
                    })}
                    placeholder="Write your response here..."
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

export default function QuestionnairePage() {
  const { accessToken, user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [questionnaireId, setQuestionnaireId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [feedback, setFeedback] = useState("");
  const [scopeOfImprovement, setScopeOfImprovement] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;

    async function loadQuestionnaire() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchCurrentQuestionnaire(accessToken);
        if (!active) return;

        const questionList = Array.isArray(data?.questions) ? data.questions : [];
        const restored = restoreEvaluationDraft(questionList, data?.draft, "id");

        setQuestionnaireId(data?.questionnaire_id ?? null);
        setQuestions(questionList);
        setResponses(restored.responses);
        setFeedback(restored.feedback);
        setScopeOfImprovement(restored.scope_of_improvement);
        setIsSubmitted(Boolean(data?.status && data.status !== "draft"));
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load questionnaire.");
          toast.error(err.message || "Failed to load questionnaire.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadQuestionnaire();
    return () => { active = false; };
  }, [accessToken]);

  const groupedQuestions = useMemo(() => {
    const behavioral = [], performance = [], additional = [];

    questions.forEach(question => {
      const type = String(question.category_type || "").toLowerCase();
      if (type === "behavioral") behavioral.push(question);
      else if (type === "performance") performance.push(question);
      else additional.push(question);
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
      questionnaire_id: questionnaireId,
      feedback,
      scope_of_improvement: scopeOfImprovement,
      responses: buildEvaluationResponses(questions, responses, "id", onlyAnswered)
    };
  }

  function validateSubmission() {
    if (!questionnaireId) return "Questionnaire not found.";
    return validateEvaluation(
      questions, responses, "id", true, feedback, scopeOfImprovement
    );
  }

  async function handleSaveDraft() {
    if (loading || saving || submitting || isSubmitted) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!questionnaireId) throw new Error("Questionnaire not found.");

      const data = await saveQuestionnaireDraft(accessToken, buildPayload(true));
      const message = data?.message || "Draft saved successfully.";

      setSuccess(message);
      toast.success(message);
    } catch (err) {
      const message = err.message || "Failed to save draft.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function confirmSubmission() {
    if (loading || saving || submitting || isSubmitted) return;

    const validationError = validateSubmission();

    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setError("");
    setConfirmOpen(true);
  }

  async function handleSubmit() {
    if (loading || saving || submitting || isSubmitted) return;

    const validationError = validateSubmission();

    if (validationError) {
      setConfirmOpen(false);
      setError(validationError);
      toast.error(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setConfirmOpen(false);
      setError("");
      setSuccess("");

      const data = await submitQuestionnaire(accessToken, buildPayload());
      const message = data?.message || "Questionnaire submitted successfully.";

      setSuccess(message);
      setIsSubmitted(true);
      toast.success(message);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err.message || "Failed to submit questionnaire.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || saving || submitting || isSubmitted;

  return (
    <main className="min-h-screen bg-[#F3F4F6]">
      <AppHeader />

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[#111827]">
            Self Questionnaire
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Fill your self-evaluation form carefully. Once submitted, it will move to the next review stage.
          </p>
          {user?.department && (
            <p className="mt-1 text-sm text-gray-500">
              Department: <span className="font-medium text-[#111827]">{user.department}</span>
            </p>
          )}
        </div>

        {loading ? (
          <div className={cardClass}>
            <p className="text-sm text-gray-600">Loading questionnaire...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {success}
              </div>
            )}

            {isSubmitted && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Your self-evaluation has already been submitted. Responses are read-only.
              </div>
            )}

            {questionnaireId && (
              <>
                <SectionCard
                  title="Skillset & Behavioural Parameters"
                  items={groupedQuestions.behavioral}
                  responses={responses}
                  updateResponse={updateResponse}
                  disabled={disabled}
                />

                <SectionCard
                  title="Performance Parameters"
                  items={groupedQuestions.performance}
                  responses={responses}
                  updateResponse={updateResponse}
                  disabled={disabled}
                />

                <SectionCard
                  title="Additional Parameters"
                  items={groupedQuestions.additional}
                  responses={responses}
                  updateResponse={updateResponse}
                  disabled={disabled}
                />

                <section className={cardClass}>
                  <h2 className="mb-5 text-xl font-semibold tracking-tight text-[#111827]">
                    Self Summary
                  </h2>

                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#111827]">
                        Feedback
                      </label>
                      <textarea
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        rows={4}
                        disabled={disabled}
                        placeholder="Write your overall feedback for this review cycle..."
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#111827]">
                        Scope of Improvement
                      </label>
                      <textarea
                        value={scopeOfImprovement}
                        onChange={e => setScopeOfImprovement(e.target.value)}
                        rows={4}
                        disabled={disabled}
                        placeholder="Mention areas where you want to improve further..."
                        className={inputClass}
                      />
                    </div>
                  </div>
                </section>

                {!isSubmitted && (
                  <div className="flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={disabled}
                      className="rounded-2xl border border-[#F6490D] bg-white px-6 py-3 text-sm font-semibold text-[#F6490D] shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Draft"}
                    </button>

                    <button
                      type="button"
                      onClick={confirmSubmission}
                      disabled={disabled}
                      className="rounded-2xl bg-[#F6490D] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(246,73,13,0.22)] transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? "Submitting..." : "Submit Final"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <SubmitConfirmModal
          open={confirmOpen}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleSubmit}
        />
      </section>
    </main>
  );
}