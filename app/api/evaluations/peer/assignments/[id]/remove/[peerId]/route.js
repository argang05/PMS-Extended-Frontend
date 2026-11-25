import { djangoProxy } from "@/lib/djangoProxy";

export async function DELETE(req, { params }) {
  const { id, peerId } = await params;
  return djangoProxy(
    req,
    `/api/evaluations/peer/assignments/${id}/remove/${peerId}/`,
    "DELETE"
  );
}