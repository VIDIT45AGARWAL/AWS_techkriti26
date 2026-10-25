import Link from "next/link";

type WordmarkProps = {
  size?: "sm" | "lg";
  className?: string;
};

export function Wordmark({ size = "sm", className = "" }: WordmarkProps) {
  const wordmark = size === "lg" ? "text-[clamp(4.5rem,15vw,8.5rem)]" : "text-[1.45rem]";
  const period = size === "lg" ? "text-[0.24em]" : "text-[0.5em]";

  return (
    <Link
      href="/"
      aria-label="Awaaz home"
      className={`inline-flex items-baseline font-display font-normal leading-none tracking-[-0.045em] text-ink ${wordmark} ${className}`}
    >
      <span>Awaaz</span>
      <span aria-hidden="true" className={`font-sans font-medium text-accent ${period}`}>
        .
      </span>
    </Link>
  );
}
