"use client";

import { useParams } from "next/navigation";
import PerformanceEvaluationPage from "@/components/performance/PerformanceEvaluationPage";

export default function RMReviewPage() {
  const params = useParams();
  return <PerformanceEvaluationPage role="rm" questionnaireId={params?.id} />;
}