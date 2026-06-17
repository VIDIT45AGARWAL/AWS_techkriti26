import type { NextConfig } from "next";
import path from "path";

const isAgenciesPortal = process.env.NEXT_PUBLIC_PORTAL_MODE === "agencies";

const nextConfig: NextConfig = {
  /* config options here */
  output: "export",
  distDir: isAgenciesPortal ? ".next-agencies" : ".next",
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
