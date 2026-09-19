"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WatchDemoButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function loadSample() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/sessions/sample", { method: "POST" });
      const payload = (await response.json()) as { workflowUrl?: string; error?: string };
      if (!response.ok || !payload.workflowUrl) {
        throw new Error(payload.error || "Could not open the referral skill.");
      }
      router.push(payload.workflowUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the referral skill.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={loadSample}
        disabled={pending}
        className={`inline-flex items-center justify-center rounded-full bg-[#111] font-semibold text-white transition-colors hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:opacity-40 ${
          compact ? "h-11 px-5 text-sm" : "h-14 px-6 text-[15px]"
        }`}
      >
        {pending ? "Opening skill…" : compact ? "Referral skill" : "Open the referral skill"}
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
