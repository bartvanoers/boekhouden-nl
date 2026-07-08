import { redirect } from "next/navigation";
import { getActivePasswordHash } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Zonder ingesteld wachtwoord eerst de setup doorlopen.
  const hash = await getActivePasswordHash();
  if (!hash) {
    redirect("/setup");
  }

  // Al ingelogd? Direct door naar het dashboard.
  const session = await getSession();
  if (session.loggedIn) {
    redirect("/");
  }

  return <LoginForm />;
}
