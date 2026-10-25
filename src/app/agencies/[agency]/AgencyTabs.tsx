"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AgencyConfig } from "@/lib/agencyConfig";

export default function AgencyTabs({ agency }: { agency: AgencyConfig }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/agencies/${agency.slug}/dashboard`, label: "Log" },
    { href: `/agencies/${agency.slug}/analytics`, label: "Analytics" },
  ];

  return (
    <div className="flex gap-7">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex items-center border-b-2 pb-3 text-[13px] transition-colors ${
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
