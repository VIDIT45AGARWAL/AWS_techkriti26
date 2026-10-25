export function SiteFooter({ apiNote }: { apiNote?: string }) {
  return (
    <footer className="flex w-full items-center justify-between gap-6 border-t border-line px-4 py-6 text-[11px] text-muted sm:px-6 lg:px-10 xl:px-14">
      <span>{apiNote ?? <>A voice is the fastest emergency interface there is.</>}</span>
      <a
        href="https://github.com/darshanjaidka/Sarvam-hackathon"
        target="_blank"
        rel="noreferrer noopener"
        className="shrink-0 transition-colors hover:text-ink hover:underline underline-offset-4"
      >
        Awaaz on GitHub
      </a>
    </footer>
  );
}
