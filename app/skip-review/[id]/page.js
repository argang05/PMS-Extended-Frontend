"use client";

import { useParams } from "next/navigation";
import PerformanceEvaluationPage from "@/components/performance/PerformanceEvaluationPage";

export default function SkipReviewPage() {
  const params = useParams();
  return <PerformanceEvaluationPage role="skip" questionnaireId={params?.id} />;
}