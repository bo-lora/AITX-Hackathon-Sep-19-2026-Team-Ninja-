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
  inputs?: SkillInput[];
}

export interface SkillInput {
  name: string;
  label: string;
  required: boolean;
  description: string;
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
  inputs: SkillInput[];
  startUrl?: string;
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

export function deriveInputs(session: {
  startUrl?: string;
  title?: string;
  steps?: WorkflowStep[];
  inputs?: SkillInput[];
}): SkillInput[] {
  if (session.inputs?.length) return session.inputs;
  const haystack = [session.startUrl, session.title, ...(session.steps ?? []).map((step) => step.url)].join(" ");
  if (/openemr|referral|patient|inbox/i.test(haystack)) {
    return [
      {
        name: "referral_pdf",
        label: "Referral PDF from email",
        required: true,
        description:
          "The attachment that landed in Mary's inbox. Read fields from this document. Do not invent demographics. Demo engine uses the prepared HACKDEMO faxes.",
      },
      {
        name: "ehr_login",
        label: "EHR session",
        required: true,
        description:
          "She must already be logged in, or the headed browser will show the login for her to type. Do not store her password in the skill.",
      },
      {
        name: "patient_name",
        label: "Patient name",
        required: false,
        description:
          "Override if the operator names someone (e.g. Brian Jones). If missing, take the name from the PDF.",
      },
    ];
  }

  return [
    {
      name: "goal",
      label: "What to do this time",
      required: true,
      description:
        "The variable for this run (who, which record, what changed). Ask if missing. Do not reuse the recorded example values silently.",
    },
    {
      name: "documents",
      label: "Documents",
      required: false,
      description: "PDFs or forms for this run.",
    },
    {
      name: "api_spec",
      label: "API spec",
      required: false,
      description: "Optional OpenAPI or endpoint notes.",
    },
  ];
}

function renderInputs(inputs: SkillInput[]): string {
  if (!inputs.length) {
    return "None declared. If a value was only an example in the recording, ask before reusing it.";
  }
  const required = inputs.filter((input) => input.required);
  const optional = inputs.filter((input) => !input.required);
  const block = (items: SkillInput[]) =>
    items
      .map((input) => `- **${input.label}** (\`${input.name}\`): ${input.description}`)
      .join("\n");
  return [
    required.length ? `Required:\n${block(required)}` : "Required: none.",
    optional.length ? `Optional:\n${block(optional)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function renderSteps(workflow: WorkflowStep[]): string {
  return workflow
    .map((step, i) => {
      const selector = step.selector ? ` Selector: \`${step.selector}\`.` : "";
      const notes = step.notes ? ` ${step.notes}` : "";
      return `${i + 1}. ${step.title.replace(/^\d+\.\s*/, "")} (${step.action} on ${step.url}).${selector}${notes}`;
    })
    .join("\n");
}

export function skillSlug(title: string): string {
  return title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "skill";
}

export function buildGrokSkill(skill: {
  title: string;
  description: string;
  workflow: WorkflowStep[];
  startUrl?: string;
  inputs?: SkillInput[];
}): string {
  const start =
    skill.startUrl || skill.workflow[0]?.url || "(start URL from the recording)";
  const inputs = skill.inputs?.length ? skill.inputs : deriveInputs(skill);

  return `# ${skill.title}

${skill.description || "Replay this taught browser task with computer use."}

## Inputs

${renderInputs(inputs)}

If the operator names a different person or document (example: "reschedule Brian Jones") and a required input is missing, **ask**. Do not guess insurance numbers, DOB, or PDFs. Recorded values are examples from teach, not defaults to silently reuse.

## How to run

Prefer the headed site the operator already logged into. If you are using computer use, open the start URL and complete the workflow. Prefer visible labels, then CSS selectors. Do not skip login or 2FA if the site asks. The human can take over the headed browser at any point.

## Start URL

${start}

## Steps

${renderSteps(skill.workflow) || "No steps recorded."}

## Done when

The same end state the operator reached when they clicked Done in ContextNinja, for **this** run's inputs.
`;
}

export function buildCursorSkill(skill: {
  title: string;
  description: string;
  workflow: WorkflowStep[];
  startUrl?: string;
  inputs?: SkillInput[];
}): string {
  const grok = buildGrokSkill(skill);
  const slug = skillSlug(skill.title);
  return `---
name: ${slug}
description: ${skill.description || skill.title}. Ask for required inputs before running. Do not guess from the teach example.
---

${grok}
`;
}

export function buildInstallReadme(title: string): string {
  const slug = skillSlug(title);
  return `# ${title}

Download this folder and give it to the AI you already use. ContextNinja does not need to stay open.

## Grok
Attach \`grok.md\` (or paste it). Then say the next job, e.g. "intake the next referral fax" or "reschedule Brian Jones". The skill will ask if a required input is missing.

## Cursor
Copy this folder to \`.cursor/skills/${slug}/\` so \`SKILL.md\` sits in that folder. Restart Cursor skills if needed.

## ChatGPT
Upload \`SKILL.md\` or paste it into the thread.

No API keys are in this pack. Login stays with the human on a headed browser.
`;
}
