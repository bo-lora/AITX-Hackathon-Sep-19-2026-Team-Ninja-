import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { SkillActions } from "@/components/skill-actions";
import { getSkill } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = await getSkill(id);
  if (!skill) notFound();

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Badge tone={skill.published ? "ink" : "paper"}>
              {skill.published ? "On the skill list" : "Saved"}
            </Badge>
            <h1 className="text-5xl sm:text-6xl">{skill.title}</h1>
            <p className="max-w-2xl text-muted">{skill.description}</p>
          </div>
          <Link href={`/workflows/${skill.sessionId}`} className="text-sm font-bold text-navy underline-offset-4 hover:underline">
            Back to workflow
          </Link>
        </div>

        <SkillActions skill={skill} />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ol className="space-y-3">
            {skill.workflow.map((step, index) => (
              <li key={step.id} className="paper-sheet p-4">
                <p className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</p>
                <h2 className="mt-1 text-3xl">{step.title}</h2>
                <p className="mt-2 break-all font-mono text-xs text-muted">
                  {step.action} · {step.selector || "no selector"} · {step.url}
                </p>
                {step.notes ? <p className="mt-2 text-sm">{step.notes}</p> : null}
              </li>
            ))}
          </ol>
          <pre className="overflow-auto border border-line bg-navy p-4 text-[12px] leading-5 text-paper">
            {skill.grokSkill}
          </pre>
        </section>
      </main>
    </AppShell>
  );
}
