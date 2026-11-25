import { djangoProxy } from "@/lib/djangoProxy";

export async function POST(req, { params }) {
  const { id } = await params;
  return djangoProxy(req, `/api/evaluations/peer/assignments/${id}/add/`, "POST");
}