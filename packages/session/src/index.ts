export type DomEventType =
  | "click"
  | "input"
  | "change"
  | "submit"
  | "navigate"
  | "keydown"
  | "focus";

export interface RecordedEvent {
  id: string;
  ts: number;
  type: DomEventType;
  url: string;
  selector: string;
  tagName?: string;
  text?: string;
  value?: string;
  href?: string;
  title?: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  action: string;
  selector: string;
  url: string;
  eventIds: string[];
  notes?: string;
}

export interface SessionPayload {
  id: string;
  createdAt: string;
  title: string;
  startUrl: string;
  events: RecordedEvent[];
  steps: WorkflowStep[];
}

export interface SkillRecord {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  published: boolean;
  grokSkill: string;
  workflow: WorkflowStep[];
  events: RecordedEvent[];
}

export function deriveSteps(events: RecordedEvent[]): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  let index = 1;

  for (const event of events) {
    if (event.type === "focus") continue;

    const title = titleForEvent(event, index);
    const previous = steps[steps.length - 1];
    if (
      previous &&
      event.type === "input" &&
      previous.selector === event.selector &&
      previous.url === event.url
    ) {
      previous.title = title;
      previous.action = actionForEvent(event);
      previous.eventIds.push(event.id);
      continue;
    }

    steps.push({
      id: `step-${index}`,
      title,
      action: actionForEvent(event),
      selector: event.selector,
      url: event.url,
      eventIds: [event.id],
    });
    index += 1;
  }

  return steps;
}

function titleForEvent(event: RecordedEvent, index: number): string {
  const label = event.text?.trim() || event.selector;
  switch (event.type) {
    case "navigate":
      return `${index}. Open ${event.href || event.url}`;
    case "click":
      return `${index}. Click ${label}`;
    case "input":
    case "change":
      return `${index}. Enter ${summarizeValue(event.value)} in ${label}`;
    case "submit":
      return `${index}. Submit ${label}`;
    case "keydown":
      return `${index}. Press ${event.value || "key"} on ${label}`;
    default:
      return `${index}. ${event.type} ${label}`;
  }
}

function actionForEvent(event: RecordedEvent): string {
  switch (event.type) {
    case "navigate":
      return "navigate";
    case "click":
      return "click";
    case "input":
    case "change":
      return "fill";
    case "submit":
      return "submit";
    case "keydown":
      return "key";
    default:
      return event.type;
  }
}

function summarizeValue(value?: string): string {
  if (!value) return "a value";
  if (value.length > 40) return `"${value.slice(0, 37)}..."`;
  return `"${value}"`;
}

export function buildGrokSkill(skill: {
  title: string;
  description: string;
  workflow: WorkflowStep[];
  startUrl?: string;
}): string {
  const start =
    skill.startUrl || skill.workflow[0]?.url || "(start URL from the recording)";
  const steps = skill.workflow
    .map((step, i) => {
      const selector = step.selector ? ` Selector: \`${step.selector}\`.` : "";
      const notes = step.notes ? ` ${step.notes}` : "";
      return `${i + 1}. ${step.title.replace(/^\d+\.\s*/, "")} (${step.action} on ${step.url}).${selector}${notes}`;
    })
    .join("\n");

  return `# ${skill.title}

${skill.description || "Replay this taught browser task with computer use."}

## How to run

You are using computer use. Open the site and complete the workflow exactly as recorded. Prefer visible labels, then CSS selectors. Do not skip login or 2FA if the site asks.

## Start URL

${start}

## Steps

${steps || "No steps recorded."}

## Done when

The same end state the operator reached when they clicked Done in ContextNinja.
`;
}
