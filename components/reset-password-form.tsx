"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export function ResetPasswordForm() {
  const router = useRouter();
  const { user, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-svh place-items-center bg-background px-4 py-10 text-foreground">
      <form
        className="grid w-full max-w-sm gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
        onSubmit={(event) => {
          event.preventDefault();
          if (!user) {
            setNotice("Open the reset link from your email in this browser.");
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
          void updatePassword(password).then((error) => {
            setBusy(false);
            if (error) {
              setNotice(error);
              return;
            }
            toast.success("Password updated.");
            router.replace("/");
          });
        }}
      >
        <div>
          <p className="font-heading text-2xl">New password</p>
          <p className="mt-1 text-sm text-muted-foreground">Choose at least 6 characters.</p>
        </div>
        {!user ? <p className="text-sm text-muted-foreground">Open the reset link from your email, then set the new password here.</p> : null}
        <div className="grid gap-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <Input id="reset-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-11" />
        </div>
        {notice ? <p className="text-sm text-destructive">{notice}</p> : null}
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
