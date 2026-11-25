"use client";

import ReviewResponsesModal from "@/components/ReviewResponsesModal";

export default function PeerSelfResponsesModal({
  open,
  onClose,
  questionnaireId
}) {
  return (
    <ReviewResponsesModal
      open={open}
      onClose={onClose}
      questionnaireId={questionnaireId}
      endpoint="/api/evaluations/peer/self-responses"
      title="Employee Self Responses"
      loadingText="Fetching submitted employee self ratings and comments..."
    />
  );
}