import { useRef, useSyncExternalStore } from "react";
import { z } from "zod";
import { hashPassword, randomSalt, safeEqual } from "../lib/crypto";
import { redactContacts } from "../domain/privacy";
import { ListingInput, MessageText, Profile, type Listing, type Message, type Report, type Seeker, type Thread, type Visit } from "../domain/types";
import { DEMO_LISTINGS, DEMO_SEEKERS } from "./demo";

/*
 * Client-side data store.
 *
 * Root (persisted)            View (what components see)
 * ├─ accounts[]               ├─ account (public fields of the signed-in account, or null)
 * ├─ data[accountId] ─────┐   ├─ profile, myListings, saved, threads, messages, visits, reports
 * ├─ guest ───────────────┴─▶ │    (from the signed-in account's bucket, or the guest bucket)
 * ├─ session                  ├─ otherListings (rooms posted by other accounts on this device)
 * └─ theme                    └─ theme
 *
 * Pages read the View and call the action functions below; actions validate input and write back to the Root.
 */

const KEY = "kamra:v2";
const LEGACY_KEY = "kamra:v1";

export type Theme = "system" | "light" | "dark";
export const ROLES = { seeker: "Looking for a room", lister: "Have a room to fill", both: "Both" } as const;
export type Role = keyof typeof ROLES;

type Account = { id: string; email: string; salt: string; hash: string; role: Role; createdAt: number };
export type PublicAccount = Omit<Account, "salt" | "hash">;

type UserData = {
  profile: Profile | null;
  myListings: Listing[];
  saved: string[];
  threads: Thread[];
  messages: Message[];
  visits: Visit[];
  reports: Report[];
};
type Root = { v: 2; theme: Theme; session: string | null; accounts: Account[]; data: Record<string, UserData>; guest: UserData };

export type State = UserData & { theme: Theme; account: PublicAccount | null; otherListings: Listing[] };

export class StoreError extends Error {}

const emptyData = (): UserData => ({ profile: null, myListings: [], saved: [], threads: [], messages: [], visits: [], reports: [] });
const emptyRoot = (): Root => ({ v: 2, theme: "system", session: null, accounts: [], data: {}, guest: emptyData() });

function id(prefix: string): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefix + Date.now().toString(36) + [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- validation of anything read from storage ---------- */
const arr = <T,>(x: unknown, ok: (i: any) => boolean): T[] => (Array.isArray(x) ? x.filter(ok) : []);

function sanitizeData(raw: unknown): UserData {
  const s = emptyData();
  if (!raw || typeof raw !== "object") return s;
  const r = raw as Partial<UserData>;
  const p = Profile.safeParse(r.profile);
  s.profile = p.success ? p.data : null;
  s.myListings = arr<Listing>(r.myListings, (l) => l && typeof l.id === "string" && typeof l.ownerId === "string" && ListingInput.safeParse(l).success);
  s.saved = arr<string>(r.saved, (x) => typeof x === "string");
  s.threads = arr<Thread>(r.threads, (t) => t && typeof t.id === "string" && typeof t.withName === "string");
  const threadIds = new Set(s.threads.map((t) => t.id));
  s.messages = arr<Message>(r.messages, (m) => m && threadIds.has(m.threadId) && typeof m.text === "string");
  s.visits = arr<Visit>(r.visits, (v) => v && typeof v.listingId === "string" && typeof v.slot === "string");
  s.reports = arr<Report>(r.reports, (x) => x && typeof x.listingId === "string");
  return s;
}

const AccountZ = z.object({
  id: z.string().min(1), email: z.string().email(), salt: z.string().min(8), hash: z.string().startsWith("pbkdf2$"),
  role: z.enum(["seeker", "lister", "both"]), createdAt: z.number(),
});

function sanitizeRoot(raw: unknown): Root {
  const root = emptyRoot();
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 2) return root;
  const r = raw as Partial<Root>;
  root.theme = r.theme === "light" || r.theme === "dark" ? r.theme : "system";
  const seen = new Set<string>();
  root.accounts = arr<Account>(r.accounts, (a) => {
    const ok = AccountZ.safeParse(a).success && !seen.has(a.email);
    if (ok) seen.add(a.email);
    return ok;
  });
  for (const a of root.accounts) root.data[a.id] = sanitizeData(r.data?.[a.id]);
  root.guest = sanitizeData(r.guest);
  root.guest.profile = null;
  root.session = root.accounts.some((a) => a.id === r.session) ? (r.session as string) : null;
  return root;
}

