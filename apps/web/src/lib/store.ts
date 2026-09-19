import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildGrokSkill,
  deriveSteps,
  type SessionPayload,
  type SkillRecord,
  type WorkflowStep,
} from "@contextninja/session";

const DATA_DIR = path.join(process.cwd(), ".data");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const SKILLS_DIR = path.join(DATA_DIR, "skills");

async function ensureDirs() {
  await mkdir(SESSIONS_DIR, { recursive: true });
  await mkdir(SKILLS_DIR, { recursive: true });
}

function sessionPath(id: string) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

function skillPath(id: string) {
  return path.join(SKILLS_DIR, `${id}.json`);
}

export async function saveSession(input: SessionPayload): Promise<SessionPayload> {
  await ensureDirs();
  const events = input.events ?? [];
  const session: SessionPayload = {
    ...input,
    events,
    steps: input.steps?.length ? input.steps : deriveSteps(events),
    title: input.title || "Untitled workflow",
    createdAt: input.createdAt || new Date().toISOString(),
  };
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
  return session;
}

export async function getSession(id: string): Promise<SessionPayload | null> {
  try {
    const raw = await readFile(sessionPath(id), "utf8");
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export async function updateSessionWorkflow(
  id: string,
  patch: { title?: string; steps?: WorkflowStep[] },
): Promise<SessionPayload | null> {
  const session = await getSession(id);
  if (!session) return null;
  const next: SessionPayload = {
    ...session,
    title: patch.title ?? session.title,
    steps: patch.steps ?? session.steps,
  };
  await writeFile(sessionPath(id), JSON.stringify(next, null, 2));
  return next;
}

export async function saveSkillFromSession(session: SessionPayload): Promise<SkillRecord> {
  await ensureDirs();
  const existing = await findSkillBySession(session.id);
  const now = new Date().toISOString();
  const skill: SkillRecord = {
    id: existing?.id ?? `skill-${session.id.replace(/^session-/, "")}`,
    sessionId: session.id,
    title: session.title,
    description: `Taught in Chrome. ${session.steps.length} step${session.steps.length === 1 ? "" : "s"} from ${session.startUrl}.`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    published: existing?.published ?? false,
    workflow: session.steps,
    events: session.events,
    grokSkill: "",
  };
  skill.grokSkill = buildGrokSkill({
    title: skill.title,
    description: skill.description,
    workflow: skill.workflow,
    startUrl: session.startUrl,
  });
  await writeFile(skillPath(skill.id), JSON.stringify(skill, null, 2));
  return skill;
}

export async function getSkill(id: string): Promise<SkillRecord | null> {
  try {
    const raw = await readFile(skillPath(id), "utf8");
    return JSON.parse(raw) as SkillRecord;
  } catch {
    return null;
  }
}

export async function listSkills(): Promise<SkillRecord[]> {
  await ensureDirs();
  const files = await readdir(SKILLS_DIR);
  const skills = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const raw = await readFile(path.join(SKILLS_DIR, file), "utf8");
        return JSON.parse(raw) as SkillRecord;
      }),
  );
  return skills.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function publishSkill(id: string): Promise<SkillRecord | null> {
  const skill = await getSkill(id);
  if (!skill) return null;
  const next = { ...skill, published: true, updatedAt: new Date().toISOString() };
  await writeFile(skillPath(id), JSON.stringify(next, null, 2));
  return next;
}

async function findSkillBySession(sessionId: string): Promise<SkillRecord | null> {
  const skills = await listSkills();
  return skills.find((skill) => skill.sessionId === sessionId) ?? null;
}
