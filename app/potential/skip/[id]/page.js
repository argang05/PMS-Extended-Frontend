"use client";

import { useParams } from "next/navigation";
import PotentialEvaluationPage from "@/components/admin/potential/PotentialEvaluationPage";

export default function SkipPotentialPage() {
  const { id } = useParams();
  return <PotentialEvaluationPage key={`skip-${id}`} assessmentId={id} evaluator="skip" />;
}