/** Version 1 had a single, password-less profile. Keep its saved rooms and theme; the person signs up again. */
function migrateV1(raw: string): Root {
  const root = emptyRoot();
  try {
    const old = JSON.parse(raw) as { theme?: Theme; saved?: unknown };
    root.theme = old.theme === "light" || old.theme === "dark" ? old.theme : "system";
    root.guest.saved = arr<string>(old.saved, (x) => typeof x === "string");
  } catch { /* unreadable legacy data: start fresh */ }
  return root;
}

/* ---------- persistence ---------- */
let storageAvailable = true;
let root: Root = load();
let view: State = deriveView(root);
const listeners = new Set<() => void>();

function load(): Root {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { return sanitizeRoot(JSON.parse(raw)); }
      catch { localStorage.setItem(KEY + ":corrupt:" + Date.now(), raw); return emptyRoot(); }
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    return legacy ? migrateV1(legacy) : emptyRoot();
  } catch { storageAvailable = false; return emptyRoot(); }
}

function deriveView(r: Root): State {
  const acc = r.accounts.find((a) => a.id === r.session) ?? null;
  const data = acc ? r.data[acc.id] ?? emptyData() : r.guest;
  const otherListings = r.accounts.filter((a) => a.id !== acc?.id).flatMap((a) => r.data[a.id]?.myListings ?? []);
  return {
    ...data, theme: r.theme, otherListings,
    account: acc ? { id: acc.id, email: acc.email, role: acc.role, createdAt: acc.createdAt } : null,
  };
}

function commitRoot(next: Root) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      throw new StoreError("Your browser's storage is full. Remove a few photos and try again.");
    }
    storageAvailable = false; // private mode etc: keep working in memory
  }
  root = next;
  view = deriveView(root);
  listeners.forEach((l) => l());
}

/** Applies a change to the current person's data (or the guest bucket) and the theme. */
function update(fn: (s: State) => State) {
  const next = fn(view);
  const data: UserData = {
    profile: next.profile, myListings: next.myListings, saved: next.saved, threads: next.threads,
    messages: next.messages, visits: next.visits, reports: next.reports,
  };
  const r: Root = { ...root, theme: next.theme };
  if (root.session) r.data = { ...root.data, [root.session]: data };
  else r.guest = { ...data, profile: null };
  commitRoot(r);
}

// Keep several open tabs consistent.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try { root = e.newValue ? sanitizeRoot(JSON.parse(e.newValue)) : emptyRoot(); } catch { return; }
    view = deriveView(root);
    listeners.forEach((l) => l());
  });
}

export const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const getState = () => view;
export const isPersistent = () => storageAvailable;

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  return false;
}

/**
 * Subscribes a component to a slice of state. Selectors may build new arrays; results are memoised per state
 * snapshot and compared shallowly so React sees a stable value and doesn't re-render (or loop) needlessly.
 */
export function useStore<T>(select: (s: State) => T): T {
  const cache = useRef<{ s: State | null; v: T | undefined }>({ s: null, v: undefined });
  const get = () => {
    const c = cache.current;
    if (c.s === view && c.v !== undefined) return c.v as T;
    const v = select(view);
    const stable = c.s !== null && shallowEqual(v, c.v) ? (c.v as T) : v;
    cache.current = { s: view, v: stable };
    return stable;
  };
  return useSyncExternalStore(subscribe, get, get);
}

