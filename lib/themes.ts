export const THEME_STORAGE_KEY = "aura-theme";

export const DEFAULT_THEME = "emerald" as const;

export const THEMES = [
  { id: "cobalt", name: "Cobalt Night", swatch: "#6d8cff" },
  { id: "emerald", name: "Midnight Emerald", swatch: "#3dbe8b" },
  { id: "burgundy", name: "Burgundy", swatch: "#8f3a4c" },
  { id: "rose", name: "Obsidian & Rose Gold", swatch: "#e0b08a" },
  { id: "plum", name: "Dusk Plum", swatch: "#c4a4d4" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  document.documentElement.classList.add("dark");
  localStorage.setItem(THEME_STORAGE_KEY, id);
}
