import { djangoProxy } from "@/lib/djangoProxy";

export async function GET(req) {
  const query = new URL(req.url).searchParams.toString();
  return djangoProxy(
    req,
    `/api/admin/questionnaires/${query ? `?${query}` : ""}`
  );
}

export async function POST(req) {
  return djangoProxy(req, "/api/admin/questionnaires/", "POST");
}
