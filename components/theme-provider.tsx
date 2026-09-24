"use client";

import { useEffect, type ReactNode } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, applyTheme, isThemeId } from "@/lib/themes";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(isThemeId(stored) ? stored : DEFAULT_THEME);
  }, []);
  return children;
}
