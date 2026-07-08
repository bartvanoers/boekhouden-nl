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
import { setupAction, type AuthFormState } from "@/actions/auth";

const beginState: AuthFormState = {};

export function SetupForm() {
  const [state, formAction, pending] = useActionState(setupAction, beginState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eenmalige installatie</CardTitle>
        <CardDescription>
          Stel een wachtwoord in en vul de bedrijfsnaam in om te beginnen. De
          overige bedrijfsgegevens vul je later aan bij Instellingen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bedrijfsnaam">Bedrijfsnaam</Label>
            <Input
              id="bedrijfsnaam"
              name="bedrijfsnaam"
              type="text"
              autoComplete="organization"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wachtwoord">Wachtwoord</Label>
            <Input
              id="wachtwoord"
              name="wachtwoord"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground">Minstens 10 tekens.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bevestiging">Wachtwoord bevestigen</Label>
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

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Bezig…" : "Installeren en inloggen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
