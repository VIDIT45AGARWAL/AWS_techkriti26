import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import PortalRedirect from "@/components/PortalRedirect";

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: {
    default: "Awaaz — voice-first emergency reporting",
    template: "%s · Awaaz",
  },
  description:
    "Speak what you see. Awaaz transcribes, triages, and dispatches your report to every relevant emergency desk in seconds.",
};

const themeScript = `
try {
  var stored = localStorage.getItem("awaaz-theme");
  var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme =
    stored === "light" || stored === "dark" ? stored : dark ? "dark" : "light";
} catch (error) {
  document.documentElement.dataset.theme = "light";
}
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${instrumentSans.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-svh flex-col bg-canvas font-sans text-ink antialiased">
        <PortalRedirect />
        <SiteNav />
        <main className="flex w-full flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
