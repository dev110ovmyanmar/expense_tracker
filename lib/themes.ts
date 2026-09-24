export const THEME_STORAGE_KEY = "aura-theme";

export const THEMES = [
  { id: "espresso", name: "Warm Espresso", swatch: "#c4a574" },
  { id: "emerald", name: "Midnight Emerald", swatch: "#3dbe8b" },
  { id: "slate", name: "Charcoal & Slate Blue", swatch: "#8aa0c8" },
  { id: "rose", name: "Obsidian & Rose Gold", swatch: "#e0b08a" },
  { id: "forest", name: "Deep Forest & Sage", swatch: "#9cbf9a" },
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
