import { NextResponse } from "next/server";
import { SAMPLE_SESSION } from "@/lib/sample-session";
import { saveSession } from "@/lib/store";

export async function POST() {
  const session = await saveSession({
    ...SAMPLE_SESSION,
    id: `session-sample-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({
    id: session.id,
    workflowUrl: `/workflows/${session.id}`,
  });
}
