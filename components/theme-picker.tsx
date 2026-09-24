"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_STORAGE_KEY, THEMES, applyTheme, isThemeId, type ThemeId } from "@/lib/themes";

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
  return isThemeId(stored) ? stored : "espresso";
}

function useThemeId(): ThemeId {
  return useSyncExternalStore(subscribe, currentTheme, () => "espresso");
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
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">Theme</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Color theme">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={theme.id === active}
            aria-label={theme.name}
            title={theme.name}
            onClick={() => choose(theme.id)}
            className={`size-7 rounded-full ring-offset-2 ring-offset-sidebar ${theme.id === active ? "ring-2 ring-foreground" : "ring-1 ring-foreground/20"}`}
            style={{ background: theme.swatch }}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{current.name}</p>
    </div>
  );
}
