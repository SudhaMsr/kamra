import { useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  LuArrowLeft, LuBookmark, LuCalendar, LuCigarette, LuCopy, LuFlag, LuLeaf, LuLock, LuMapPin, LuMessageCircle,
  LuPencil, LuPhoneOff, LuUsers, LuUtensils, LuWine,
} from "react-icons/lu";
import { Avatar, Dialog, Field, FitBadge, FitBreakdown, RoomArt, TrustTags, useToast } from "../components/ui";
import { findListing, isMine, openThread, reportListing, requestVisit, sendMessage, toggleSaved, useStore } from "../data/store";
import { fitListing, genderEligible } from "../domain/fit";
import { commuteMinutes, distanceM, formatCoord, formatDistance } from "../domain/geo";
import { KIND_LABEL, LANDMARKS } from "../domain/landmarks";
import { DIETS, FURNISHING, GENDERS, GUESTS, ROOM_TYPES, SHIFTS } from "../domain/types";
import { inr, isoLocalDateTime, niceDate, niceSlot } from "../lib/format";
import { errorMessage } from "../lib/errors";
import { shake } from "../lib/motion";
import { Link, navigate, useBack, useTitle } from "../lib/router";
import { NotFound } from "./NotFound";

export function ListingPage({ id }: { id: string }) {
  const listing = useStore((s) => findListing(id, s));
  const profile = useStore((s) => s.profile);
  const saved = useStore((s) => s.saved.includes(id));
  const visit = useStore((s) => s.visits.find((v) => v.listingId === id && v.status !== "cancelled"));
  const reported = useStore((s) => s.reports.some((r) => r.listingId === id));
  const back = useBack("/search");
  const toast = useToast();
  const [photo, setPhoto] = useState(0);
  const [dlg, setDlg] = useState<null | "message" | "visit" | "report">(null);
  useTitle(listing ? `${listing.title}, ${listing.locality}` : "Room not found");

  const nearby = useMemo(() => listing
    ? LANDMARKS.filter((l) => l.city === listing.city).map((l) => ({ l, d: distanceM(l.lat, l.lng, listing.lat, listing.lng) })).sort((a, b) => a.d - b.d).slice(0, 4)
    : [], [listing]);

  if (!listing) return <NotFound what="room" />;
  const l = listing;
  const mine = isMine(l);
  const fit = profile ? fitListing(l, profile) : null;
  const eligible = !profile || genderEligible(l.gender, profile.gender);
  const needProfile = (next: typeof dlg) => { if (!profile) { toast("Sign up or log in first, so the lister knows who's asking.", "error"); navigate("/signup?next=" + encodeURIComponent(`/rooms/${l.id}`)); return; } setDlg(next); };

  const copyLink = async () => {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); toast("Link copied."); }
    catch { toast("Couldn't copy automatically. Copy the address from your browser bar.", "error"); }
  };

  const rules: Array<[typeof LuLeaf, string, string]> = [
    [LuLeaf, "Kitchen", DIETS[l.diet]],
    [LuUsers, "Who can live here", GENDERS[l.gender]],
    [LuUsers, "Guests", GUESTS[l.guests]],
    [LuCigarette, "Smoking", l.smoking ? "Allowed" : "Not allowed"],
    [LuWine, "Drinking", l.drinking ? "Allowed" : "Not allowed"],
    [LuUtensils, "Furnishing", FURNISHING[l.furnishing]],
  ];

  return (
    <div className="wrap grid gap-6 py-6">
      <button type="button" onClick={back} className="btn-ghost justify-self-start -ml-3"><LuArrowLeft aria-hidden />Back to results</button>

      {l.status !== "active" && <p className="rounded-xl bg-warn-soft px-4 py-3 font-semibold text-warn">{l.status === "let" ? "This room has been let and is no longer available." : "This listing is paused and hidden from search."}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-8">
          <section aria-label="Photos" className="grid gap-2">
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-raised">
              {l.photos.length > 0
                ? <img src={l.photos[photo]} alt={`Photo ${photo + 1} of ${l.photos.length}`} className="h-full w-full object-cover" />
                : <RoomArt seed={l.id} label="Illustration of the room. The lister hasn't added photos yet." className="h-full w-full" />}
            </div>
            {l.photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose photo">
                {l.photos.map((p, i) => (
                  <button key={i} type="button" onClick={() => setPhoto(i)} aria-pressed={photo === i} aria-label={`Show photo ${i + 1}`}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ${photo === i ? "ring-brand" : "ring-transparent"}`}>
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <header className="grid gap-3">
            <div className="flex flex-wrap gap-1.5"><span className="tag tag-brand">{ROOM_TYPES[l.roomType]}</span><TrustTags l={l} />{l.demo && <span className="tag">Sample listing</span>}</div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">{l.title}</h1>
            <p className="flex items-center gap-1.5 text-muted"><LuMapPin aria-hidden />{l.locality}, {l.city}</p>
          </header>

          <section aria-labelledby="about-h" className="grid gap-3">
            <h2 id="about-h" className="text-xl font-bold">About the room</h2>
            <p className="max-w-[65ch] whitespace-pre-line">{l.description}</p>
            {l.amenities.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Included">
                {l.amenities.map((a) => <li key={a} className="tag py-1 text-sm">{a}</li>)}
              </ul>
            )}
          </section>

          <section aria-labelledby="rules-h" className="grid gap-3">
            <h2 id="rules-h" className="text-xl font-bold">House rules</h2>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rules.map(([I, k, v]) => (
                <div key={k} className="flex items-center gap-3 rounded-xl bg-raised px-3.5 py-3">
                  <I aria-hidden className="shrink-0 text-brand" size={20} />
                  <div><dt className="text-xs font-bold uppercase tracking-wider text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>
                </div>
              ))}
            </dl>
          </section>

          {fit && (
            <section aria-labelledby="fit-h" className="grid gap-3">
              <div className="flex items-center justify-between gap-3"><h2 id="fit-h" className="text-xl font-bold">How this flat fits you</h2><FitBadge fit={fit} /></div>
              <FitBreakdown fit={fit} />
              <p className="text-sm text-muted">Based on <Link to="/profile" className="font-semibold text-brand underline">your lifestyle</Link>. Clashes aren't deal-breakers; ask about them when you message.</p>
            </section>
          )}

          {l.household.length > 0 && (
            <section aria-labelledby="hh-h" className="grid gap-3">
              <h2 id="hh-h" className="text-xl font-bold">Who you'd live with</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {l.household.map((m, i) => (
                  <li key={i} className="card flex items-center gap-3 p-3">
                    <Avatar name={m.name} />
                    <div><p className="font-semibold">{m.name}, {m.age}</p><p className="text-sm text-muted">{m.work} · {SHIFTS[m.shift]}</p></div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="loc-h" className="grid gap-3">
            <h2 id="loc-h" className="text-xl font-bold">Location</h2>
            <p className="font-mono text-sm text-muted">{formatCoord(l.lat, l.lng)} <span className="font-sans">(approximate; exact address is shared after your visit is confirmed)</span></p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {nearby.map(({ l: m, d }) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
                  <span><span className="block font-semibold">{m.short}</span><span className="text-sm text-muted">{KIND_LABEL[m.kind]}</span></span>
                  <span className="text-right"><span className="block font-mono font-semibold">{formatDistance(d)}</span><span className="text-xs text-muted">≈ {commuteMinutes(d)} min</span></span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside aria-label="Rent and contact" className="lg:sticky lg:top-20 lg:self-start">
          <div className="card grid gap-4 p-5">
            <div className="flex items-end justify-between gap-3">
              <p><span className="font-mono text-3xl font-semibold">{inr(l.rent)}</span><span className="text-muted"> /month</span></p>
              {fit && <FitBadge fit={fit} compact />}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-raised p-3"><dt className="text-muted">Deposit</dt><dd className="font-mono font-semibold">{inr(l.deposit)}</dd></div>
              <div className="rounded-xl bg-raised p-3"><dt className="text-muted">Available</dt><dd className="font-semibold">{niceDate(l.availableFrom)}</dd></div>
            </dl>
            <div className="flex items-center gap-3 border-t border-line pt-4">
              <Avatar name={l.ownerName} size={44} />
              <div><p className="font-semibold">{mine ? "You" : l.ownerName}</p><p className="text-sm text-muted">{mine ? "Your listing" : "Lives in the flat"}</p></div>
            </div>

            {mine ? (
              <div className="grid gap-2">
                <Link to={`/post?edit=${l.id}`} className="btn-primary"><LuPencil aria-hidden />Edit listing</Link>
                <Link to="/my-rooms" className="btn-secondary">Manage your rooms</Link>
              </div>
            ) : !eligible ? (
              <p className="rounded-xl bg-warn-soft p-3 text-sm font-semibold text-warn">This room is {GENDERS[l.gender].toLowerCase()}, so it doesn't match your profile.</p>
            ) : l.status !== "active" ? null : (
              <div className="grid gap-2">
                <button type="button" className="btn-primary" onClick={() => needProfile("message")}><LuMessageCircle aria-hidden />Message {l.ownerName.split(" ")[0]}</button>
                {visit
                  ? <Link to="/visits" className="btn-secondary"><LuCalendar aria-hidden />Visit {visit.status === "confirmed" ? "confirmed" : "requested"}: {niceSlot(visit.slot)}</Link>
                  : <button type="button" className="btn-secondary" onClick={() => needProfile("visit")}><LuCalendar aria-hidden />Book a visit</button>}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" aria-pressed={saved} className="btn-ghost flex-1" onClick={() => toast(toggleSaved(l.id) ? "Saved." : "Removed from saved.")}>
                <LuBookmark key={String(saved)} aria-hidden className={saved ? "anim-pop fill-current text-marigold" : ""} />{saved ? "Saved" : "Save"}
              </button>
              <button type="button" className="btn-ghost flex-1" onClick={copyLink}><LuCopy aria-hidden />Copy link</button>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-raised p-3 text-sm text-muted">
              <LuPhoneOff aria-hidden className="mt-0.5 shrink-0" />Numbers stay private. Never pay a token or "gate pass" fee before you've seen the room in person.
            </p>
            {!mine && (
              <button type="button" className="justify-self-start text-sm font-semibold text-muted underline-offset-2 hover:text-warn hover:underline disabled:no-underline" disabled={reported} onClick={() => setDlg("report")}>
                <LuFlag aria-hidden className="mr-1 inline" />{reported ? "You reported this listing" : "Report this listing"}
              </button>
            )}
          </div>
        </aside>
      </div>

      <MessageDialog open={dlg === "message"} onClose={() => setDlg(null)} listingId={l.id} owner={l.ownerName} locality={l.locality} />
      <VisitDialog open={dlg === "visit"} onClose={() => setDlg(null)} listingId={l.id} />
      <ReportDialog open={dlg === "report"} onClose={() => setDlg(null)} listingId={l.id} />
    </div>
  );
}

function MessageDialog({ open, onClose, listingId, owner, locality }: { open: boolean; onClose: () => void; listingId: string; owner: string; locality: string }) {
  const toast = useToast();
  const profile = useStore((s) => s.profile);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const draft = profile ? `Hi ${owner.split(" ")[0]}, I'm ${profile.name.split(" ")[0]}, ${profile.age}, working as ${profile.work.toLowerCase()}. I'm interested in your room in ${locality}. Is it still available?` : "";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const l = findListing(listingId)!;
      const t = openThread({ listing: l });
      const m = sendMessage(t.id, text ?? draft);
      toast(m.redacted ? "Sent. We hid the phone number or email in your message." : "Message sent.");
      onClose(); setText(null);
      navigate(`/messages/${t.id}`);
    } catch (e) { setErr(errorMessage(e)); shake(formRef.current); }
  };
  return (
    <Dialog open={open} onClose={onClose} title={`Message ${owner.split(" ")[0]}`}>
      <form ref={formRef} onSubmit={submit} noValidate className="grid gap-4">
        <Field id="msg" label="Your message" hint="Your fit profile is shared with the lister. Phone numbers and emails are hidden automatically." error={err}>
          {(a) => <textarea {...a} rows={5} maxLength={1000} className="input" value={text ?? draft} onChange={(e) => { setText(e.target.value); setErr(undefined); }} />}
        </Field>
        <p className="flex items-center gap-2 text-sm text-muted"><LuLock aria-hidden />Messages stay inside Kamra.</p>
        <button type="submit" className="btn-primary">Send message</button>
      </form>
    </Dialog>
  );
}

function VisitDialog({ open, onClose, listingId }: { open: boolean; onClose: () => void; listingId: string }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(18, 0, 0, 0);
  const [slot, setSlot] = useState(isoLocalDateTime(tomorrow));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string>();
  const [booked, setBooked] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const min = isoLocalDateTime(new Date(Date.now() + 60 * 60_000));
  const close = () => { setBooked(null); onClose(); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try { const v = requestVisit(listingId, slot, note); setBooked(v.slot); }
    catch (e) { setErr(errorMessage(e)); shake(formRef.current); document.getElementById("slot")?.focus(); }
  };
  if (booked) {
    return (
      <Dialog open={open} onClose={close} title="Visit requested">
        <div className="grid justify-items-center gap-3 text-center">
          <svg viewBox="0 0 64 64" width="84" height="84" aria-hidden className="anim-pop">
            <rect x="8" y="12" width="48" height="44" rx="8" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="3" />
            <path d="M8 24h48" stroke="var(--brand)" strokeWidth="3" />
            <path d="M20 8v9M44 8v9" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
            <path d="M22 39l7 7 13-14" fill="none" stroke="var(--ok)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="anim-draw" style={{ "--len": 34, animationDelay: "220ms" } as CSSProperties} />
          </svg>
          <p className="text-lg font-bold">{niceSlot(booked)}</p>
          <p className="text-muted">We've asked the lister to confirm. You'll see the update under Visits, and the exact address is shared once it's confirmed.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={close}>Done</button>
            <Link to="/visits" className="btn-secondary" onClick={() => setBooked(null)}>See your visits</Link>
          </div>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onClose={close} title="Book a visit">
      <form ref={formRef} onSubmit={submit} noValidate className="grid gap-4">
        <Field id="slot" label="Date and time" hint="Between 8 am and 9 pm. The lister confirms or suggests another time." error={err}>
          {(a) => <input {...a} type="datetime-local" required min={min} step={900} className="input" value={slot} onChange={(e) => { setSlot(e.target.value); setErr(undefined); }} />}
        </Field>
        <Field id="note" label="Note (optional)" hint="For example, who's coming with you.">
          {(a) => <input {...a} maxLength={300} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <button type="submit" className="btn-primary">Request visit</button>
      </form>
    </Dialog>
  );
}

const REASONS = ["Asked me to pay a token or fee before visiting", "Photos or details don't match the room", "Room is already taken", "Broker posing as a flatmate", "Offensive or discriminatory content", "Something else"];
function ReportDialog({ open, onClose, listingId }: { open: boolean; onClose: () => void; listingId: string }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [err, setErr] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    try { reportListing(listingId, reason, detail); toast("Thanks. Our team will review this listing."); onClose(); }
    catch (e) { setErr(errorMessage(e)); shake(formRef.current); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Report this listing">
      <form ref={formRef} onSubmit={submit} noValidate className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="label mb-1">What's wrong?</legend>
          {REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => { setReason(r); setErr(undefined); }} className="accent-[var(--brand)]" />
              <span className="text-sm font-semibold">{r}</span>
            </label>
          ))}
        </fieldset>
        <Field id="detail" label="Details (optional)" error={err}>
          {(a) => <textarea {...a} rows={3} maxLength={500} className="input" value={detail} onChange={(e) => setDetail(e.target.value)} />}
        </Field>
        <button type="submit" className="btn-danger">Send report</button>
      </form>
    </Dialog>
  );
}
