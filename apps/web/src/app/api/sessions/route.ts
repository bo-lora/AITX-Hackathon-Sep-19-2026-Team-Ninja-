import { NextResponse } from "next/server";
import { saveSession } from "@/lib/store";
import { SAMPLE_SESSION } from "@/lib/sample-session";
import type { SessionPayload } from "@contextninja/session";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  let body: SessionPayload;
  try {
    body = (await request.json()) as SessionPayload;
  } catch {
    return NextResponse.json(
      { error: "Session JSON was missing or invalid." },
      { status: 400, headers: CORS },
    );
  }

  if (!body?.id || !Array.isArray(body.events)) {
    return NextResponse.json(
      { error: "A session needs an id and an events array." },
      { status: 400, headers: CORS },
    );
  }

  const session = await saveSession(body);
  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      id: session.id,
      workflowUrl: `${origin}/workflows/${session.id}`,
    },
    { headers: CORS },
  );
}

export async function GET() {
  return NextResponse.json({
    hint: "POST a ContextNinja session payload. Use ?sample=1 on /workflows/new via the homepage sample action.",
    sampleId: SAMPLE_SESSION.id,
  });
}
