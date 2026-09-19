import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppShell>
      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-4 px-6">
        <h1 className="text-5xl">Nothing here.</h1>
        <p className="text-muted">Head back to the landing page, or open the skill manager after you hit Done.</p>
        <Button asChild>
          <a href="/">Back home</a>
        </Button>
      </main>
    </AppShell>
  );
}
