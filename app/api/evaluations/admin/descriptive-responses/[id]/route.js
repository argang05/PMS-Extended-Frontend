import { djangoProxy } from "@/lib/djangoProxy";

export async function GET(req, { params }) {
  const { id } = await params;
  return djangoProxy(req, `/api/evaluations/admin/descriptive-responses/${id}/`);
}