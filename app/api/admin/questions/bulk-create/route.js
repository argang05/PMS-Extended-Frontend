import { djangoProxy } from "@/lib/djangoProxy";

export async function POST(req) {
  return djangoProxy(req, "/api/admin/questions/bulk-create/", "POST");
}