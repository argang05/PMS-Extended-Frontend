import { djangoProxy } from "@/lib/djangoProxy";

export async function GET(req, { params }) {
  const { id } = await params;
  return djangoProxy(req, `/api/evaluations/peer/assignments/${id}/`);
}

export async function PUT(req, { params }) {
  const { id } = await params;
  return djangoProxy(req, `/api/evaluations/peer/assignments/${id}/`, "PUT");
}