import { useRef, useSyncExternalStore } from "react";
import { redactContacts } from "../domain/privacy";
import { ListingInput, MessageText, Profile, type Listing, type Message, type Report, type Seeker, type Thread, type Visit } from "../domain/types";
import { DEMO_LISTINGS, DEMO_SEEKERS } from "./demo";

const KEY = "kamra:v1";
export type Theme = "system" | "light" | "dark";

export type State = {
  v: 1;
  profile: Profile | null;
  myListings: Listing[];
  saved: string[];
  threads: Thread[];
  messages: Message[];
  visits: Visit[];
  reports: Report[];
  theme: Theme;
};

const empty = (): State => ({ v: 1, profile: null, myListings: [], saved: [], threads: [], messages: [], visits: [], reports: [], theme: "system" });

export class StoreError extends Error {}

function id(prefix: string): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return prefix + Date.now().toString(36) + [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validates what came out of storage. Anything malformed is dropped rather than crashing the app. */
function sanitize(raw: unknown): State {
  const s = empty();
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 1) return s;
  const r = raw as Partial<State>;
  const arr = <T,>(x: unknown, ok: (i: any) => boolean): T[] => (Array.isArray(x) ? x.filter(ok) : []);
  const p = Profile.safeParse(r.profile);
  s.profile = p.success ? p.data : null;
  s.myListings = arr<Listing>(r.myListings, (l) => l && typeof l.id === "string" && ListingInput.safeParse(l).success);
  s.saved = arr<string>(r.saved, (x) => typeof x === "string");
  s.threads = arr<Thread>(r.threads, (t) => t && typeof t.id === "string" && typeof t.withName === "string");
  const threadIds = new Set(s.threads.map((t) => t.id));
  s.messages = arr<Message>(r.messages, (m) => m && threadIds.has(m.threadId) && typeof m.text === "string");
  s.visits = arr<Visit>(r.visits, (v) => v && typeof v.listingId === "string" && typeof v.slot === "string");
  s.reports = arr<Report>(r.reports, (x) => x && typeof x.listingId === "string");
  s.theme = r.theme === "light" || r.theme === "dark" ? r.theme : "system";
  return s;
}

let storageAvailable = true;
let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    try { return sanitize(JSON.parse(raw)); }
    catch { localStorage.setItem(KEY + ":corrupt:" + Date.now(), raw); return empty(); }
  } catch { storageAvailable = false; return empty(); }
}

function commit(next: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      throw new StoreError("Your browser's storage is full. Remove a few photos and try again.");
    }
    storageAvailable = false; // private mode etc: keep working in memory
  }
  state = next;
  listeners.forEach((l) => l());
}
const update = (fn: (s: State) => State) => commit(fn(state));

// Keep several open tabs consistent.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = e.newValue ? (() => { try { return sanitize(JSON.parse(e.newValue!)); } catch { return state; } })() : empty();
    listeners.forEach((l) => l());
  });
}

export const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const getState = () => state;
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
    if (c.s === state && c.v !== undefined) return c.v as T;
    const v = select(state);
    const stable = c.s !== null && shallowEqual(v, c.v) ? (c.v as T) : v;
    cache.current = { s: state, v: stable };
    return stable;
  };
  return useSyncExternalStore(subscribe, get, get);
}

/* ---------- reads ---------- */
export const allListings = (s: State = state): Listing[] => [...s.myListings, ...DEMO_LISTINGS];
export const findListing = (lid: string, s: State = state) => allListings(s).find((l) => l.id === lid);
export const allSeekers = (): Seeker[] => DEMO_SEEKERS;
export const findSeeker = (sid: string) => DEMO_SEEKERS.find((x) => x.id === sid);
export const unreadCount = (s: State) =>
  s.threads.reduce((n, t) => n + s.messages.filter((m) => m.threadId === t.id && m.from === "them" && m.at > t.readAt).length, 0);

/* ---------- profile & settings ---------- */
export function saveProfile(input: unknown): Profile {
  const p = Profile.parse(input);
  update((s) => ({ ...s, profile: p }));
  return p;
}
export const setTheme = (theme: Theme) => update((s) => ({ ...s, theme }));
export function resetAll() { commit(empty()); }

/* ---------- listings ---------- */
export function saveListing(input: unknown, existingId?: string): Listing {
  const data = ListingInput.parse(input);
  const s = state;
  if (!s.profile) throw new StoreError("Create your profile before posting a room.");
  if (existingId) {
    const cur = s.myListings.find((l) => l.id === existingId);
    if (!cur) throw new StoreError("You can only edit rooms you posted.");
    const next: Listing = { ...cur, ...data, updatedAt: Date.now() };
    update((x) => ({ ...x, myListings: x.myListings.map((l) => (l.id === existingId ? next : l)) }));
    return next;
  }
  const l: Listing = {
    ...data, id: id("my"), ownerId: "me", ownerName: s.profile.name,
    verified: { id: false, property: false, visited: false }, createdAt: Date.now(), status: "active", demo: false,
  };
  update((x) => ({ ...x, myListings: [l, ...x.myListings] }));
  return l;
}
export function setListingStatus(lid: string, status: Listing["status"]) {
  if (!state.myListings.some((l) => l.id === lid)) throw new StoreError("You can only change rooms you posted.");
  update((s) => ({ ...s, myListings: s.myListings.map((l) => (l.id === lid ? { ...l, status, updatedAt: Date.now() } : l)) }));
}
export function deleteListing(lid: string) {
  if (!state.myListings.some((l) => l.id === lid)) throw new StoreError("You can only delete rooms you posted.");
  update((s) => ({ ...s, myListings: s.myListings.filter((l) => l.id !== lid), saved: s.saved.filter((x) => x !== lid), visits: s.visits.filter((v) => v.listingId !== lid) }));
}
export function toggleSaved(lid: string): boolean {
  const on = !state.saved.includes(lid);
  update((s) => ({ ...s, saved: on ? [lid, ...s.saved] : s.saved.filter((x) => x !== lid) }));
  return on;
}

