import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WorkflowEditor } from "@/components/workflow-editor";
import { getSession } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  return (
    <AppShell live>
      <main>
        <div className="border-b border-line px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-6xl space-y-1">
            <h1 className="text-5xl sm:text-6xl">Edit the taught workflow</h1>
            <p className="text-muted">
              This landed from Done in Chrome. Change the steps, keep them tied to recorded events, then Save to
              open the skill page.
            </p>
          </div>
        </div>
        <WorkflowEditor session={session} />
      </main>
    </AppShell>
  );
}
