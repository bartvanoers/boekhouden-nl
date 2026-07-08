import { redirect } from "next/navigation";
import { getActivePasswordHash } from "@/lib/auth/password";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Setup is alleen bereikbaar zolang er nog geen wachtwoord is ingesteld.
  const hash = await getActivePasswordHash();
  if (hash) {
    redirect("/login");
  }

  return <SetupForm />;
}
