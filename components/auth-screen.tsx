"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabase } from "@/lib/supabase";

export function AuthScreen() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  return (
    <div className="grid min-h-svh place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm gap-6">
        <div>
          <p className="font-heading text-3xl">Aura</p>
          <p className="mt-1 text-sm text-muted-foreground">Your ledger stays on your account.</p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(["sign-in", "sign-up"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`h-9 rounded-md text-sm ${mode === value ? "bg-background font-medium" : "text-muted-foreground"}`}
              onClick={() => { setMode(value); setNotice(""); }}
            >
              {value === "sign-in" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.trim() || password.length < 6) {
              setNotice("Use an email and a password of at least 6 characters.");
              return;
            }
            setBusy(true);
            setNotice("");
            const auth = getSupabase().auth;
            const action = mode === "sign-in"
              ? auth.signInWithPassword({ email: email.trim(), password })
              : auth.signUp({ email: email.trim(), password });
            void action.then(({ error, data }) => {
              setBusy(false);
              if (error) {
                setNotice(error.message);
                return;
              }
              if (mode === "sign-up" && !data.session) {
                toast.success("Check your email to confirm the account.");
                setNotice("Confirm the email, then sign in.");
              }
            });
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input id="auth-password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
          </div>
          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
          <Button type="submit" className="min-h-11" disabled={busy}>
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
