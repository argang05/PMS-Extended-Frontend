"use client";

import ReviewResponsesModal from "@/components/ReviewResponsesModal";

export default function SkipRMResponsesModal({
  open,
  onClose,
  questionnaireId
}) {
  return (
    <ReviewResponsesModal
      open={open}
      onClose={onClose}
      questionnaireId={questionnaireId}
      endpoint="/api/evaluations/skip/rm-responses"
      title="Reporting Manager Responses"
      loadingText="Fetching submitted reporting manager ratings and comments..."
    />
  );
}