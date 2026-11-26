"use client";

import { useParams } from "next/navigation";
import PotentialEvaluationPage from "@/components/admin/potential/PotentialEvaluationPage";

export default function RMPotentialPage() {
  const { id } = useParams();
  return <PotentialEvaluationPage key={`rm-${id}`} assessmentId={id} evaluator="rm" />;
}