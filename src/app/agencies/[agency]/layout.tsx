import React from "react";
import Link from "next/link";
import { AGENCIES, getAgencyBySlug } from "@/lib/agencyConfig";
import AgencyTabs from "./AgencyTabs";

export function generateStaticParams() {
  return AGENCIES.map((agency) => ({ agency: agency.slug }));
}

export default async function AgencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ agency: string }>;
}) {
  const { agency: agencySlug } = await params;
  const agency = getAgencyBySlug(agencySlug);

  if (!agency) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="font-display text-2xl tracking-[-0.01em]">Desk not found</h1>
        <p className="mt-3 text-[13px] text-muted leading-6">
          This desk does not exist.
        </p>
        <Link
          href="/agencies"
          className="mt-5 text-[13px] text-accent underline underline-offset-4"
        >
          All agencies
        </Link>
      </main>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Quiet desk bar */}
      <div className="px-4 sm:px-6 lg:px-10 xl:px-14">
        <nav
          aria-label="Desk views"
          className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-line pb-0 pt-1"
        >
          <h1 className="font-display text-[1.9rem] font-normal leading-none tracking-[-0.02em]">
            {agency.label}
          </h1>
          <AgencyTabs agency={agency} />
        </nav>
        <p className="mt-3 max-w-[60ch] text-[13px] leading-6 text-muted">
          {agency.description}
        </p>
      </div>

      {children}
    </div>
  );
}
