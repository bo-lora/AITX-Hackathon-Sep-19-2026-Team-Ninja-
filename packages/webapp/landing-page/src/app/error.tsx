"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-5xl">That page did not load.</h1>
      <p className="text-muted">{error.message || "Try again from the homepage."}</p>
      <div className="flex gap-3">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="paper">
          <a href="/">Back home</a>
        </Button>
      </div>
    </main>
  );
}
