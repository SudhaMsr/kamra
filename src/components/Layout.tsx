import { LogoMark } from "./Mushroom";
import { type ReactNode } from "react";
import { LuBookmark, LuCalendar, LuHouse, LuLogIn, LuMessageCircle, LuMonitor, LuMoon, LuPlus, LuSearch, LuSun, LuUser, LuUsers } from "react-icons/lu";
import { unreadCount, useStore, type Role, type Theme } from "../data/store";
import { chooseTheme } from "../lib/theme";
import { Link, useLocation } from "../lib/router";
import { Avatar } from "./ui";

type NavItem = { to: string; label: string; short: string; icon: typeof LuSearch; match: string[] };
const I = {
  search: { to: "/search", label: "Find a room", short: "Search", icon: LuSearch, match: ["/search", "/rooms"] },
  flatmates: { to: "/flatmates", label: "Flatmates", short: "Flatmates", icon: LuUsers, match: ["/flatmates"] },
  post: { to: "/post", label: "List a room", short: "List", icon: LuPlus, match: ["/post"] },
  mine: { to: "/my-rooms", label: "Your rooms", short: "Rooms", icon: LuHouse, match: ["/my-rooms"] },
  visits: { to: "/visits", label: "Visits", short: "Visits", icon: LuCalendar, match: ["/visits"] },
  messages: { to: "/messages", label: "Messages", short: "Messages", icon: LuMessageCircle, match: ["/messages"] },
} satisfies Record<string, NavItem>;

/** The menu follows what the person said they're here for. */
const NAV: Record<Role | "guest", NavItem[]> = {
  guest: [I.search, I.flatmates, I.post],
  seeker: [I.search, I.flatmates, I.visits, I.messages],
  lister: [I.mine, I.post, I.flatmates, I.messages],
  both: [I.search, I.flatmates, I.post, I.messages],
};

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2 rounded-lg" aria-label="Kamra home">
      <LogoMark className="transition-transform duration-[var(--t-med)] ease-[var(--ease)] group-hover:-rotate-6" />
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
          onClick={() => chooseTheme(v)}
          className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${theme === v ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"}`}>
          <Icon aria-hidden size={16} className={theme === v ? "anim-pop" : ""} />
        </button>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { path } = useLocation();
  const unread = useStore(unreadCount);
  const savedCount = useStore((s) => s.saved.length);
  const account = useStore((s) => s.account);
  const name = useStore((s) => s.profile?.name ?? "");
  const nav = NAV[account?.role ?? "guest"];
  const isActive = (m: readonly string[]) => m.some((p) => path === p || path.startsWith(p + "/"));
  const mobile: NavItem[] = [...nav.slice(0, 4), account
    ? { to: "/profile", label: "Profile", short: "Profile", icon: LuUser, match: ["/profile"] }
    : { to: "/login", label: "Log in", short: "Log in", icon: LuLogIn, match: ["/login", "/signup"] }];

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
              {nav.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[0.95rem] font-semibold transition-colors ${isActive(n.match) ? "bg-brand-soft text-brand dark:text-ink" : "text-ink hover:bg-raised"}`}>
                    <n.icon aria-hidden />{n.label}
                    {n.to === "/messages" && unread > 0 && <span key={unread} className="anim-pop ml-0.5 rounded-full bg-marigold px-1.5 text-xs font-bold text-[#22261b]">{unread}<span className="sr-only"> unread</span></span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden lg:block"><ThemeSwitch /></div>
            <Link to="/saved" className={`relative grid h-10 w-10 place-items-center rounded-xl ${path === "/saved" ? "bg-brand-soft text-brand" : "hover:bg-raised"}`} aria-label={`Saved rooms (${savedCount})`}>
              <LuBookmark aria-hidden size={20} />
              {savedCount > 0 && <span key={savedCount} aria-hidden className="anim-pop absolute -right-0.5 -top-0.5 rounded-full bg-marigold px-1.5 text-[0.7rem] font-bold text-[#22261b]">{savedCount}</span>}
            </Link>
            {account ? (
              <Link to="/profile" className={`inline-flex h-10 items-center gap-2 rounded-xl pl-1 pr-3 font-semibold ${path === "/profile" ? "bg-brand-soft" : "hover:bg-raised"}`}>
                <Avatar name={name || account.email} size={32} />
                <span className="hidden max-w-[8rem] truncate lg:inline">{name.split(" ")[0] || "Profile"}</span>
                <span className="sr-only lg:hidden">Your profile</span>
              </Link>
            ) : (
              <div className="hidden items-center gap-1 sm:flex">
                <Link to="/login" className="btn-ghost h-10 py-0">Log in</Link>
                <Link to="/signup" className="btn-primary h-10 py-0">Sign up</Link>
              </div>
            )}
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
            {account ? (
              <>
                <Link to="/profile" className="hover:underline">Profile & lifestyle</Link>
                <Link to="/my-rooms" className="hover:underline">Your rooms</Link>
                <Link to="/visits" className="hover:underline">Visits</Link>
              </>
            ) : (
              <>
                <Link to="/signup" className="hover:underline">Create an account</Link>
                <Link to="/login" className="hover:underline">Log in</Link>
              </>
            )}
          </nav>
          <div className="grid content-start gap-2 text-sm">
            <span className="eyebrow">Trust</span>
            <Link to="/safety" className="hover:underline">Safety & privacy</Link>
            <div className="lg:hidden"><ThemeSwitch /></div>
          </div>
        </div>
        <p className="wrap border-t border-line py-4 text-xs text-muted">Demo edition: listings shown are sample data, and accounts and everything you add are saved only in this browser.</p>
      </footer>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0, 1fr))` }}>
          {mobile.map((n) => {
            const on = isActive(n.match);
            return (
              <li key={n.to}>
                <Link to={n.to} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[0.72rem] font-semibold transition-colors ${on ? "text-brand" : "text-muted"}`}>
                  <n.icon aria-hidden size={22} className={`transition-transform duration-[var(--t-fast)] ${on ? "-translate-y-0.5" : ""}`} />
                  {n.short}
                  {n.to === "/messages" && unread > 0 && <span className="absolute right-[28%] top-1.5 h-2.5 w-2.5 rounded-full bg-marigold ring-2 ring-surface"><span className="sr-only">{unread} unread</span></span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