/* ---------- accounts ---------- */
export const SignUpInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use at most 128 characters")
    .regex(/[A-Za-z]/, "Include at least one letter").regex(/\d/, "Include at least one number"),
  role: z.enum(["seeker", "lister", "both"], { errorMap: () => ({ message: "Choose how you'll use Kamra" }) }),
});

export const emailTaken = (email: string) => root.accounts.some((a) => a.email === email.trim().toLowerCase());

export async function signUp(input: unknown, profileInput: unknown): Promise<PublicAccount> {
  const { email, password, role } = SignUpInput.parse(input);
  const profile = Profile.parse(profileInput);
  if (emailTaken(email)) throw new StoreError("An account with this email already exists. Log in instead.");
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  if (emailTaken(email)) throw new StoreError("An account with this email already exists. Log in instead.");
  const acc: Account = { id: id("u"), email, salt, hash, role, createdAt: Date.now() };
  // Rooms saved while browsing as a guest move into the new account.
  const data: UserData = { ...emptyData(), profile: { ...profile, lookingForRoom: role !== "lister" }, saved: root.guest.saved };
  commitRoot({ ...root, accounts: [...root.accounts, acc], data: { ...root.data, [acc.id]: data }, guest: emptyData(), session: acc.id });
  return view.account!;
}

const attempts = { count: 0, until: 0 };
export async function logIn(emailRaw: string, password: string): Promise<PublicAccount> {
  const now = Date.now();
  if (now < attempts.until) {
    throw new StoreError(`Too many attempts. Try again in ${Math.ceil((attempts.until - now) / 1000)} seconds.`);
  }
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) throw new StoreError("Enter your email and password.");
  const acc = root.accounts.find((a) => a.email === email);
  // Hash even when the email is unknown, so both failures take the same time.
  const hash = await hashPassword(password, acc?.salt ?? "no-such-account-salt");
  if (!acc || !safeEqual(hash, acc.hash)) {
    attempts.count++;
    if (attempts.count >= 5) { attempts.until = Date.now() + 30_000; attempts.count = 0; }
    throw new StoreError("That email and password don't match.");
  }
  attempts.count = 0;
  commitRoot({ ...root, session: acc.id });
  return view.account!;
}

export function logOut() { commitRoot({ ...root, session: null }); }

export function setRole(role: Role) {
  if (!root.session) throw new StoreError("Log in first.");
  commitRoot({ ...root, accounts: root.accounts.map((a) => (a.id === root.session ? { ...a, role } : a)) });
}

/** Deletes the signed-in account and everything it created on this device. */
export function deleteAccount() {
  const sid = root.session;
  if (!sid) throw new StoreError("Log in first.");
  const { [sid]: _gone, ...data } = root.data;
  commitRoot({ ...root, accounts: root.accounts.filter((a) => a.id !== sid), data, session: null });
}

/** Where to land after signing in, based on what the person is here for. */
export function homeFor(acc: PublicAccount, profile: Profile | null): string {
  const city = encodeURIComponent(profile?.city ?? "Bengaluru");
  if (acc.role === "lister") return view.myListings.length ? "/my-rooms" : "/post";
  return `/search?city=${city}&sort=fit`;
}

/* ---------- reads ---------- */
export const allListings = (s: State = view): Listing[] => [...s.myListings, ...s.otherListings, ...DEMO_LISTINGS];
export const findListing = (lid: string, s: State = view) => allListings(s).find((l) => l.id === lid);
export const isMine = (l: Listing, s: State = view) => !!s.account && l.ownerId === s.account.id;
export const allSeekers = (): Seeker[] => DEMO_SEEKERS;
export const findSeeker = (sid: string) => DEMO_SEEKERS.find((x) => x.id === sid);
export const unreadCount = (s: State) =>
  s.threads.reduce((n, t) => n + s.messages.filter((m) => m.threadId === t.id && m.from === "them" && m.at > t.readAt).length, 0);

/* ---------- profile & settings ---------- */
export function saveProfile(input: unknown): Profile {
  if (!root.session) throw new StoreError("Sign up or log in to save your profile.");
  const p = Profile.parse(input);
  update((s) => ({ ...s, profile: p }));
  return p;
}
export const setTheme = (theme: Theme) => update((s) => ({ ...s, theme }));