/* ---------- messaging (phone numbers never leave the thread) ---------- */
export function openThread(target: { listing?: Listing; seeker?: Seeker }): Thread {
  if (!state.profile) throw new StoreError("Create your profile before messaging.");
  const withId = target.listing ? target.listing.ownerId : target.seeker!.id;
  if (withId === "me") throw new StoreError("This is your own room.");
  const existing = state.threads.find((t) => t.withId === withId && t.listingId === (target.listing?.id ?? null));
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
  const t = state.threads.find((x) => x.id === threadId);
  if (!t) throw new StoreError("This conversation no longer exists.");
  const { text: safe, redacted } = redactContacts(text);
  const m: Message = { id: id("m"), threadId, from: "me", text: safe, at: Date.now(), redacted };
  update((s) => ({ ...s, messages: [...s.messages, m], threads: s.threads.map((x) => (x.id === threadId ? { ...x, lastAt: m.at, readAt: m.at } : x)) }));
  scheduleDemoReply(t, redacted);
  return m;
}
export function markRead(threadId: string) {
  const t = state.threads.find((x) => x.id === threadId);
  if (!t) return;
  const latest = Math.max(t.readAt, ...state.messages.filter((m) => m.threadId === threadId).map((m) => m.at));
  if (latest > t.readAt) update((s) => ({ ...s, threads: s.threads.map((x) => (x.id === threadId ? { ...x, readAt: latest } : x)) }));
}
export function deleteThread(threadId: string) {
  update((s) => ({ ...s, threads: s.threads.filter((t) => t.id !== threadId), messages: s.messages.filter((m) => m.threadId !== threadId) }));
}

/** Demo accounts answer so the flow can be tried end to end. One reply per burst of messages. */
function scheduleDemoReply(t: Thread, redacted: boolean) {
  if (pending.has(t.id)) return;
  pending.add(t.id);
  const theirs = state.messages.filter((m) => m.threadId === t.id && m.from === "them").length;
  const listing = t.listingId ? findListing(t.listingId) : undefined;
  const first = listing
    ? `Hi! Thanks for reaching out about the room in ${listing.locality}. It's still available. When would you like to come and see it?`
    : "Hi! Nice to hear from you. Which areas are you looking at, and when do you want to move?";
  const follow = ["Sounds good. Book a visit slot from the listing page and I'll confirm it.", "Sure, happy to answer anything else here.", "Great, see you then!"];
  let text = theirs === 0 ? first : follow[Math.min(theirs - 1, follow.length - 1)];
  if (redacted) text = "Let's keep chatting here for now. Kamra keeps both our numbers private until we've met. " + text;
  window.setTimeout(() => {
    pending.delete(t.id);
    if (!state.threads.some((x) => x.id === t.id)) return;
    const m: Message = { id: id("m"), threadId: t.id, from: "them", text, at: Date.now(), redacted: false };
    try { update((s) => ({ ...s, messages: [...s.messages, m], threads: s.threads.map((x) => (x.id === t.id ? { ...x, lastAt: m.at } : x)) })); } catch { /* storage full: drop the demo reply */ }
  }, 1400);
}

/* ---------- visits & reports ---------- */
export function requestVisit(listingId: string, slot: string, note: string): Visit {
  if (!state.profile) throw new StoreError("Create your profile before booking a visit.");
  const when = new Date(slot);
  if (Number.isNaN(when.getTime())) throw new StoreError("Choose a date and time for the visit.");
  if (when.getTime() < Date.now() + 30 * 60_000) throw new StoreError("Pick a time at least 30 minutes from now.");
  const hour = when.getHours();
  if (hour < 8 || hour >= 21) throw new StoreError("Visits can be booked between 8 am and 9 pm.");
  if (state.visits.some((v) => v.listingId === listingId && v.status !== "cancelled")) throw new StoreError("You already have a visit booked for this room.");
  const l = findListing(listingId);
  if (!l) throw new StoreError("This room is no longer listed.");
  if (l.ownerId === "me") throw new StoreError("This is your own room.");
  const v: Visit = { id: id("v"), listingId, slot, note: note.trim().slice(0, 300), status: "requested", createdAt: Date.now() };
  update((s) => ({ ...s, visits: [...s.visits, v] }));
  if (l.demo) window.setTimeout(() => {
    if (state.visits.some((x) => x.id === v.id && x.status === "requested")) update((s) => ({ ...s, visits: s.visits.map((x) => (x.id === v.id ? { ...x, status: "confirmed" } : x)) }));
  }, 2000);
  return v;
}
export const cancelVisit = (vid: string) => update((s) => ({ ...s, visits: s.visits.map((v) => (v.id === vid ? { ...v, status: "cancelled" } : v)) }));

export function reportListing(listingId: string, reason: string, detail: string) {
  if (!reason) throw new StoreError("Choose a reason.");
  if (state.reports.some((r) => r.listingId === listingId)) throw new StoreError("You've already reported this room. Our team will review it.");
  update((s) => ({ ...s, reports: [...s.reports, { id: id("r"), listingId, reason, detail: detail.trim().slice(0, 500), at: Date.now() }] }));
}
