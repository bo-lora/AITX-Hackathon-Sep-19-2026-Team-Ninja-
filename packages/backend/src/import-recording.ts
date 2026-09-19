import { deriveSteps, type DomEventType, type RecordedEvent, type SessionPayload, type WorkflowStep } from "./index";

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const EHR = "https://demo.openemr.io/a/openemr";

export interface RecordingImport {
  title?: string;
  startUrl?: string;
  start_url?: string;
  bullets?: string[];
  steps?: unknown[];
  events?: unknown[];
}

type Loose = Record<string, unknown>;

function asList(value: unknown): Loose[] {
  return Array.isArray(value) ? (value as Loose[]) : [];
}

function kindToType(kind: string): DomEventType {
  switch (kind) {
    case "fill":
    case "type":
    case "upload":
      return "input";
    case "select":
    case "change":
      return "change";
    case "submit":
      return "submit";
    case "navigate":
    case "open":
      return "navigate";
    case "keydown":
    case "key":
      return "keydown";
    default:
      return "click";
  }
}

function mapEvent(raw: Loose, index: number): RecordedEvent {
  const kind = String(raw.kind || raw.type || raw.action || "click");
  const url = String(raw.frame_url || raw.url || raw.href || EHR);
  const selector = String(raw.selector || raw.field_label || "document");
  const t = typeof raw.t === "number" ? raw.t : typeof raw.ts === "number" ? (raw.ts as number) : index;
  const ts = t < 1_000_000 ? Date.now() + Math.round(t * 1000) : t;
  const value = raw.value === "[hidden]" || raw.value === "••••" ? "••••" : raw.value != null ? String(raw.value) : undefined;
  return {
    id: String(raw.id || raw.i || `evt-${index + 1}`),
    ts,
    type: kindToType(kind),
    url,
    selector,
    tagName: raw.tag ? String(raw.tag).toUpperCase() : undefined,
    text: String(raw.label || raw.text || raw.field_label || ""),
    value,
    href: raw.href ? String(raw.href) : undefined,
    title: raw.frame_title ? String(raw.frame_title) : undefined,
  };
}

function mapOurStep(raw: Loose, index: number, startUrl: string): WorkflowStep {
  const title = String(raw.title || raw.field_label || raw.screen || `Step ${index + 1}`);
  return {
    id: `step-${index + 1}`,
    title: /^\d/.test(title) ? title : `${index + 1}. ${title}`,
    action: String(raw.action || "click"),
    selector: String(raw.selector || raw.field_label || ""),
    url: String(raw.url || startUrl),
    eventIds: Array.isArray(raw.eventIds) ? raw.eventIds.map(String) : [],
    notes: raw.notes ? String(raw.notes) : raw.value ? String(raw.value) : undefined,
  };
}

function collapseAutopilotScreens(rows: Loose[], startUrl: string): WorkflowStep[] {
  const groups: Array<{ screen: string; lines: string[]; action: string }> = [];
  for (const row of rows) {
    const screen = String(row.screen || "Step");
    const label = String(row.field_label || row.action || "");
    const value = row.value ? String(row.value) : "";
    const action = String(row.action || "click");
    const line = [label, value && value.startsWith("http") ? "" : value].filter(Boolean).join(" = ");
    const last = groups[groups.length - 1];
    if (last && last.screen === screen) {
      if (line) last.lines.push(line);
      last.action = action;
    } else {
      groups.push({ screen, lines: line ? [line] : [], action });
    }
  }
  return groups.map((group, index) => ({
    id: `step-${index + 1}`,
    title: `${index + 1}. ${group.screen}`,
    action: group.action === "type" || group.action === "fill" || group.action === "select" ? "fill" : "click",
    selector: group.screen,
    url: startUrl,
    eventIds: [],
    notes: group.lines.join(" · ") || undefined,
  }));
}

function looksLikeAutopilotScreenSteps(steps: Loose[]): boolean {
  return steps.some((step) => "screen" in step || "field_label" in step);
}

export function sessionFromRecording(input: RecordingImport | Loose): SessionPayload {
  const raw = input as Loose;
  const startUrl = String(
    raw.startUrl || raw.start_url || asList(raw.events)[0]?.frame_url || asList(raw.events)[0]?.url || EHR,
  );
  const rawEvents = asList(raw.events);
  const rawSteps = asList(raw.steps);
  const bullets = Array.isArray(raw.bullets) ? raw.bullets.map(String) : [];

  const events: RecordedEvent[] = rawEvents.length
    ? rawEvents.map((event, index) => mapEvent(event, index))
    : [
        {
          id: uid("evt"),
          ts: Date.now(),
          type: "navigate",
          url: startUrl,
          selector: "document",
          href: startUrl,
          title: String(raw.title || "Imported recording"),
        },
      ];

  let steps: WorkflowStep[] = [];
  if (rawSteps.length && looksLikeAutopilotScreenSteps(rawSteps)) {
    steps = collapseAutopilotScreens(rawSteps, startUrl);
  } else if (rawSteps.length) {
    steps = rawSteps.map((step, index) => mapOurStep(step, index, startUrl));
  } else if (bullets.length) {
    steps = bullets.map((title, index) => ({
      id: `step-${index + 1}`,
      title: `${index + 1}. ${title.replace(/^\d+\.\s*/, "")}`,
      action: "click",
      selector: "",
      url: startUrl,
      eventIds: [],
    }));
  } else {
    steps = deriveSteps(events);
  }

  const inbox = {
    id: "step-inbox",
    title: "1. Referral PDF arrives in email",
    action: "navigate" as const,
    selector: "inbox",
    url: "https://mail.example/inbox",
    eventIds: [] as string[],
    notes: "Source document lives in Mary's browser inbox. The engine run uses packages/engine/referrals/*.pdf.",
  };
  const alreadyHasInbox = steps.some((step) => /email|inbox/i.test(step.title));
  const numbered = (alreadyHasInbox ? steps : [inbox, ...steps]).map((step, index) => ({
    ...step,
    id: step.id || `step-${index + 1}`,
    title: step.title.replace(/^\d+\.\s*/, `${index + 1}. `),
  }));

  return {
    id: uid("session"),
    createdAt: new Date().toISOString(),
    title: String(raw.title || "Referral PDF in email → four EHR screens"),
    startUrl,
    events,
    steps: numbered,
  };
}

export function canImportRecording(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const raw = input as Loose;
  return Boolean(
    asList(raw.events).length || asList(raw.steps).length || (Array.isArray(raw.bullets) && raw.bullets.length),
  );
}
