import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { DownloadChromeButton } from "@/components/download-chrome-button";
import { WatchDemoButton } from "@/components/watch-demo-button";

const PATH = [
  { place: "Inbox", does: "Referral PDF lands in her email." },
  { place: "Login", does: "She signs into the EHR. Password stays with her." },
  { place: "Patient", does: "Name, DOB, sex from the fax. Duplicate check." },
  { place: "Visit", does: "New Patient appointment. OK the empty calendar." },
  { place: "Insurance", does: "Self first, then carrier, policy, group, address." },
  { place: "Chart", does: "Attach the same PDF under Medical Record." },
];

export default function LandingPage() {
  return (
    <AppShell>
      <main>
        <section className="grid items-end gap-12 border-b border-line py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:py-16">
          <div className="max-w-xl space-y-6">
            <h1 className="text-[3.15rem] sm:text-[4.25rem] lg:text-[4.75rem]">
              Let&apos;s cut through all the bullsh*t!
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

          <div className="relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <div className="relative mx-auto aspect-square max-w-[22rem] overflow-hidden rounded-full bg-[#eae5e2] lg:max-w-[26rem]">
              <Image
                src="/logo.png"
                alt="ContextNinja"
                fill
                sizes="(max-width: 768px) 70vw, 26rem"
                className="object-contain p-[16%]"
                priority
              />
            </div>
          </div>
        </section>

        <section id="demo" className="border-b border-line py-14" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="max-w-[16ch] text-4xl sm:text-5xl">
            Demo on this laptop
          </h2>
          <p className="mt-4 max-w-[52ch] text-lg leading-7 text-muted">
            Train is the extension. Run is the next fax. If a login window opens on Run, type{" "}
            <span className="font-semibold text-navy">pass</span> there — never into chat.
          </p>
          <ol className="mt-10 divide-y divide-line border-y border-line">
            {[
              {
                n: "01",
                does: "Load the extension unpacked (chrome://extensions → packages/extension). Create skill.",
              },
              {
                n: "02",
                does: "Do one referral: inbox → OpenEMR login → patient, visit, insurance, attach the PDF. Done.",
              },
              {
                n: "03",
                does: "The taught path lands here. Save. Download the skill folder if you want the artifact.",
              },
              {
                n: "04",
                does: "Run in OpenEMR. The engine fills the next referral PDF onto those four screens.",
              },
              {
                n: "05",
                does: "Open review. Compare the fax to what was saved. Billing is not this skill.",
              },
            ].map((step) => (
              <li
                key={step.n}
                className="grid gap-2 py-5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-8"
              >
                <p className="font-mono text-sm font-semibold text-navy">{step.n}</p>
                <p className="text-muted">{step.does}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-[52ch] text-sm leading-6 text-muted">
            Short on time: skip train and open a taught skill. Stage EHR: demo.openemr.io/a/openemr · admin / pass ·
            engine on :4710.
          </p>
        </section>

        <section className="border-b border-line py-14" aria-labelledby="path-heading">
          <h2 id="path-heading" className="max-w-[18ch] text-4xl sm:text-5xl">
            A referral PDF. Her inbox. Four EHR screens.
          </h2>
          <p className="mt-4 max-w-[52ch] text-lg leading-7 text-muted">
            None of those screens exist until she walks them. A snapshot of one form cannot see the
            next. Teach once in Chrome. The next fax is a skill, not a swivel chair.
          </p>
          <ol className="mt-10 divide-y divide-line border-y border-line">
            {PATH.map((step) => (
              <li
                key={step.place}
                className="grid gap-2 py-5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-8"
              >
                <p className="headline text-2xl text-navy">{step.place}</p>
                <p className="text-muted">{step.does}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="how" className="py-14">
          <h2 className="text-4xl sm:text-5xl">How it works</h2>
          <div className="mt-10 grid gap-12 lg:grid-cols-3">
            <div className="max-w-[32ch] space-y-3">
              <h3 className="text-3xl">Train</h3>
              <p className="text-muted">
                The extension, in her Chrome. Create skill, do the path, Done. Those tabs already have her email and
                EHR cookies. A computer-use agent does not.
              </p>
            </div>
            <div className="max-w-[32ch] space-y-3">
              <h3 className="text-3xl">Skill</h3>
              <p className="text-muted">
                Edit, save, download the folder. Drop it into Grok or Cursor. Required inputs (this fax, this login)
                are asked for. Nothing is guessed from the teach example.
              </p>
            </div>
            <div className="max-w-[32ch] space-y-3">
              <h3 className="text-3xl">Run</h3>
              <p className="text-muted">
                Next PDF: the agent fills OpenEMR, headed, so she can take over. Same four screens. Not billing.
              </p>
            </div>
          </div>
        </section>

        <section id="later" className="border-t border-line py-14" aria-labelledby="later-heading">
          <h2 id="later-heading" className="text-4xl sm:text-5xl">
            Later
          </h2>
          <p className="mt-5 max-w-[52ch] text-lg leading-7 text-muted">
            After a path is taught in Chrome, compile the steps that actually exist in an OpenAPI spec onto REST.
            Leave attach-fax, check-in, and billing on the UI path when the spec has no call. That compiler already
            lives in this repo. It is not how she trains, and it is not this weekend&apos;s run.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
