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
import { engineFetch, engineReviewUrl } from "./engine";
import { canImportRecording, sessionFromRecording, type RecordingImport } from "./import-recording";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { zipStore } from "./zip-store";
import {
  buildCursorSkill,
  buildGrokSkill,
  buildInstallReadme,
  deriveInputs,
  skillSlug,
  type SessionPayload,
  type WorkflowStep,
} from "./index";

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

async function loadEngineSample(): Promise<typeof SAMPLE_SESSION> {
  const candidates = [
    path.join(process.cwd(), "../../engine/from-recording/samples/SAMPLE-workflow.json"),
    path.join(process.cwd(), "packages/engine/from-recording/samples/SAMPLE-workflow.json"),
    path.join(process.cwd(), "../engine/from-recording/samples/SAMPLE-workflow.json"),
  ];
  for (const file of candidates) {
    try {
      const raw = JSON.parse(await readFile(file, "utf8")) as RecordingImport;
      if (canImportRecording(raw)) {
        return sessionFromRecording({
          ...raw,
          title: "Referral PDF in email → four EHR screens",
        });
      }
    } catch {
      // try next path
    }
  }
  return {
    ...SAMPLE_SESSION,
    id: `session-sample-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  };
}

export async function samplePOST(request: Request) {
  const session = await saveSession(await loadEngineSample());
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

export async function importRecordingPOST(request: Request) {
  let body: RecordingImport;
  try {
    body = (await request.json()) as RecordingImport;
  } catch {
    return json({ error: "Expected JSON with title, steps, or bullets." }, { status: 400 });
  }

  if (!canImportRecording(body)) {
    return json(
      { error: "Send recorder events, workflow steps, or bullets." },
      { status: 400 },
    );
  }

  const session = await saveSession(sessionFromRecording(body));
  const origin = new URL(request.url).origin;
  return json({
    id: session.id,
    workflowUrl: `${origin}/workflows/${session.id}`,
  });
}

export async function engineHealthGET() {
  try {
    const response = await engineFetch("/health", { timeoutMs: 3_000 });
    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
    return json({ ok: response.ok, engine: payload, reviewUrl: engineReviewUrl() });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Start the intake engine: npm start --prefix packages/engine",
      },
      { status: 503 },
    );
  }
}

export async function engineStatusGET() {
  try {
    const response = await engineFetch("/status?site=a", { timeoutMs: 20_000 });
    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
    return json({
      ok: response.ok,
      status: response.status,
      engine: payload,
      reviewUrl: engineReviewUrl(),
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}

export async function engineLoginPOST() {
  try {
    const response = await engineFetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: "a" }),
      timeoutMs: 320_000,
    });
    const text = await response.text();
    return json(
      { ok: response.ok, status: response.status, body: text, reviewUrl: engineReviewUrl() },
      { status: response.ok ? 200 : 502 },
    );
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}

export async function engineIntakePOST() {
  try {
    const response = await engineFetch("/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: "a", limit: 1, headed: true }),
      timeoutMs: 240_000,
    });
    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
    const reviewPath =
      payload && typeof payload === "object" && "review_url" in payload
        ? String((payload as { review_url?: string }).review_url || "")
        : "";
    const reviewUrl = reviewPath.startsWith("http")
      ? reviewPath
      : reviewPath
        ? `${new URL(response.url).origin}${reviewPath}`
        : engineReviewUrl();
    return json(
      {
        ok: response.ok,
        status: response.status,
        engine: payload,
        reviewUrl,
      },
      { status: response.ok ? 200 : response.status === 401 ? 401 : 502 },
    );
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}

export async function skillDownloadGET(_request: Request, ctx: IdCtx) {
  const { id } = await ctx.params;
  const skill = await getSkill(id);
  if (!skill) {
    return json({ error: "No skill with that id." }, { status: 404 });
  }

  const inputs =
    skill.inputs?.length
      ? skill.inputs
      : deriveInputs({
          title: skill.title,
          startUrl: skill.startUrl || skill.workflow[0]?.url,
          steps: skill.workflow,
        });
  const pack = {
    title: skill.title,
    description: skill.description,
    workflow: skill.workflow,
    startUrl: skill.startUrl || skill.workflow[0]?.url,
    inputs,
  };
  const slug = skillSlug(skill.title);
  const grok = skill.grokSkill?.includes("## Inputs")
    ? skill.grokSkill
    : buildGrokSkill(pack);
  const zip = zipStore([
    { path: `${slug}/SKILL.md`, content: buildCursorSkill(pack) },
    { path: `${slug}/grok.md`, content: grok },
    { path: `${slug}/inputs.json`, content: JSON.stringify(inputs, null, 2) },
    { path: `${slug}/workflow.json`, content: JSON.stringify(skill.workflow, null, 2) },
    { path: `${slug}/README.md`, content: buildInstallReadme(skill.title) },
  ]);

  return new Response(Buffer.from(zip), {
    headers: {
      ...CORS,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
    },
  });
}
