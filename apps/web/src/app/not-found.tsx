import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="text-5xl">That skill is not in the log.</h1>
        <p className="text-muted">
          Record a new session in Chrome, or open a sample workflow from the homepage.
        </p>
        <Button asChild>
          <a href="/">Back to trained skills</a>
        </Button>
      </main>
    </AppShell>
  );
}
