"use client";

import { useEffect, type ReactNode } from "react";
import { THEME_STORAGE_KEY, applyTheme, isThemeId } from "@/lib/themes";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(isThemeId(stored) ? stored : "espresso");
  }, []);
  return children;
}
