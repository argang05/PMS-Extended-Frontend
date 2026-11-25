import { djangoProxy } from "@/lib/djangoProxy";

export async function PUT(req, { params }) {
  const { id, itemId } = await params;

  return djangoProxy(
    req,
    `/api/admin/questionnaires/${id}/items/${itemId}/weightage/`,
    "PUT"
  );
}