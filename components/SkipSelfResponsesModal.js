"use client";

import ReviewResponsesModal from "@/components/ReviewResponsesModal";

export default function SkipSelfResponsesModal({
  open,
  onClose,
  questionnaireId
}) {
  return (
    <ReviewResponsesModal
      open={open}
      onClose={onClose}
      questionnaireId={questionnaireId}
      endpoint="/api/evaluations/skip/self-responses"
      title="Subordinate Self Responses"
      loadingText="Fetching submitted employee self ratings and comments..."
    />
  );
}