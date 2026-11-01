import { useEffect } from "react";
import { setTheme, useStore, type Theme } from "../data/store";
import { withViewTransition } from "./motion";

const resolve = (theme: Theme) =>
  theme === "system" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;

/** Writes the resolved theme to <html data-theme>. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", resolve(theme));
}

/** Saves a theme choice and cross-fades the page into it. */
export function chooseTheme(theme: Theme) {
  withViewTransition(() => { setTheme(theme); applyTheme(theme); });
}

/** Keeps <html data-theme> in sync with the saved choice and, for "system", the OS setting. */
export function useThemeSync() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (theme !== "system" || !mq) return;
    const on = () => applyTheme(theme);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
}
