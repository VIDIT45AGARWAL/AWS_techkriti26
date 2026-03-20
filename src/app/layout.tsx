import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PortalRedirect from "@/components/PortalRedirect";

export const metadata: Metadata = {
  title: "CivicAlert — AI Emergency Response",
  description:
    "Voice-first, AI-powered emergency reporting. Speak what you see — CivicAlert handles the rest. Instant triage, multi-department dispatch in under 10 seconds.",
  keywords: [
    "emergency response",
    "AI triage",
    "voice reporting",
    "disaster management",
    "India",
    "112",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PortalRedirect />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
