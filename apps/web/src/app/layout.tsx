import type { Metadata } from "next";
import { Kolker_Brush, Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const kolkerBrush = Kolker_Brush({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "ContextNinja",
  description:
    "Teach a task in Chrome, confirm the workflow, then add the skill to Grok. No API key in the extension.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${kolkerBrush.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {/*
          THESIS: The log of what she just did in Chrome, not a SaaS skill catalog.
          OWN-WORLD: Cream paper, accepted ninja PNG, Kolker Brush headlines, Open Sans body, mint for Done.
          STORY: Confirm the taught workflow, save a skill, add it to Grok.
          FIRST VIEWPORT: Cream frame, white stage, nav + pill, left headline, right circular logo.
          FORM: Extension-marketing landing structure, type locked to Kolker Brush / Open Sans.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
