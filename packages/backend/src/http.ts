import {
  getSession,
  getSkill,
  listSkills,
  publishSkill,
  saveSession,
  saveSkillFromSession,
  updateSessionWorkflow,
} from "./store";
import { SAMPLE_SESSION } from "./sample-session";
import type { SessionPayload, WorkflowStep } from "./index";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type IdCtx = { params: Promise<{ id: string }> };

function json(data: unknown, init?: { status?: number; headers?: HeadersInit }) {
  return Response.json(data, {
    status: init?.status ?? 200,
    headers: { ...CORS, ...(init?.headers ?? {}) },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function sessionsGET() {
  return json({
    hint: "POST a ContextNinja session payload. Empty steps are filled with deriveSteps(events).",
    sampleId: SAMPLE_SESSION.id,
  });
}

export async function sessionsPOST(request: Request) {
  let body: SessionPayload;
  try {
    body = (await request.json()) as SessionPayload;
  } catch {
    return json({ error: "Session JSON was missing or invalid." }, { status: 400 });
  }

  if (!body?.id || !Array.isArray(body.events)) {
    return json({ error: "A session needs an id and an events array." }, { status: 400 });
  }

  const session = await saveSession(body);
  const origin = new URL(request.url).origin;
  return json({
    id: session.id,
    workflowUrl: `${origin}/workflows/${session.id}`,
  });
}

export async function samplePOST(request: Request) {
  const session = await saveSession({
    ...SAMPLE_SESSION,
    id: `session-sample-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  });
  const origin = new URL(request.url).origin;
  return json({
    id: session.id,
    workflowUrl: `${origin}/workflows/${session.id}`,
  });
}

export async function sessionByIdGET(_request: Request, ctx: IdCtx) {
  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) {
    return json({ error: "No workflow with that id." }, { status: 404 });
  }
  return json(session);
}

export async function sessionByIdPATCH(request: Request, ctx: IdCtx) {
  const { id } = await ctx.params;
  let patch: { title?: string; steps?: WorkflowStep[] };
  try {
    patch = (await request.json()) as { title?: string; steps?: WorkflowStep[] };
  } catch {
    return json({ error: "Expected JSON." }, { status: 400 });
  }

  const session = await updateSessionWorkflow(id, patch);
  if (!session) {
    return json({ error: "No workflow with that id." }, { status: 404 });
  }
  return json(session);
}

export async function sessionByIdPOST(request: Request, ctx: IdCtx) {
  const { id } = await ctx.params;
  const session = await getSession(id);
  if (!session) {
    return json({ error: "No workflow with that id." }, { status: 404 });
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
    return json({ error: "Could not save workflow." }, { status: 500 });
  }

  const skill = await saveSkillFromSession(next);
  const origin = new URL(request.url).origin;
  return json({
    skillId: skill.id,
    skillUrl: `${origin}/skills/${skill.id}`,
  });
}

export async function skillsGET() {
  const skills = await listSkills();
  return json({ skills });
}

export async function skillByIdGET(_request: Request, ctx: IdCtx) {
  const { id } = await ctx.params;
  const skill = await getSkill(id);
  if (!skill) {
    return json({ error: "No skill with that id." }, { status: 404 });
  }
  return json(skill);
}

export async function skillByIdPOST(_request: Request, ctx: IdCtx) {
  const { id } = await ctx.params;
  const skill = await publishSkill(id);
  if (!skill) {
    return json({ error: "No skill with that id." }, { status: 404 });
  }
  return json(skill);
}

export async function skillDownloadGET(_request: Request, ctx: IdCtx) {
  const { id } = await ctx.params;
  const skill = await getSkill(id);
  if (!skill) {
    return json({ error: "No skill with that id." }, { status: 404 });
  }

  const filename = `${skill.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "skill"}.md`;
  return new Response(skill.grokSkill, {
    headers: {
      ...CORS,
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
