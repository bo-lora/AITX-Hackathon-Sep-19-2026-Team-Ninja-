import type { Metadata } from "next";
import { Bricolage_Grotesque, Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ContextNinja",
  description:
    "You're on the real site. Hit Create, do the task once, hit Done. The workflow is waiting to become a Grok skill.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {/*
          THESIS: One real click-path, captured in the live site, not a script-font pitch.
          OWN-WORLD: Logo cream #f3efed, navy mark, Bricolage Grotesque headlines, Open Sans body.
          STORY: Create, do the task, Done, the workflow waits to become a Grok skill.
          FIRST VIEWPORT: Nav, huge grotesque headline, dark Download Chrome Extension pill with Chrome icon, circular logo.
          FORM: Extension-landing structure; type is heavy grotesque, never a brush script.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
