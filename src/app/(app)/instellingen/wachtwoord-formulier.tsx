"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type AuthFormState } from "@/actions/auth";

const beginState: AuthFormState = {};

/**
 * Los formulier om het wachtwoord te wijzigen. Fase 3 breidt de
 * instellingenpagina verder uit; dit component staat er los van.
 */
export function WachtwoordFormulier() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    beginState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Wachtwoord wijzigen
        </CardTitle>
        <CardDescription>
          Voer je huidige wachtwoord in en kies een nieuw wachtwoord.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="max-w-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="huidig">Huidig wachtwoord</Label>
            <Input
              id="huidig"
              name="huidig"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nieuw">Nieuw wachtwoord</Label>
            <Input
              id="nieuw"
              name="nieuw"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">Minstens 10 tekens.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bevestiging">Nieuw wachtwoord bevestigen</Label>
            <Input
              id="bevestiging"
              name="bevestiging"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
              {state.success}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Bezig…" : "Wachtwoord wijzigen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
