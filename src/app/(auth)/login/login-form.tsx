"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type AuthFormState } from "@/actions/auth";

const beginState: AuthFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, beginState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inloggen</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wachtwoord">Wachtwoord</Label>
            <Input
              id="wachtwoord"
              name="wachtwoord"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              aria-invalid={state.error ? true : undefined}
            />
          </div>

          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Bezig…" : "Inloggen"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
