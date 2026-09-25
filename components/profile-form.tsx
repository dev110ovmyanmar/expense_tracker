"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { useExpenses } from "@/components/expense-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm() {
  const { userName, updateDisplayName, clearLedger, saving } = useExpenses();
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? userName ?? "";
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="grid max-w-md gap-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="This name is saved on your account and shown in the sidebar."
      />
      <form
        className="grid gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void updateDisplayName(name)
            .then(() => toast.success("Display name saved."))
            .catch((error: unknown) => {
              toast.error("Could not save the name", {
                description: error instanceof Error ? error.message : "Try again in a moment.",
              });
            })
            .finally(() => setBusy(false));
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="profile-name">Display name</Label>
          <Input
            id="profile-name"
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(event) => setDraft(event.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" className="min-h-11" disabled={busy}>
          {busy ? "Saving…" : "Save name"}
        </Button>
      </form>
      <section className="grid gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10">
        <div className="grid gap-1">
          <h2 className="font-heading text-base">Clear my data</h2>
          <p className="text-sm text-muted-foreground">
            Removes income, expenses, daily bills, fixed bills, and savings goals for this account. Your login and display name stay.
          </p>
        </div>
        <Button type="button" variant="destructive" className="min-h-11" onClick={() => setConfirmClear(true)}>
          Clear my data
        </Button>
      </section>
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this ledger?</DialogTitle>
            <DialogDescription>
              Income, expenses, bills, and goals are deleted. The monthly budget returns to 500,000 Ks. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmClear(false)}>
              Keep my data
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => {
                void clearLedger()
                  .then(() => {
                    toast.success("Ledger cleared.");
                    setConfirmClear(false);
                  })
                  .catch((error: unknown) => {
                    toast.error("Could not clear the ledger", {
                      description: error instanceof Error ? error.message : "Try again in a moment.",
                    });
                  });
              }}
            >
              {saving ? "Clearing…" : "Clear data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
