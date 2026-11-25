import { djangoProxy } from "@/lib/djangoProxy";

export async function GET(req) {
  const query = new URL(req.url).searchParams.toString();
  return djangoProxy(req, `/api/admin/questions/targeting-options/${query ? `?${query}` : ""}`, "GET");
}