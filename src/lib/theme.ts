export type ThemePreference = "dark" | "light";

export const THEME_STORAGE_KEY = "chief-theme";

export function resolveThemePreference(value?: string | null): ThemePreference {
  if (value === "light" || value === "dark") return value;
  return "dark";
}

export function applyThemePreference(value: ThemePreference | string | null) {
  const resolved = resolveThemePreference(value);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolved);
  }
  return resolved;
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  return resolveThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function persistThemePreference(value: ThemePreference | string | null) {
  const resolved = applyThemePreference(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
  }
  return resolved;
}
