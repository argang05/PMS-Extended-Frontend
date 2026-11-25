"use client";

import ReviewResponsesModal from "@/components/ReviewResponsesModal";

export default function SubordinateResponsesModal({
  open,
  onClose,
  questionnaireId
}) {
  return (
    <ReviewResponsesModal
      open={open}
      onClose={onClose}
      questionnaireId={questionnaireId}
      endpoint="/api/evaluations/rm/self-responses"
      title="Subordinate Self Responses"
      loadingText="Fetching submitted self ratings and comments..."
    />
  );
}