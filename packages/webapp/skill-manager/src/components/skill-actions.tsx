"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SkillRecord } from "@contextninja/backend";
import { Button } from "@/components/ui/button";

const GROK_URL = "https://grok.com";
const REVIEW_URL = "http://127.0.0.1:4710/review/latest";

function loggedIn(engine: unknown): boolean {
  const raw = typeof engine === "string" ? engine : JSON.stringify(engine ?? "");
  return raw.includes("LOGGED_IN") && !raw.includes("LOGGED_OUT");
}

export function SkillActions({ skill }: { skill: SkillRecord }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState(skill.published);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [running, setRunning] = useState(false);

  async function addToGrok() {
    setError("");
    try {
      await navigator.clipboard.writeText(skill.grokSkill);
      setCopied(true);
      window.open(GROK_URL, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not copy the skill. Use Download skill folder and upload it in Grok.");
    }
  }

  async function publish() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/skills/${skill.id}`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Publish failed.");
      }
      setPublished(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPending(false);
    }
  }

  async function ensureEngine() {
    const healthRes = await fetch("/api/engine/health");
    const health = (await healthRes.json()) as { ok?: boolean; error?: string };
    if (!healthRes.ok || health.ok === false) {
      throw new Error(
        health.error || "Intake engine is down. From the repo root: npm start --prefix packages/engine",
      );
    }
  }

  async function loginIfNeeded() {
    const statusRes = await fetch("/api/engine/status");
    const status = (await statusRes.json()) as {
      ok?: boolean;
      error?: string;
      engine?: unknown;
    };
    if (!statusRes.ok && statusRes.status !== 401) {
      throw new Error(status.error || "Could not read engine login status.");
    }
    if (loggedIn(status.engine) || loggedIn(status)) return;
    setNote("Login window should open. Type the EHR password there — it is never stored in the skill.");
    const loginRes = await fetch("/api/engine/login", { method: "POST" });
    const login = (await loginRes.json()) as { ok?: boolean; error?: string; body?: string };
    if (!loginRes.ok || login.ok === false) {
      throw new Error(login.error || login.body || "Login did not complete.");
    }
  }

  async function postIntake() {
    const intakeRes = await fetch("/api/engine/intake", { method: "POST" });
    const intake = (await intakeRes.json()) as {
      ok?: boolean;
      error?: string;
      reviewUrl?: string;
    };
    return { intakeRes, intake };
  }

  async function runInOpenEmr() {
    setRunning(true);
    setError("");
    setNote("Checking the intake engine…");
    try {
      await ensureEngine();
      await loginIfNeeded();
      setNote("Running one referral on the stage EHR copy (headed browser)…");
      let { intakeRes, intake } = await postIntake();
      if (intakeRes.status === 401) {
        await loginIfNeeded();
        setNote("Running one referral on the stage EHR copy (headed browser)…");
        ({ intakeRes, intake } = await postIntake());
      }
      if (!intakeRes.ok || intake.ok === false) {
        throw new Error(intake.error || "Intake did not finish.");
      }
      setNote("Intake finished. Open review to compare the fax to what was saved.");
      window.open(intake.reviewUrl || REVIEW_URL, "_blank", "noopener,noreferrer");
    } catch (err) {
      setNote("");
      setError(err instanceof Error ? err.message : "Could not run intake.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={runInOpenEmr} size="lg" disabled={running}>
          {running ? "Running in the EHR…" : "Run in OpenEMR"}
        </Button>
        <Button type="button" onClick={addToGrok} size="lg" variant="paper">
          {copied ? "Copied. Grok opened" : "Add to Grok"}
        </Button>
        <Button asChild variant="paper" size="lg">
          <a href={`/api/skills/${skill.id}/download`}>Download skill folder</a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={REVIEW_URL} target="_blank" rel="noreferrer">
            Open review
          </a>
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={publish} disabled={pending || published}>
          {published ? "Published to list" : pending ? "Publishing…" : "Publish"}
        </Button>
      </div>
      <p className="text-sm text-muted">
        Run is the scored close: headed OpenEMR, next referral PDF, four screens, re-read to prove
        it saved. Download skill folder is what she takes to Grok or Cursor. No password in the
        extension or the skill.
      </p>
      {note ? <p className="text-sm text-navy">{note}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
