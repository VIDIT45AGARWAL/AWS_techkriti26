"use client";

import React from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { AGENCIES } from "@/lib/agencyConfig";
import { TONE_BG } from "@/lib/tone";

export default function AgenciesPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-[44rem] flex-1 flex-col px-4 pb-16 pt-2 sm:px-6 lg:px-10 xl:px-14">
        <header className="flex flex-col items-center text-center">
          <h1 className="text-pretty font-display text-[2.4rem] font-normal leading-[1.15] tracking-[-0.03em]">
            Agency desks
          </h1>
          <p className="mt-3 max-w-[30rem] text-pretty text-[14px] leading-6 text-muted">
            Each desk sees only the reports dispatched to it, with the caller
            conversation attached to every entry.
          </p>
        </header>

        <ol className="mt-10 list-none">
          {AGENCIES.map((agency) => (
            <li key={agency.slug} className="border-b border-line last:border-b-0">
              <Link
                href={`/agencies/${agency.slug}/dashboard`}
                className="group block py-6 first:pt-1"
              >
                <div className="flex items-baseline justify-between gap-x-6">
                  <h2 className="max-w-[32rem] text-pretty font-display text-[1.6rem] font-normal leading-[1.2] tracking-[-0.015em] transition-colors group-hover:text-accent">
                    {agency.label}
                  </h2>
                  <span className="shrink-0 text-[13px] text-muted">Open log</span>
                </div>
                <p className="mt-2 max-w-[70ch] text-[13px] leading-6 text-muted">
                  {agency.description}
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
                  <span className={`size-[7px] rounded-full ${TONE_BG[agency.tone]}`} />
                  {agency.incidentTypes.join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      </main>

      <SiteFooter />
    </div>
  );
}
