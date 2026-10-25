import Link from "next/link";
import { Mic } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { Wordmark } from "@/components/wordmark";

const example =
  "A truck has overturned on the expressway near Lonavala — two people are trapped.";

export default function HomePage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-6 sm:px-6 lg:px-10 xl:px-14">
        <div className="w-full max-w-[44rem]">
          <div className="flex flex-col items-center text-center">
            <Wordmark size="lg" />
            <p className="mt-5 max-w-[33rem] text-pretty text-[15px] leading-6 text-muted">
              Voice-first emergency reporting. Speak what you see — Awaaz
              transcribes, triages, and dispatches it to every relevant
              emergency desk, in your language, in seconds.
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3.5">
            <Link href="/report" aria-label="Report an emergency">
              <span
                data-state="ready"
                className="mic-btn inline-flex size-[5.5rem] items-center justify-center bg-accent text-accent-ink shadow-none"
              >
                <Mic className="size-6" strokeWidth={1.75} />
              </span>
            </Link>
            <Link
              href="/report"
              className="text-[15px] font-medium text-ink underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
            >
              Report an emergency
            </Link>
          </div>

          <div className="mt-12 flex flex-col items-center gap-2 text-center">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Try saying
            </span>
            <p className="heard max-w-[31rem] text-pretty text-[15.5px] leading-7 text-ink">
              “{example}”
            </p>
          </div>

          <nav
            aria-label="Desks"
            className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] text-muted"
          >
            <Link
              href="/dashboard"
              className="underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
            >
              Ops log
            </Link>
            <Link
              href="/analytics"
              className="underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
            >
              Analytics
            </Link>
            <Link
              href="/agencies"
              className="underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-accent"
            >
              Agency portals
            </Link>
          </nav>

          <p className="mt-12 text-center text-[11px] leading-5 text-muted">
            Voice to transcript to triage to dispatch. Transcription by Sarvam
            Saaras, triage by Amazon Bedrock, alerts by Amazon SNS.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
