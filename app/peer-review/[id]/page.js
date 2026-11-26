"use client";

import { useParams } from "next/navigation";
import PerformanceEvaluationPage from "@/components/performance/PerformanceEvaluationPage";

export default function PeerReviewPage() {
  const params = useParams();
  return <PerformanceEvaluationPage role="peer" questionnaireId={params?.id} />;
}