import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { DownloadChromeButton } from "@/components/download-chrome-button";
import { WatchDemoButton } from "@/components/watch-demo-button";

export default function LandingPage() {
  return (
    <AppShell>
      <main>
        <section className="grid items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 lg:py-16">
          <div className="max-w-xl space-y-6">
            <h1 className="text-[3.15rem] sm:text-[4.25rem] lg:text-[4.75rem]">
              Let&apos;s cut through all the bullshit!
            </h1>
            <div className="max-w-[42ch] space-y-4 text-lg leading-7 text-muted">
              <p>
                Tired of dealing with repetitive tasks that give you carpal tunnel? No worries, the ContextNinja is
                here to help you.
              </p>
              <p>
                Power through your dreadful task one more time and ContextNinja records it and creates a skill for you.
                Install the skill in your favorite LLM and say goodbye to the BS.
              </p>
            </div>
            <div className="flex flex-col items-start gap-5 pt-1 sm:flex-row sm:items-center">
              <DownloadChromeButton />
              <WatchDemoButton />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <span className="absolute left-[12%] top-[8%] h-3 w-3 rounded-full bg-[#7ea6ff]" />
            <span className="absolute right-[18%] top-[22%] h-2.5 w-2.5 rounded-full bg-mint" />
            <span className="absolute bottom-[18%] left-[6%] h-2.5 w-2.5 rounded-full bg-live" />
            <Sparkle className="absolute right-[8%] top-[12%] text-navy/35" />
            <Sparkle className="absolute bottom-[28%] right-[4%] text-navy" />
            <div className="relative mx-auto aspect-square max-w-[28rem] overflow-hidden rounded-full bg-[#eae5e2]">
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
              <p className="font-semibold">Create</p>
              <p className="text-muted">
                Stay on the live site. Click Create, then do the task the way you always do it.
              </p>
            </li>
            <li className="max-w-[28ch] space-y-2">
              <p className="font-semibold">Done</p>
              <p className="text-muted">
                Hit Done. The recorded workflow lands in the skill manager, steps tied to the real clicks.
              </p>
            </li>
            <li className="max-w-[28ch] space-y-2">
              <p className="font-semibold">Grok skill</p>
              <p className="text-muted">
                Edit, save, Add to Grok. Next time the agent walks that path for you.
              </p>
            </li>
          </ol>
        </section>
      </main>
    </AppShell>
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
