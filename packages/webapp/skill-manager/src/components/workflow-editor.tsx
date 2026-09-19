"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecordedEvent, SessionPayload, WorkflowStep } from "@contextninja/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

function emptyStep(index: number): WorkflowStep {
  return {
    id: `step-${Date.now()}-${index}`,
    title: `${index}. New step`,
    action: "click",
    selector: "",
    url: "",
    eventIds: [],
    notes: "",
  };
}

export function WorkflowEditor({ session }: { session: SessionPayload }) {
  const router = useRouter();
  const [title, setTitle] = useState(session.title);
  const [steps, setSteps] = useState<WorkflowStep[]>(session.steps);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const eventsById = useMemo(() => {
    const map = new Map<string, RecordedEvent>();
    for (const event of session.events) map.set(event.id, event);
    return map;
  }, [session.events]);

  function updateStep(id: string, patch: Partial<WorkflowStep>) {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  async function save() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, steps }),
      });
      const payload = (await response.json()) as { skillUrl?: string; error?: string };
      if (!response.ok || !payload.skillUrl) {
        throw new Error(payload.error || "Save failed.");
      }
      router.push(payload.skillUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)] lg:px-6">
      <section className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-bold text-muted">Workflow name</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Workflow name"
          />
        </label>

        {steps.length === 0 ? (
          <p className="border border-dashed border-line px-4 py-10 text-sm text-muted">
            No steps yet. Add one, or go back and record in Chrome.
          </p>
        ) : (
          <ol className="space-y-4">
            {steps.map((step, index) => (
              <li key={step.id} className="paper-sheet p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted hover:text-danger"
                    onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3">
                  <Input
                    value={step.title}
                    onChange={(event) => updateStep(step.id, { title: event.target.value })}
                    aria-label={`Step ${index + 1} title`}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      value={step.action}
                      onChange={(event) => updateStep(step.id, { action: event.target.value })}
                      aria-label={`Step ${index + 1} action`}
                      className="font-mono"
                    />
                    <Input
                      value={step.selector}
                      onChange={(event) => updateStep(step.id, { selector: event.target.value })}
                      aria-label={`Step ${index + 1} selector`}
                      className="font-mono"
                    />
                  </div>
                  <Input
                    value={step.url}
                    onChange={(event) => updateStep(step.id, { url: event.target.value })}
                    aria-label={`Step ${index + 1} url`}
                    className="font-mono text-xs"
                  />
                  <Textarea
                    value={step.notes ?? ""}
                    onChange={(event) => updateStep(step.id, { notes: event.target.value })}
                    placeholder="Notes the agent should know (login, 2FA, waits)"
                    aria-label={`Step ${index + 1} notes`}
                    className="min-h-20"
                  />
                  {step.eventIds.length ? (
                    <p className="font-mono text-[11px] text-muted">
                      Tied to {step.eventIds.map((id) => eventsById.get(id)?.type ?? id).join(", ")}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="paper"
            onClick={() => setSteps((current) => [...current, emptyStep(current.length + 1)])}
          >
            Add step
          </Button>
          <Button type="button" onClick={save} disabled={pending || !title.trim() || steps.length === 0}>
            {pending ? "Saving skill…" : "Save"}
          </Button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <h2 className="text-4xl text-navy">Recorded events</h2>
        <p className="text-sm text-muted">
          Source of truth from the recorded Chrome session. Each step should stay tied to an event.
        </p>
        {session.events.length === 0 ? (
          <p className="border border-dashed border-line px-4 py-8 text-sm text-muted">
            No DOM events in this session yet.
          </p>
        ) : (
          <ul className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {session.events.map((event) => (
              <li key={event.id} className="border border-line bg-paper p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge tone="ink">{event.type}</Badge>
                  <time className="font-mono text-[10px] text-muted">
                    {Number.isFinite(event.ts) && event.ts > 1_000_000
                      ? new Date(event.ts).toLocaleTimeString()
                      : `#${event.ts}`}
                  </time>
                </div>
                <p className="break-all font-mono text-xs text-navy">{event.selector}</p>
                <p className="mt-1 truncate text-xs text-muted">{event.text || event.value || event.url}</p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
