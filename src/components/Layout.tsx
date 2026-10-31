import { type ReactNode } from "react";
import { LuBookmark, LuMessageCircle, LuMonitor, LuMoon, LuPlus, LuSearch, LuSun, LuUser, LuUsers } from "react-icons/lu";
import { setTheme, unreadCount, useStore, type Theme } from "../data/store";
import { Link, useLocation } from "../lib/router";

const NAV = [
  { to: "/search", label: "Find a room", icon: LuSearch, match: ["/search", "/rooms"] },
  { to: "/flatmates", label: "Flatmates", icon: LuUsers, match: ["/flatmates"] },
  { to: "/post", label: "List a room", icon: LuPlus, match: ["/post", "/my-rooms"] },
  { to: "/messages", label: "Messages", icon: LuMessageCircle, match: ["/messages"] },
] as const;

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg" aria-label="Kamra home">
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--brand)" />
        <path d="M14 30 32 15l18 15v19a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2z" fill="none" stroke="var(--brand-ink)" strokeWidth="4" strokeLinejoin="round" />
        <path d="M26 51V38h12v13" fill="none" stroke="var(--brand-ink)" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="46" cy="18" r="6" fill="var(--marigold)" />
      </svg>
      <span className="font-display text-[1.45rem] font-extrabold tracking-tight text-ink">kamra</span>
    </Link>
  );
}

function ThemeSwitch() {
  const theme = useStore((s) => s.theme);
  const opts: Array<[Theme, string, typeof LuSun]> = [["light", "Light", LuSun], ["system", "System", LuMonitor], ["dark", "Dark", LuMoon]];
  return (
    <div role="radiogroup" aria-label="Colour theme" className="flex rounded-xl border border-line bg-surface p-0.5">
      {opts.map(([v, label, Icon]) => (
        <button key={v} type="button" role="radio" aria-checked={theme === v} aria-label={`${label} theme`} title={`${label} theme`}
          onClick={() => setTheme(v)}
          className={`grid h-8 w-8 place-items-center rounded-lg ${theme === v ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`}>
          <Icon aria-hidden size={16} />
        </button>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { path } = useLocation();
  const unread = useStore(unreadCount);
  const savedCount = useStore((s) => s.saved.length);
  const hasProfile = useStore((s) => !!s.profile);
  const isActive = (m: readonly string[]) => m.some((p) => path === p || path.startsWith(p + "/"));

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}
        className="sr-only z-[60] rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[0.95rem] font-semibold ${isActive(n.match) ? "bg-brand-soft text-brand" : "text-ink hover:bg-raised"}`}>
                    <n.icon aria-hidden />{n.label}
                    {n.to === "/messages" && unread > 0 && <span className="ml-0.5 rounded-full bg-marigold px-1.5 text-xs font-bold text-[#141738]">{unread}<span className="sr-only"> unread</span></span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><ThemeSwitch /></div>
            <Link to="/saved" className={`relative grid h-10 w-10 place-items-center rounded-xl ${path === "/saved" ? "bg-brand-soft text-brand" : "hover:bg-raised"}`} aria-label={`Saved rooms (${savedCount})`}>
              <LuBookmark aria-hidden size={20} />
              {savedCount > 0 && <span aria-hidden className="absolute -right-0.5 -top-0.5 rounded-full bg-marigold px-1.5 text-[0.7rem] font-bold text-[#141738]">{savedCount}</span>}
            </Link>
            <Link to="/profile" className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 font-semibold ${path === "/profile" ? "bg-brand-soft text-brand" : "hover:bg-raised"}`}>
              <LuUser aria-hidden size={20} /><span className="hidden lg:inline">{hasProfile ? "Profile" : "Create profile"}</span><span className="sr-only lg:hidden">Profile</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-12">{children}</main>

      <footer className="border-t border-line bg-surface pb-24 md:pb-0">
        <div className="wrap grid gap-6 py-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted">Rooms and flatmates across Indian cities, matched on how you actually live. Free to contact, phone numbers stay private.</p>
          </div>
          <nav aria-label="Explore" className="grid content-start gap-2 text-sm">
            <span className="eyebrow">Explore</span>
            <Link to="/search" className="hover:underline">Find a room</Link>
            <Link to="/flatmates" className="hover:underline">Find flatmates</Link>
            <Link to="/post" className="hover:underline">List a room</Link>
          </nav>
          <nav aria-label="Your account" className="grid content-start gap-2 text-sm">
            <span className="eyebrow">You</span>
            <Link to="/profile" className="hover:underline">Profile & lifestyle</Link>
            <Link to="/my-rooms" className="hover:underline">Your listings</Link>
            <Link to="/visits" className="hover:underline">Visits</Link>
          </nav>
          <div className="grid content-start gap-2 text-sm">
            <span className="eyebrow">Trust</span>
            <Link to="/safety" className="hover:underline">Safety & privacy</Link>
            <div className="sm:hidden"><ThemeSwitch /></div>
          </div>
        </div>
        <p className="wrap border-t border-line py-4 text-xs text-muted">Demo edition: listings shown are sample data, and everything you add is saved only in this browser.</p>
      </footer>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-5">
          {[...NAV.slice(0, 2), NAV[2], NAV[3], { to: "/profile", label: "Profile", icon: LuUser, match: ["/profile"] }].map((n) => (
            <li key={n.to}>
              <Link to={n.to} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[0.72rem] font-semibold ${isActive(n.match) ? "text-brand" : "text-muted"}`}>
                <n.icon aria-hidden size={22} />
                {n.label === "Find a room" ? "Search" : n.label === "List a room" ? "List" : n.label}
                {n.to === "/messages" && unread > 0 && <span className="absolute right-[28%] top-1.5 h-2.5 w-2.5 rounded-full bg-marigold ring-2 ring-surface"><span className="sr-only">{unread} unread</span></span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
