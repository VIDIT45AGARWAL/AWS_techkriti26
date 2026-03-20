"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const isAgenciesPortal = process.env.NEXT_PUBLIC_PORTAL_MODE === "agencies";

export default function PortalRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isAgenciesPortal) return;

    // In agencies portal mode, only /agencies... routes are allowed
    if (pathname === "/" || pathname === "/dashboard" || pathname === "/report" || pathname === "/analytics") {
      router.replace("/agencies/fire/dashboard");
    }
  }, [pathname, router]);

  return null;
}
