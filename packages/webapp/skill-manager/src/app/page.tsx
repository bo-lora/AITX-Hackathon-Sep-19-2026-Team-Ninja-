import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { WatchDemoButton } from "@/components/watch-demo-button";
import { listSkills } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SkillsHomePage() {
  const skills = await listSkills();

  return (
    <AppShell>
      <main>
        <section className="border-b border-line py-12">
          <h1 className="text-5xl sm:text-6xl">Trained skills</h1>
          <p className="mt-3 max-w-[46ch] text-lg text-muted">
            Edit a workflow, save it, download the skill folder, or run it here. The referral skill is the demo — no Chrome install.
          </p>
          <div className="mt-6">
            <WatchDemoButton />
          </div>
        </section>

        <section id="skills" className="py-12">
          {skills.length === 0 ? (
            <p className="text-muted">
              None yet. Open the referral skill, or teach a new flow in Chrome if you have one.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {skills.map((skill) => (
                <li key={skill.id}>
                  <Link
                    href={`/skills/${skill.id}`}
                    className="paper-sheet block p-5 transition-transform hover:-translate-y-0.5"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Badge tone={skill.published ? "ink" : "paper"}>
                        {skill.published ? "Published" : "Private"}
                      </Badge>
                      <time className="font-mono text-[11px] text-muted">
                        {new Date(skill.updatedAt).toLocaleString()}
                      </time>
                    </div>
                    <h2 className="text-3xl">{skill.title}</h2>
                    <p className="mt-2 text-sm text-muted">{skill.workflow.length} steps</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
