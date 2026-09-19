import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WatchDemoButton } from "@/components/watch-demo-button";
import { listSkills } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const skills = await listSkills();

  return (
    <AppShell>
      <main>
        <section className="grid items-center gap-12 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 lg:py-16">
          <div className="max-w-xl space-y-6">
            <p className="text-sm font-semibold text-navy">In the Chrome you already use</p>
            <h1 className="max-w-[11ch] text-[3.4rem] leading-[0.95] sm:text-[4.6rem] lg:text-[5.4rem]">
              Teach a workflow in your real Chrome.
            </h1>
            <p className="max-w-[36ch] text-lg leading-7 text-muted">
              Record the clicks once. Confirm the steps here. Add the skill to Grok. Mary never sees Cursor, and the
              extension never holds an API key.
            </p>
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Button asChild variant="default" size="hero">
                <a href="/contextninja-extension.zip" download>
                  <ChromeMark />
                  Download Chrome Extension
                </a>
              </Button>
              <WatchDemoButton />
            </div>
            <dl className="grid max-w-lg grid-cols-3 gap-4 pt-4 text-navy">
              <Stat value={String(skills.length)} label="Skills trained" />
              <Stat value="0" label="Keys in the extension" />
              <Stat value="Grok" label="Where she runs it" />
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <span className="absolute left-[12%] top-[8%] h-3 w-3 rounded-full bg-[#7ea6ff]" />
            <span className="absolute right-[18%] top-[22%] h-2.5 w-2.5 rounded-full bg-mint" />
            <span className="absolute bottom-[18%] left-[6%] h-2.5 w-2.5 rounded-full bg-live" />
            <Sparkle className="absolute right-[8%] top-[12%] text-[#f0c419]" />
            <Sparkle className="absolute bottom-[28%] right-[4%] text-navy" />
            <div className="relative mx-auto aspect-square max-w-[28rem] overflow-hidden rounded-full bg-[#f6edd8]">
              <Image
                src="/logo.png"
                alt="ContextNinja"
                fill
                sizes="(max-width: 768px) 80vw, 28rem"
                className="object-contain p-[14%]"
                priority
              />
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-line py-14">
          <h2 className="text-4xl sm:text-5xl">How it works</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            <li className="max-w-[28ch] space-y-2">
              <p className="font-semibold">Create skill</p>
              <p className="text-muted">
                Load the extension. Do the real workflow in her logged-in Chrome, 2FA and all.
              </p>
            </li>
            <li className="max-w-[28ch] space-y-2">
              <p className="font-semibold">Done, then edit</p>
              <p className="text-muted">
                Done sends the session here. Fix the steps. Save turns it into a skill.
              </p>
            </li>
            <li className="max-w-[28ch] space-y-2">
              <p className="font-semibold">Add to Grok</p>
              <p className="text-muted">
                Copy or download the computer-use skill. Prompt Grok to open the site and run it.
              </p>
            </li>
          </ol>
        </section>

        <section id="install" className="border-t border-line py-14">
          <h2 className="text-4xl sm:text-5xl">Load it unpacked</h2>
          <p className="mt-3 max-w-[52ch] text-muted">
            There is no store listing yet. Download the zip, or point Chrome at `apps/extension` in this repo. Developer
            mode, Load unpacked. No key to paste.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="pill">
              <a href="/contextninja-extension.zip" download>
                Download Chrome Extension
              </a>
            </Button>
            <Button asChild variant="outline" size="pill">
              <a href="#skills">See trained skills</a>
            </Button>
          </div>
        </section>

        <section id="skills" className="border-t border-line py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-4xl sm:text-5xl">Trained skills</h2>
              <p className="mt-2 max-w-[46ch] text-muted">
                Every skill started as a Chrome session. Open one to add it to Grok, download it, or edit the workflow.
              </p>
            </div>
          </div>
          {skills.length === 0 ? (
            <p className="mt-8 max-w-[46ch] border border-dashed border-line px-5 py-8 text-muted">
              None yet. Load the extension, click Done, or use Watch demo to land a sample workflow here.
            </p>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
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
                    <h3 className="text-3xl">{skill.title}</h3>
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-l border-line pl-3 first:border-l-0 first:pl-0">
      <dt className="text-2xl font-semibold">{value}</dt>
      <dd className="text-sm text-muted">{label}</dd>
    </div>
  );
}

function ChromeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="3.25" fill="currentColor" />
    </svg>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-6 w-6 ${className ?? ""}`} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.5 13.4 9 21 12l-7.6 3L12 22.5 10.6 15 3 12l7.6-3L12 1.5Z"
      />
    </svg>
  );
}
