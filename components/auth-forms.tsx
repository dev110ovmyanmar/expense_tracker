"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThemePicker } from "@/components/theme-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

type Mode = "sign-in" | "sign-up" | "reset";

export function AuthForms() {
  const router = useRouter();
  const { signIn, signUp, sendReset } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    if (mode === "reset") {
      if (!email.trim()) {
        setNotice("Add the email on the account.");
        return;
      }
      setBusy(true);
      const error = await sendReset(email);
      setBusy(false);
      if (error) {
        setNotice(error);
        return;
      }
      toast.success("Reset link sent.");
      setNotice("Check that email for a link to choose a new password.");
      return;
    }
    if (mode === "sign-up" && !name.trim()) {
      setNotice("Add a user name.");
      return;
    }
    if (!email.trim() || password.length < 6) {
      setNotice("Use an email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const error = mode === "sign-in" ? await signIn(email, password) : await signUp(name.trim(), email, password);
    setBusy(false);
    if (error?.startsWith("Confirm")) {
      setNotice(error);
      return;
    }
    if (error) {
      setNotice(error);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="grid min-h-svh place-items-center bg-background px-4 py-10 text-foreground">
      <div className="grid w-full max-w-sm gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-heading text-3xl">Aura</p>
            <p className="mt-1 text-sm text-muted-foreground">Your ledger stays on your account.</p>
          </div>
          <ThemePicker compact />
        </div>
        {mode === "reset" ? null : (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["sign-in", "sign-up"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`h-11 rounded-md text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${mode === value ? "bg-background font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => { setMode(value); setNotice(""); }}
              >
                {value === "sign-in" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
        )}
        <form className="grid gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10" onSubmit={(event) => void onSubmit(event)}>
          {mode === "sign-up" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="auth-name">User name</Label>
              <Input id="auth-name" value={name} autoComplete="nickname" onChange={(event) => setName(event.target.value)} className="h-11" />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
          </div>
          {mode === "reset" ? null : (
            <div className="grid gap-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <Input id="auth-password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
            </div>
          )}
          {notice ? <p className={`text-sm ${notice.startsWith("Check that email") || notice.startsWith("Confirm") ? "text-muted-foreground" : "text-destructive"}`}>{notice}</p> : null}
          <Button type="submit" className="min-h-11" disabled={busy}>
            {busy ? "Please wait…" : mode === "reset" ? "Send reset link" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
          {mode === "sign-in" ? (
            <button type="button" className="justify-self-start text-sm text-muted-foreground hover:text-foreground" onClick={() => { setMode("reset"); setNotice(""); }}>
              Forgot password?
            </button>
          ) : (
            <button type="button" className="justify-self-start text-sm text-muted-foreground hover:text-foreground" onClick={() => { setMode("sign-in"); setNotice(""); }}>
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
