import { createContext, useCallback, useContext, useEffect, useRef, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

/** Hash router (#/path?query). GitHub Pages has no server rewrites, so hash routes deep-link and refresh safely. */
export type Loc = { path: string; query: URLSearchParams };

function parse(): Loc {
  const raw = decodeURI(window.location.hash.replace(/^#/, "")) || "/";
  const i = raw.indexOf("?");
  const path = (i < 0 ? raw : raw.slice(0, i)) || "/";
  return { path: path.startsWith("/") ? path : "/" + path, query: new URLSearchParams(i < 0 ? "" : raw.slice(i + 1)) };
}

const Ctx = createContext<Loc | null>(null);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Loc>(parse);
  const last = useRef(loc.path);
  useEffect(() => {
    const on = () => {
      const next = parse();
      if (next.path !== last.current) {
        last.current = next.path;
        window.scrollTo({ top: 0 });
        // Move focus to the main region so screen readers announce the new page.
        requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
      }
      setLoc(next);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return <Ctx.Provider value={loc}>{children}</Ctx.Provider>;
}

export function useLocation(): Loc {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocation must be used inside RouterProvider");
  return v;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const target = "#" + to;
  if (window.location.hash === target) return;
  if (opts.replace) {
    history.replaceState(history.state, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = to;
  }
}

/** Matches "/rooms/:id" against a path and returns params, or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean), s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) {
      try { out[p[i].slice(1)] = decodeURIComponent(s[i]); } catch { return null; }
    } else if (p[i] !== s[i]) return null;
  }
  return out;
}

type LinkProps = { to: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;
export function Link({ to, children, ...rest }: LinkProps) {
  const { path } = useLocation();
  const current = to.split("?")[0] === path;
  return <a href={"#" + to} aria-current={current ? "page" : undefined} {...rest}>{children}</a>;
}

export function useBack(fallback: string) {
  return useCallback(() => { if (history.length > 1) history.back(); else navigate(fallback); }, [fallback]);
}

export function useTitle(title: string) {
  useEffect(() => { document.title = title ? `${title} · Kamra` : "Kamra — Find a flatmate, not just a flat"; }, [title]);
}
