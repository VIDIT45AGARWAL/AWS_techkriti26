"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("awaaz-theme", next);
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Switch color theme"
      title="Switch color theme"
      className="inline-flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
