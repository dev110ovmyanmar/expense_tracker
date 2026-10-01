"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "aura-install-hint";

function appleMobile(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function InstallHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!appleMobile() || standalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    setOpen(true);
  }, []);

  if (!open) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-muted/40 px-3 py-3 text-sm">
      <p className="min-w-0 flex-1 text-muted-foreground">
        Add Aura to your Home Screen and it opens like an app, even with no connection. Tap Share, then Add to Home Screen.
      </p>
      <button
        type="button"
        className="shrink-0 text-sm font-medium text-primary"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // The hint can still close for this visit.
          }
          setOpen(false);
        }}
      >
        Not now
      </button>
    </div>
  );
}
