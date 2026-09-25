"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { establishRecoverySession, getSupabase, isSupabaseConfigured, setSignedInUser } from "@/lib/supabase";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(() => !isSupabaseConfigured());
  const [canReset, setCanReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    const supabase = getSupabase();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user || (event !== "PASSWORD_RECOVERY" && event !== "SIGNED_IN")) return;
      window.setTimeout(() => {
        if (cancelled) return;
        setSignedInUser(session.user.id);
        setCanReset(true);
        setReady(true);
      }, 0);
    });
    void establishRecoverySession().then((ok) => {
      if (cancelled) return;
      setCanReset(ok);
      setReady(true);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="grid max-w-md gap-6">
      <PageHeader
        eyebrow="Account"
        title="New password"
        description="Choose a password of at least 6 characters."
      />
      <form
        className="grid gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canReset) {
            setNotice("Open the reset link in your email, then choose a new password.");
            return;
          }
          if (password.length < 6) {
            setNotice("Use a password of at least 6 characters.");
            return;
          }
          if (password !== confirm) {
            setNotice("Those passwords do not match.");
            return;
          }
          setBusy(true);
          setNotice("");
          void (async () => {
            try {
              const supabase = getSupabase();
              let readySession = await establishRecoverySession();
              if (!readySession) {
                setNotice("This reset link has no session. Request a new link and open it in this browser.");
                return;
              }
              let { error } = await supabase.auth.updateUser({ password });
              if (error && /session missing/i.test(error.message)) {
                console.error("[aura-auth] password update missing session", { message: error.message });
                readySession = await establishRecoverySession();
                if (readySession) ({ error } = await supabase.auth.updateUser({ password }));
              }
              if (error) {
                console.error("[aura-auth] password update failed", { message: error.message });
                setNotice(/session missing/i.test(error.message)
                  ? "This reset link has no session. Request a new link and open it in this browser."
                  : error.message);
                return;
              }
              toast.success("Password updated.");
              router.push("/");
            } catch (caught) {
              const message = caught instanceof Error ? caught.message : "The password could not be saved.";
              console.error("[aura-auth] password update threw", { message });
              setNotice(message);
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {!ready ? <p className="text-sm text-muted-foreground">Checking the reset link…</p> : null}
        {ready && !canReset ? (
          <p className="text-sm text-muted-foreground">Open the reset link in your email, then set the new password here.</p>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-11" />
        </div>
        {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
        <Button type="submit" className="min-h-11" disabled={busy || !ready}>
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
