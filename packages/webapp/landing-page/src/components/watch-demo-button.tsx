"use client";

import { useState } from "react";

const SKILL_MANAGER =
  process.env.NEXT_PUBLIC_SKILL_MANAGER_URL || "http://127.0.0.1:43124";

export function WatchDemoButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function loadSample() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${SKILL_MANAGER}/api/sessions/sample`, {
        method: "POST",
      });
      const payload = (await response.json()) as { workflowUrl?: string; error?: string };
      if (!response.ok || !payload.workflowUrl) {
        throw new Error(
          payload.error || "Could not open the demo workflow. Is the skill manager running on :43124?",
        );
      }
      window.location.href = payload.workflowUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the demo workflow.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={loadSample}
        disabled={pending}
        className="inline-flex items-center gap-3 text-left font-semibold text-navy"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[#f0c419] text-navy">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path fill="currentColor" d="M8.5 6.8v10.4L18 12 8.5 6.8Z" />
          </svg>
        </span>
        {pending ? "Opening demo…" : "Watch demo"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
