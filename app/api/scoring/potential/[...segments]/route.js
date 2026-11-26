import { NextResponse } from "next/server";
import { djangoProxy } from "@/lib/djangoProxy";

const ROUTES = [
  [/^question-bank\/categories$/, ["GET", "POST"]],
  [/^question-bank\/categories\/\d+$/, ["GET", "PUT", "PATCH", "DELETE"]],
  [/^question-bank\/questions$/, ["GET", "POST"]],
  [/^question-bank\/questions\/\d+$/, ["GET", "PUT", "PATCH", "DELETE"]],
  [/^question-bank\/questions\/(bulk-create|bulk-configure|bulk-delete)$/, ["POST"]],
  [/^question-bank\/questions\/\d+\/targeting-preview$/, ["GET"]],
  [/^question-bank\/targeting\/options$/, ["GET"]],
  [/^question-bank\/targeting\/preview$/, ["POST"]],
  [/^question-bank\/stats$/, ["GET"]],
  [/^questionnaires$/, ["GET", "POST"]],
  [/^questionnaires\/options$/, ["GET"]],
  [/^questionnaires\/\d+$/, ["GET"]],
  [/^questionnaires\/\d+\/available-questions$/, ["GET"]],
  [/^questionnaires\/\d+\/save$/, ["PUT"]],
  [/^questionnaires\/\d+\/(sync|reset|copy|publish)$/, ["POST"]],
  [/^evaluations$/, ["GET"]],
  [/^evaluations\/\d+$/, ["GET"]],
  [/^evaluations\/\d+\/(prepare|submit)$/, ["POST"]],
  [/^descriptive\/\d+\/preference$/, ["GET", "PUT"]],
  [/^descriptive\/\d+\/(workspace|readiness|history)$/, ["GET"]],
  [/^descriptive\/\d+\/(score|bulk-save|clear-scores)$/, ["POST"]]
];

async function handler(request, context) {
  const params = await context.params;
  const segments = params?.segments;
  if (!Array.isArray(segments) || !segments.length) return NextResponse.json({ error: "Invalid Potential API path." }, { status: 404 });
  const path = segments.join("/");
  const route = ROUTES.find(([pattern]) => pattern.test(path));
  if (!route) return NextResponse.json({ error: "Potential API endpoint not found." }, { status: 404 });
  if (!route[1].includes(request.method)) {
    return NextResponse.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: route[1].join(", ") } });
  }
  return djangoProxy(request, `/api/scoring/potential/${path}/${request.nextUrl.search}`, request.method);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;