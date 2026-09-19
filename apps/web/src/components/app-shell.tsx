import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/#how", label: "How it works" },
  { href: "/#skills", label: "Skills" },
  { href: "/#install", label: "Chrome extension" },
];

export function AppShell({
  children,
  live = false,
}: {
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col px-3 py-3 sm:px-6 sm:py-5">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col bg-paper px-4 py-4 shadow-[0_18px_50px_-32px_rgba(27,36,51,0.45)] sm:px-8 sm:py-5">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
          <Link href="/" className="flex items-center gap-3 text-navy">
            <Image
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
            <span className="headline text-[1.85rem] leading-none">ContextNinja</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-navy md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-mint">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {live ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-live">
                Live session
              </p>
            ) : null}
            <Button asChild variant="outline" size="pill">
              <a href="/#install">Load the extension</a>
            </Button>
          </div>
          <nav className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-navy md:hidden">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-mint">
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
