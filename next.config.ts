import type { NextConfig } from "next";

const isAgenciesPortal = process.env.NEXT_PUBLIC_PORTAL_MODE === "agencies";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: isAgenciesPortal ? ".next-agencies" : ".next",
};

export default nextConfig;
