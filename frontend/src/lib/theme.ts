import { useCallback, useEffect, useState } from "react";
import { KEYS, storage } from "./storage";

export type ThemeChoice = "system" | "light" | "dark";

function read(): ThemeChoice {
  const v = storage.get(KEYS.theme);
  return v === "light" || v === "dark" ? v : "system";
}

/** Applied before React renders (see main.tsx) so there is no flash of the wrong theme. */
export function applyTheme(choice: ThemeChoice = read()): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>(read);

  useEffect(() => applyTheme(theme), [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    storage.set(KEYS.theme, next === "system" ? null : next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}
