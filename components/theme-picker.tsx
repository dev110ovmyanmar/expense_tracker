"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES, applyTheme, isThemeId, type ThemeId } from "@/lib/themes";

function subscribe(listener: () => void) {
  window.addEventListener("aura-theme", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("aura-theme", listener);
    window.removeEventListener("storage", listener);
  };
}

function currentTheme(): ThemeId {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
}

function useThemeId(): ThemeId {
  return useSyncExternalStore(subscribe, currentTheme, () => DEFAULT_THEME);
}

function choose(id: ThemeId) {
  applyTheme(id);
  window.dispatchEvent(new Event("aura-theme"));
}

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const active = useThemeId();
  const current = THEMES.find((theme) => theme.id === active) ?? THEMES[0];

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" aria-label={`Theme: ${current.name}`}>
            <span className="size-4 rounded-full" style={{ background: current.swatch }} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {THEMES.map((theme) => (
            <DropdownMenuItem key={theme.id} onSelect={() => choose(theme.id)}>
              <span className="size-3.5 rounded-full" style={{ background: theme.swatch }} />
              <span className="flex-1">{theme.name}</span>
              {theme.id === active ? <span className="text-xs text-muted-foreground">On</span> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Theme</p>
        <p className="truncate text-[11px] text-muted-foreground">{current.name}</p>
      </div>
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Color theme">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={theme.id === active}
            aria-label={theme.name}
            title={theme.name}
            onClick={() => choose(theme.id)}
            className="grid h-8 place-items-center rounded-md"
          >
            <span
              className={`size-5 rounded-full ${theme.id === active ? "outline outline-2 outline-offset-2 outline-primary" : "outline outline-1 outline-foreground/15"}`}
              style={{ background: theme.swatch }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
