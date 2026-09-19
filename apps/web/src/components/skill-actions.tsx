"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SkillRecord } from "@contextninja/session";
import { Button } from "@/components/ui/button";

const GROK_URL = "https://grok.com";

export function SkillActions({ skill }: { skill: SkillRecord }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState(skill.published);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function addToGrok() {
    setError("");
    try {
      await navigator.clipboard.writeText(skill.grokSkill);
      setCopied(true);
      window.open(GROK_URL, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not copy the skill. Use Download and upload it in Grok.");
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

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={addToGrok} size="lg">
          {copied ? "Copied. Grok opened" : "Add to Grok"}
        </Button>
        <Button asChild variant="paper" size="lg">
          <a href={`/api/skills/${skill.id}/download`}>Download</a>
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={publish} disabled={pending || published}>
          {published ? "Published to list" : pending ? "Publishing…" : "Publish"}
        </Button>
      </div>
      <p className="text-sm text-muted">
        Add to Grok copies the computer-use skill and opens Grok. If a deep link is unavailable, download the
        markdown and attach it there. Prompt Grok to open the start URL and run the task.
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
