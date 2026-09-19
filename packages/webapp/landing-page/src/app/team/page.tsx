import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { LinkedInCard } from "@/components/linkedin-card";
import { TEAM } from "@/lib/team";

export const metadata: Metadata = {
  title: "Team — ContextNinja",
  description: "Team Ninja. Scan a card for LinkedIn.",
};

export default function TeamPage() {
  return (
    <AppShell>
      <main>
        <section className="border-b border-line py-12 lg:py-16">
          <h1 className="max-w-[12ch] text-[3.15rem] sm:text-[4.25rem]">Team Ninja</h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-7 text-muted">
            Four people. Scan a card, or tap the name. Cursor Austin × AITX, 19 Sep 2026.
          </p>
        </section>

        <section className="py-12" aria-label="LinkedIn">
          <ul className="grid gap-5 sm:grid-cols-2">
            {TEAM.map((person) => (
              <li key={person.linkedin}>
                <LinkedInCard person={person} />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
