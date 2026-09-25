"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authLog, getSupabase, setSignedInUser } from "@/lib/supabase";
import { ensureProfile } from "@/lib/profiles";

export function AuthScreen() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "reset">("sign-in");
  const [userName, setUserName] = useState("");
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
        {mode === "reset" ? (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email.trim()) {
                setNotice("Add the email on the account.");
                return;
              }
              setBusy(true);
              setNotice("");
              const redirectTo = `${window.location.origin}/reset-password`;
              void getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo }).then(({ error }) => {
                setBusy(false);
                if (error) {
                  setNotice(error.message);
                  return;
                }
                toast.success("Reset link sent.");
                setNotice("Check that email for a link to choose a new password.");
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
            </div>
            {notice ? <p className={`text-sm ${notice.startsWith("Check that email") ? "text-muted-foreground" : "text-destructive"}`}>{notice}</p> : null}
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? "Please wait…" : "Send reset link"}
            </Button>
            <button type="button" className="text-sm text-muted-foreground" onClick={() => { setMode("sign-in"); setNotice(""); }}>
              Back to sign in
            </button>
          </form>
        ) : null}
        {mode !== "reset" ? (
        <>
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
            const name = userName.trim();
            if (mode === "sign-up" && !name) {
              setNotice("Add a user name.");
              return;
            }
            if (mode === "sign-up" && name.length > 40) {
              setNotice("Keep the user name under 40 characters.");
              return;
            }
            if (!email.trim() || password.length < 6) {
              setNotice("Use an email and a password of at least 6 characters.");
              return;
            }
            setBusy(true);
            setNotice("");
            const auth = getSupabase().auth;
            const redirectTo = `${window.location.origin}/`;
            const action = mode === "sign-in"
              ? auth.signInWithPassword({ email: email.trim(), password })
              : auth.signUp({
                  email: email.trim(),
                  password,
                  options: {
                    data: { full_name: name, user_name: name },
                    emailRedirectTo: redirectTo,
                  },
                });
            void action.then(async ({ error, data }) => {
              try {
                setBusy(false);
                const message = error?.message ?? "";
                const userId = data.user?.id ?? data.session?.user?.id ?? null;
                authLog(mode === "sign-in" ? "sign in result" : "sign up result", {
                  hasSession: Boolean(data.session),
                  userId,
                  confirmed: Boolean(data.session),
                  error: message || null,
                });
                if (/email not confirmed/i.test(message)) {
                  setNotice("Confirm your email first. Open the link from Supabase, then sign in.");
                  return;
                }
                const alreadyRegistered = /already registered|already been registered|already exists/i.test(message);
                const hiddenDuplicate = mode === "sign-up" && !error && !data.session && Array.isArray(data.user?.identities) && data.user.identities.length === 0;
                if (alreadyRegistered || hiddenDuplicate) {
                  setNotice("This email already has an account. Deleting ledger rows does not remove the login. Sign in, or delete that user in Supabase under Authentication, then Users.");
                  return;
                }
                if (error || !userId) {
                  setNotice(message || "The account could not be created.");
                  return;
                }
                if (!data.session) {
                  toast.success("Check your email to confirm the account.");
                  setNotice("Confirm the email from Supabase, then sign in. You stay signed out until that link is opened.");
                  return;
                }
                const { error: sessionError } = await auth.setSession({
                  access_token: data.session.access_token,
                  refresh_token: data.session.refresh_token,
                });
                if (sessionError) {
                  console.error("[aura-auth] session persist failed", { userId, message: sessionError.message });
                  setNotice(sessionError.message);
                  return;
                }
                setSignedInUser(userId);
                const stored = window.localStorage.getItem("aura-auth");
                authLog("session stored", { userId, stored: Boolean(stored) });
                const profileError = await ensureProfile({
                  id: userId,
                  email: data.user?.email ?? data.session.user.email,
                  user_metadata: (data.user?.user_metadata ?? data.session.user.user_metadata) as Record<string, unknown>,
                });
                if (profileError) {
                  toast.error("Could not create your profile", { description: profileError });
                  setNotice(profileError);
                }
              } catch (caught) {
                const message = caught instanceof Error ? caught.message : "Sign-up could not finish.";
                console.error("[aura-auth] sign-up threw", { message });
                setNotice(message);
              }
            });
          }}
        >
          {mode === "sign-up" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="auth-name">User name</Label>
              <Input
                id="auth-name"
                type="text"
                autoComplete="nickname"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                className="h-11"
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input id="auth-password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
          </div>
          {mode === "sign-in" ? (
            <button type="button" className="justify-self-start text-sm text-muted-foreground" onClick={() => { setMode("reset"); setNotice(""); }}>
              Forgot password?
            </button>
          ) : null}
          {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
          {notice.includes("already has an account") ? (
            <button type="button" className="justify-self-start text-sm text-muted-foreground" onClick={() => { setMode("sign-in"); setNotice(""); }}>
              Sign in instead
            </button>
          ) : null}
          <Button type="submit" className="min-h-11" disabled={busy}>
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        </>
        ) : null}
      </div>
    </div>
  );
}