/* ---------- listings ---------- */
export function saveListing(input: unknown, existingId?: string): Listing {
  const data = ListingInput.parse(input);
  const s = view;
  if (!s.account || !s.profile) throw new StoreError("Sign up or log in before posting a room.");
  if (existingId) {
    const cur = s.myListings.find((l) => l.id === existingId);
    if (!cur) throw new StoreError("You can only edit rooms you posted.");
    const next: Listing = { ...cur, ...data, updatedAt: Date.now() };
    update((x) => ({ ...x, myListings: x.myListings.map((l) => (l.id === existingId ? next : l)) }));
    return next;
  }
  const l: Listing = {
    ...data, id: id("my"), ownerId: s.account.id, ownerName: s.profile.name,
    verified: { id: false, property: false, visited: false }, createdAt: Date.now(), status: "active", demo: false,
  };
  update((x) => ({ ...x, myListings: [l, ...x.myListings] }));
  return l;
}
export function setListingStatus(lid: string, status: Listing["status"]) {
  if (!view.myListings.some((l) => l.id === lid)) throw new StoreError("You can only change rooms you posted.");
  update((s) => ({ ...s, myListings: s.myListings.map((l) => (l.id === lid ? { ...l, status, updatedAt: Date.now() } : l)) }));
}
export function deleteListing(lid: string) {
  if (!view.myListings.some((l) => l.id === lid)) throw new StoreError("You can only delete rooms you posted.");
  update((s) => ({ ...s, myListings: s.myListings.filter((l) => l.id !== lid), saved: s.saved.filter((x) => x !== lid), visits: s.visits.filter((v) => v.listingId !== lid) }));
}
export function toggleSaved(lid: string): boolean {
  const on = !view.saved.includes(lid);
  update((s) => ({ ...s, saved: on ? [lid, ...s.saved] : s.saved.filter((x) => x !== lid) }));
  return on;
}

/* ---------- messaging (phone numbers never leave the thread) ---------- */
export function openThread(target: { listing?: Listing; seeker?: Seeker }): Thread {
  if (!view.account || !view.profile) throw new StoreError("Sign up or log in before messaging.");
  if (target.listing && isMine(target.listing)) throw new StoreError("This is your own room.");
  const withId = target.listing ? target.listing.ownerId : target.seeker!.id;
  const existing = view.threads.find((t) => t.withId === withId && t.listingId === (target.listing?.id ?? null));
  if (existing) return existing;
  const t: Thread = {
    id: id("t"), listingId: target.listing?.id ?? null, seekerId: target.seeker?.id ?? null,
    withName: target.listing ? target.listing.ownerName : target.seeker!.name, withId,
    createdAt: Date.now(), lastAt: Date.now(), readAt: Date.now(),
  };
  update((s) => ({ ...s, threads: [t, ...s.threads] }));
  return t;
}

const pending = new Set<string>();
export function sendMessage(threadId: string, raw: string): Message {
  const text = MessageText.parse(raw);
  const t = view.threads.find((x) => x.id === threadId);
  if (!t) throw new StoreError("This conversation no longer exists.");
  const { text: safe, redacted } = redactContacts(text);
  const m: Message = { id: id("m"), threadId, from: "me", text: safe, at: Date.now(), redacted };
  update((s) => ({ ...s, messages: [...s.messages, m], threads: s.threads.map((x) => (x.id === threadId ? { ...x, lastAt: m.at, readAt: m.at } : x)) }));
  scheduleDemoReply(t, redacted);
  return m;
}
export const isTyping = (threadId: string) => pending.has(threadId);
export function markRead(threadId: string) {
  const t = view.threads.find((x) => x.id === threadId);
  if (!t) return;
  const latest = Math.max(t.readAt, ...view.messages.filter((m) => m.threadId === threadId).map((m) => m.at));
  if (latest > t.readAt) update((s) => ({ ...s, threads: s.threads.map((x) => (x.id === threadId ? { ...x, readAt: latest } : x)) }));
}
export function deleteThread(threadId: string) {
  update((s) => ({ ...s, threads: s.threads.filter((t) => t.id !== threadId), messages: s.messages.filter((m) => m.threadId !== threadId) }));
}

