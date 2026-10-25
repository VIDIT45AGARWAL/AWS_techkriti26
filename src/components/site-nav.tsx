"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AGENCIES } from "@/lib/agencyConfig";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";

const mainLinks = [
  { href: "/report", label: "Report", match: "/report" },
  { href: "/dashboard", label: "Ops", match: "/dashboard" },
  { href: "/analytics", label: "Analytics", match: "/analytics" },
];

function isActive(pathname: string, match: string) {
  return match === "/" ? pathname === "/" : pathname.startsWith(match);
}

export function SiteNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isAgenciesPortal = process.env.NEXT_PUBLIC_PORTAL_MODE === "agencies";

  const links = isAgenciesPortal
    ? [
        { href: "/agencies", label: "Agencies", match: "/agencies/sentinel" },
        ...AGENCIES.map((agency) => ({
          href: `/agencies/${agency.slug}/dashboard`,
          label: agency.shortLabel,
          match: `/agencies/${agency.slug}`,
        })),
      ]
    : mainLinks;

  return (
    <header className="flex items-center justify-end gap-x-6 gap-y-3 px-4 py-5 sm:px-6 lg:px-10 xl:px-14">
      {isHome ? null : (
        <div className="mr-auto">
          <Wordmark />
        </div>
      )}
      <nav aria-label="Primary" className="flex items-baseline gap-5 text-[13px]">
        {links.map((link) => {
          const active = isActive(pathname, link.match);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "underline decoration-accent decoration-2 underline-offset-4"
                  : "text-muted transition-colors hover:text-ink"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <ThemeToggle />
    </header>
  );
}
