import { NextResponse } from "next/server";
import { getSession, saveSkillFromSession, updateSessionWorkflow } from "@/lib/store";
import type { WorkflowStep } from "@contextninja/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "No workflow with that id." }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let patch: { title?: string; steps?: WorkflowStep[] };
  try {
    patch = (await request.json()) as { title?: string; steps?: WorkflowStep[] };
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const session = await updateSessionWorkflow(id, patch);
  if (!session) {
    return NextResponse.json({ error: "No workflow with that id." }, { status: 404 });
  }
  return NextResponse.json(session);
}

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "No workflow with that id." }, { status: 404 });
  }

  let patch: { title?: string; steps?: WorkflowStep[] } = {};
  try {
    patch = (await request.json()) as { title?: string; steps?: WorkflowStep[] };
  } catch {
    patch = {};
  }

  const next = await updateSessionWorkflow(id, {
    title: patch.title ?? session.title,
    steps: patch.steps ?? session.steps,
  });
  if (!next) {
    return NextResponse.json({ error: "Could not save workflow." }, { status: 500 });
  }

  const skill = await saveSkillFromSession(next);
  const origin = new URL(request.url).origin;
  return NextResponse.json({
    skillId: skill.id,
    skillUrl: `${origin}/skills/${skill.id}`,
  });
}
