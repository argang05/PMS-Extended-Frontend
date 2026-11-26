import { NextResponse } from "next/server";
import { djangoProxy } from "@/lib/djangoProxy";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(String(id))) {
    return NextResponse.json({ error: "Invalid questionnaire ID." }, { status: 400 });
  }
  return djangoProxy(request, `/api/scoring/readiness/${id}/`, "GET");
}