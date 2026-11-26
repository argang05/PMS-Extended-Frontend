"use client";
import { useAuth } from "@/app/context/AuthContext";
import { Loader2 } from "lucide-react";
import { useDescriptiveWorkspace } from "@/hooks/useDescriptiveWorkspace";
import DescriptiveWorkspace from "@/components/admin/descriptive/DescriptiveWorkspace";

const cardClass = "rounded-[28px] bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.08)]";

export default function AdminDescriptiveScoringPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const isAdmin = String(user?.employee_number || "") === "100607";
  const controller = useDescriptiveWorkspace(accessToken, isAdmin);

  if (authLoading || !controller.initialized) {
    return (
      <div className={cardClass}>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Loader2 size={18} className="animate-spin text-[#F6490D]" />
          Loading descriptive scoring console...
        </div>
      </div>
    );
  }
  if (!isAdmin) return <div className={cardClass}><p className="text-sm text-red-600">You are not authorized to access this page.</p></div>;
  return <DescriptiveWorkspace controller={controller} />;
}