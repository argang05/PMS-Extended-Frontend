import { NextResponse } from "next/server";

export async function djangoProxy(req, path, method = "GET") {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) return NextResponse.json({ error: "Backend API URL is not configured." }, { status: 500 });

    const authorization = req.headers.get("authorization");
    if (!authorization) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const headers = { Authorization: authorization };
    const options = { method, headers, cache: "no-store" };

    if (!["GET", "HEAD"].includes(method)) {
      const body = await req.text();
      if (body.trim()) {
        headers["Content-Type"] = req.headers.get("content-type") || "application/json";
        options.body = body;
      }
    }

    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, options);
    const raw = await response.text();

    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: raw || "Unexpected backend response." };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({
      error: "Backend request failed.",
      details: error.message
    }, { status: 502 });
  }
}