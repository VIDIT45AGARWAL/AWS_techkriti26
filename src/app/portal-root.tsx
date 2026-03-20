import { redirect } from "next/navigation";

const isAgenciesPortal = process.env.NEXT_PUBLIC_PORTAL_MODE === "agencies";

export default function AgenciesPortalRoot() {
  if (isAgenciesPortal) {
    redirect("/agencies/fire/dashboard");
  }
  redirect("/agencies");
}
