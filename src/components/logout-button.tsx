import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/actions/auth";

/** Uitlogknop onderin de zijbalk. Roept de logout-server-action aan. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="ghost"
        className="h-auto w-full justify-start gap-2.5 rounded-md border-0 px-3 py-2 font-medium text-muted-foreground hover:text-foreground"
      >
        <LogOut aria-hidden className="size-[18px] shrink-0" />
        Uitloggen
      </Button>
    </form>
  );
}
