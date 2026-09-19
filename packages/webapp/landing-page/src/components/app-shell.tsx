import Image from "next/image";
import Link from "next/link";
import { DownloadChromeButton } from "@/components/download-chrome-button";

const SKILL_MANAGER = "http://127.0.0.1:43124";

const links: { href: string; label: string; external?: boolean }[] = [
  { href: "/", label: "Home" },
  { href: "/#demo", label: "Demo" },
  { href: "/team", label: "Team" },
  { href: "/#how", label: "How it works" },
  { href: "/#later", label: "Later" },
  { href: SKILL_MANAGER, label: "Skills", external: true },
];

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-5 sm:px-8 sm:py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-navy">
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
            <span className="headline text-xl leading-none">ContextNinja</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-navy md:flex">
            {links.map((link) =>
              link.external ? (
                <a key={link.href} href={link.href} className="hover:text-mint">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className="hover:text-mint">
                  {link.label}
                </Link>
              ),
            )}
          </nav>
          <DownloadChromeButton compact />
          <nav className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-navy md:hidden">
            {links.map((link) =>
              link.external ? (
                <a key={link.href} href={link.href} className="hover:text-mint">
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className="hover:text-mint">
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
