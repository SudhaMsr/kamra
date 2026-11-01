import { useState } from "react";
import { LuBookmark, LuCalendar, LuEye, LuHouse, LuPause, LuPencil, LuPlay, LuPlus, LuTrash2 } from "react-icons/lu";
import { ListingCard } from "../components/ListingCard";
import { Burst, Dialog, Empty, RoomArt, useToast } from "../components/ui";
import { cancelVisit, deleteListing, findListing, setListingStatus, toggleSaved, useStore } from "../data/store";
import { fitListing } from "../domain/fit";
import { distanceM } from "../domain/geo";
import { landmarksIn } from "../domain/landmarks";
import { ROOM_TYPES } from "../domain/types";
import { errorMessage } from "../lib/errors";
import { inr, niceSlot, relTime } from "../lib/format";
import { Link, useTitle } from "../lib/router";

export function Saved() {
  useTitle("Saved rooms");
  const ids = useStore((s) => s.saved);
  const profile = useStore((s) => s.profile);
  const toast = useToast();
  const items = ids.map((id) => findListing(id)).filter((l): l is NonNullable<typeof l> => !!l);
  return (
    <div className="wrap grid max-w-4xl gap-6 py-8">
      <h1 className="text-3xl font-extrabold">Saved rooms</h1>
      {items.length === 0 ? (
        <Empty icon={<LuBookmark size={26} />} title="Nothing saved yet" body="Tap the bookmark on any room to keep it here while you compare." action={<Link to="/search" className="btn-primary">Find a room</Link>} />
      ) : (
        <ul className="@container grid gap-4">
          {items.map((l) => {
            const hub = landmarksIn(l.city).map((m) => ({ m, d: distanceM(m.lat, m.lng, l.lat, l.lng) })).sort((a, b) => a.d - b.d)[0];
            return (
              <li key={l.id}>
                <ListingCard result={{ listing: l, distance: hub.d, fit: profile ? fitListing(l, profile) : null }} landmark={hub.m.short} saved
                  onToggleSave={() => { toggleSaved(l.id); toast("Removed from saved."); }} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MyRooms() {
  useTitle("Your listings");
  const mine = useStore((s) => s.myListings);
  const threads = useStore((s) => s.threads);
  const toast = useToast();
  const [del, setDel] = useState<string | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const act = (fn: () => void, msg: string) => { try { fn(); toast(msg); return true; } catch (e) { toast(errorMessage(e), "error"); return false; } };
  const markLet = (id: string) => {
    if (!act(() => setListingStatus(id, "let"), "Marked as let. Congratulations!")) return;
    setCheer(id);
    window.setTimeout(() => setCheer((c) => (c === id ? null : c)), 900);
  };
  return (
    <div className="wrap grid max-w-4xl gap-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Your listings</h1>
        <Link to="/post" className="btn-primary"><LuPlus aria-hidden />List a room</Link>
      </div>
      {mine.length === 0 ? (
        <Empty icon={<LuHouse size={26} />} title="You haven't listed a room" body="Listing is free and takes about five minutes. People nearby see how well they'd fit with your household." action={<Link to="/post" className="btn-primary">List a room</Link>} />
      ) : (
        <ul className="grid gap-4">
          {mine.map((l) => (
            <li key={l.id} className="card relative grid gap-4 p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center">
              {cheer === l.id && <Burst />}
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-raised">
                {l.photos[0] ? <img src={l.photos[0]} alt="" className="h-full w-full object-cover" /> : <RoomArt seed={l.id} className="h-full w-full" />}
              </div>
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`tag ${l.status === "active" ? "tag-ok" : l.status === "let" ? "tag-brand" : "tag-warn"}`}>{l.status === "active" ? "Live" : l.status === "let" ? "Let" : "Paused"}</span>
                  <span className="tag">{ROOM_TYPES[l.roomType]}</span>
                </div>
                <h2 className="text-lg font-bold">{l.title}</h2>
                <p className="text-sm text-muted">{l.locality}, {l.city} · <span className="font-mono">{inr(l.rent)}</span> · posted {relTime(l.createdAt)} · {threads.filter((t) => t.listingId === l.id).length} conversations</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-col">
                <Link to={`/rooms/${l.id}`} className="btn-ghost"><LuEye aria-hidden />View</Link>
                <Link to={`/post?edit=${l.id}`} className="btn-ghost"><LuPencil aria-hidden />Edit</Link>
                {l.status === "active"
                  ? <button type="button" className="btn-ghost" onClick={() => act(() => setListingStatus(l.id, "paused"), "Paused. It's hidden from search.")}><LuPause aria-hidden />Pause</button>
                  : <button type="button" className="btn-ghost" onClick={() => act(() => setListingStatus(l.id, "active"), "Live again.")}><LuPlay aria-hidden />Make live</button>}
                {l.status !== "let" && <button type="button" className="btn-ghost" onClick={() => markLet(l.id)}>Mark as let</button>}
                <button type="button" className="btn-ghost text-warn" onClick={() => setDel(l.id)}><LuTrash2 aria-hidden />Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!del} onClose={() => setDel(null)} title="Delete this listing?">
        <p>It will disappear from search and saved lists. This can't be undone.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setDel(null)}>Cancel</button>
          <button type="button" className="btn-danger" onClick={() => { act(() => deleteListing(del!), "Listing deleted."); setDel(null); }}>Delete listing</button>
        </div>
      </Dialog>
    </div>
  );
}

export function Visits() {
  useTitle("Visits");
  const visits = useStore((s) => [...s.visits].sort((a, b) => a.slot.localeCompare(b.slot)));
  const toast = useToast();
  return (
    <div className="wrap grid max-w-3xl gap-6 py-8">
      <h1 className="text-3xl font-extrabold">Your visits</h1>
      {visits.length === 0 ? (
        <Empty icon={<LuCalendar size={26} />} title="No visits booked" body="Book a visit from any room page. The lister confirms the slot, and the exact address is shared once confirmed." action={<Link to="/search" className="btn-primary">Find a room</Link>} />
      ) : (
        <ul className="grid gap-3">
          {visits.map((v) => {
            const l = findListing(v.listingId);
            const past = new Date(v.slot).getTime() < Date.now();
            return (
              <li key={v.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="grid gap-1">
                  <span className={`tag w-fit ${v.status === "confirmed" ? "tag-ok" : v.status === "cancelled" ? "tag-warn" : "tag-brand"}`}>
                    {v.status === "confirmed" ? (past ? "Visited" : "Confirmed") : v.status === "cancelled" ? "Cancelled" : "Waiting for lister"}
                  </span>
                  <p className="font-bold">{niceSlot(v.slot)}</p>
                  {l ? <Link to={`/rooms/${l.id}`} className="text-sm text-brand hover:underline">{l.title}, {l.locality}</Link> : <span className="text-sm text-muted">This room was removed.</span>}
                  {v.note && <p className="text-sm text-muted">Note: {v.note}</p>}
                </div>
                {v.status !== "cancelled" && !past && <button type="button" className="btn-ghost text-warn" onClick={() => { cancelVisit(v.id); toast("Visit cancelled."); }}>Cancel visit</button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