/** Demo accounts answer so the flow can be tried end to end. One reply per burst of messages. */
function scheduleDemoReply(t: Thread, redacted: boolean) {
  if (pending.has(t.id)) return;
  const owner = root.session;
  pending.add(t.id);
  const theirs = view.messages.filter((m) => m.threadId === t.id && m.from === "them").length;
  const listing = t.listingId ? findListing(t.listingId) : undefined;
  const first = listing
    ? `Hi! Thanks for reaching out about the room in ${listing.locality}. It's still available. When would you like to come and see it?`
    : "Hi! Nice to hear from you. Which areas are you looking at, and when do you want to move?";
  const follow = ["Sounds good. Book a visit slot from the listing page and I'll confirm it.", "Sure, happy to answer anything else here.", "Great, see you then!"];
  let text = theirs === 0 ? first : follow[Math.min(theirs - 1, follow.length - 1)];
  if (redacted) text = "Let's keep chatting here for now. Kamra keeps both our numbers private until we've met. " + text;
  listeners.forEach((l) => l());
  window.setTimeout(() => {
    pending.delete(t.id);
    // Only reply into the same account's inbox, and only if the thread still exists.
    if (root.session !== owner || !view.threads.some((x) => x.id === t.id)) { listeners.forEach((l) => l()); return; }
    const m: Message = { id: id("m"), threadId: t.id, from: "them", text, at: Date.now(), redacted: false };
    try { update((s) => ({ ...s, messages: [...s.messages, m], threads: s.threads.map((x) => (x.id === t.id ? { ...x, lastAt: m.at } : x)) })); } catch { /* storage full: drop the demo reply */ }
  }, 1400);
}

/* ---------- visits & reports ---------- */
export function requestVisit(listingId: string, slot: string, note: string): Visit {
  if (!view.account) throw new StoreError("Sign up or log in before booking a visit.");
  const when = new Date(slot);
  if (Number.isNaN(when.getTime())) throw new StoreError("Choose a date and time for the visit.");
  if (when.getTime() < Date.now() + 30 * 60_000) throw new StoreError("Pick a time at least 30 minutes from now.");
  const hour = when.getHours();
  if (hour < 8 || hour >= 21) throw new StoreError("Visits can be booked between 8 am and 9 pm.");
  if (view.visits.some((v) => v.listingId === listingId && v.status !== "cancelled")) throw new StoreError("You already have a visit booked for this room.");
  const l = findListing(listingId);
  if (!l) throw new StoreError("This room is no longer listed.");
  if (isMine(l)) throw new StoreError("This is your own room.");
  const v: Visit = { id: id("v"), listingId, slot, note: note.trim().slice(0, 300), status: "requested", createdAt: Date.now() };
  update((s) => ({ ...s, visits: [...s.visits, v] }));
  const owner = root.session;
  if (l.demo) window.setTimeout(() => {
    if (root.session === owner && view.visits.some((x) => x.id === v.id && x.status === "requested")) {
      update((s) => ({ ...s, visits: s.visits.map((x) => (x.id === v.id ? { ...x, status: "confirmed" } : x)) }));
    }
  }, 2000);
  return v;
}
export const cancelVisit = (vid: string) => update((s) => ({ ...s, visits: s.visits.map((v) => (v.id === vid ? { ...v, status: "cancelled" } : v)) }));

export function reportListing(listingId: string, reason: string, detail: string) {
  if (!reason) throw new StoreError("Choose a reason.");
  if (view.reports.some((r) => r.listingId === listingId)) throw new StoreError("You've already reported this room. Our team will review it.");
  update((s) => ({ ...s, reports: [...s.reports, { id: id("r"), listingId, reason, detail: detail.trim().slice(0, 500), at: Date.now() }] }));
}
