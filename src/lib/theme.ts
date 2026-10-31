import { useEffect } from "react";
import { useStore } from "../data/store";

/** Keeps <html data-theme> in sync with the saved choice and, for "system", the OS setting. */
export function useThemeSync() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (mq?.matches ? "dark" : "light") : theme;
      document.documentElement.setAttribute("data-theme", resolved);
    };
    apply();
    if (theme !== "system" || !mq) return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}
