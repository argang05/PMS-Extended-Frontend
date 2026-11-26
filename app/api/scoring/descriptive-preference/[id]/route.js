import { djangoProxy } from "@/lib/djangoProxy";

export async function GET(req, context) {
  const { id } = await context.params;
  return djangoProxy(req, `/api/scoring/descriptive-preference/${id}/`, "GET");
}

export async function PUT(req, context) {
  const { id } = await context.params;
  return djangoProxy(req, `/api/scoring/descriptive-preference/${id}/`, "PUT");
}