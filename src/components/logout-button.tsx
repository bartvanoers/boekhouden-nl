import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/auth";

/** Uitlogknop onderin de zijbalk. Roept de logout-server-action aan. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" className="w-full justify-start">
        Uitloggen
      </Button>
    </form>
  );
}
