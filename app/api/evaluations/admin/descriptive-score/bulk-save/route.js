import { djangoProxy } from "@/lib/djangoProxy";

export async function POST(req) {
  return djangoProxy(req, "/api/evaluations/admin/descriptive-score/bulk-save/", "POST");
}