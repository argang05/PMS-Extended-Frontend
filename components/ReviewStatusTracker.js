"use client";
import { useAuth } from "@/app/context/AuthContext";

const DEFAULT_TRACKER_STEPS = [
  "Self Submitted", "Under RM Review", "Reviewed by RM",
  "Under Skip Review", "Reviewed by Skip Manager"
];
const SM_TRACKER_STEPS = [
  "Self Submitted", "Under RM Review", "Reviewed by RM"
];

function getCurrentStep(status, skipReviewRequired) {
  const normalized = String(status || "").trim().toLowerCase();
  switch (normalized) {
    case "self_submitted": return 1;
    case "under_rm_review":
    case "under_peer_review": return 2;
    case "rm_reviewed": return 3;
    case "under_skip_review": return skipReviewRequired ? 4 : 3;
    case "skip_reviewed":
    case "completed": return skipReviewRequired ? 5 : 3;
    default: return 0;
  }
}

export default function ReviewStatusTracker({
  status, compact = false, skipReviewRequired: skipReviewRequiredProp, role = "self"
}) {
  const { user } = useAuth();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const rmBand = String(user?.reporting_manager?.band || "").toUpperCase().trim();
  const hasSkipStage = ["under_skip_review", "skip_reviewed"].includes(normalizedStatus);
  const skipReviewRequired = role === "skip" || hasSkipStage
    ? true
    : typeof skipReviewRequiredProp === "boolean"
      ? skipReviewRequiredProp
      : role === "self"
        ? !rmBand.startsWith("SM")
        : true;
  const trackerSteps = skipReviewRequired ? DEFAULT_TRACKER_STEPS : SM_TRACKER_STEPS;
  const currentStep = getCurrentStep(normalizedStatus, skipReviewRequired);
  const progressPercent = currentStep <= 1 ? 0 : ((currentStep - 1) / (trackerSteps.length - 1)) * 100;
  const terminal = ["completed", "skip_reviewed"].includes(normalizedStatus) || (!skipReviewRequired && normalizedStatus === "rm_reviewed");
  const trackInset = 50 / trackerSteps.length;

  return (
    <div className={`mt-5 rounded-2xl border border-gray-200 bg-[#FCFCFD] ${compact ? "p-4" : "p-5"}`}>
      <div className="relative">
        <div className="absolute top-4 h-1 rounded-full bg-gray-200" style={{ left: `${trackInset}%`, right: `${trackInset}%` }} />
        <div className="absolute top-4 h-1 rounded-full bg-[#F6490D] transition-all duration-500 ease-in-out"
          style={{ left: `${trackInset}%`, width: `${progressPercent * (100 - 2 * trackInset) / 100}%` }} />
        <div className="relative grid items-start" style={{ gridTemplateColumns: `repeat(${trackerSteps.length}, minmax(0, 1fr))` }}>
          {trackerSteps.map((label, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber === currentStep && !terminal;
            const isHighlighted = stepNumber <= currentStep;
            return (
              <div key={label} className="flex min-w-0 flex-col items-center px-1 text-center" aria-current={isActive ? "step" : undefined}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${isHighlighted ? "bg-[#F6490D] text-white shadow-[0_6px_18px_rgba(246,73,13,0.28)]" : "bg-gray-300 text-white"} ${isActive ? "scale-110" : "scale-100"}`}>
                  {stepNumber}
                </div>
                <p className="mt-3 break-words text-[10px] font-medium leading-4 text-gray-600 sm:text-[11px] sm:leading-5">{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}