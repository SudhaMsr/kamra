import { LuBadgeCheck, LuFlag, LuIndianRupee, LuLock, LuPhoneOff, LuShieldCheck } from "react-icons/lu";
import { Link, useTitle } from "../lib/router";
import { Mascot } from "../components/ui";

export function Safety() {
  useTitle("Safety and privacy");
  const items = [
    [LuIndianRupee, "Never pay before you visit", "The most common rental scam in India asks for a “token”, “gate pass” or “booking amount” over UPI before you've seen the place. Kamra never asks for this, and genuine listers don't either. If someone does, report the listing."],
    [LuPhoneOff, "Your number stays private", "Chat happens inside Kamra. Indian mobile numbers, emails and spelled-out numbers typed into messages are hidden automatically, so nobody gets your contact details until you choose to share them in person."],
    [LuBadgeCheck, "Look for verification badges", "ID verified means the lister confirmed their identity. Property verified means they showed a rent agreement or ownership proof. Kamra visited means our team has seen the room."],
    [LuShieldCheck, "Visit safely", "Book visits in daylight where you can, tell a friend where you're going, and only share your exact address after a visit is confirmed."],
    [LuLock, "Your data, your device", "In this demo edition, your profile, listings and messages are stored only in your browser. You can delete all of it from your profile page at any time."],
    [LuFlag, "Report anything off", "Every listing has a report link. Listings with repeated reports are paused while our team reviews them."],
  ] as const;
  return (
    <div className="wrap grid max-w-3xl gap-8 py-10">
      <div className="grid gap-2">
        <p className="eyebrow">Safety and privacy</p>
        <h1 className="text-4xl font-extrabold">How Kamra keeps you safe</h1>
        <p className="text-lg text-muted">Renting a room means trusting strangers. These are the rules we build around.</p>
      </div>
      <ul className="grid gap-4">
        {items.map(([I, t, b]) => (
          <li key={t} className="card flex gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><I aria-hidden size={22} /></span>
            <div className="grid gap-1"><h2 className="text-lg font-bold">{t}</h2><p className="text-muted">{b}</p></div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">In an emergency, call 112. To report cyber fraud in India, call 1930 or visit cybercrime.gov.in.</p>
    </div>
  );
}

export function NotFoundPage() {
  useTitle("Page not found");
  return (
    <div className="wrap grid max-w-xl justify-items-start gap-4 py-16">
      <Mascot size={110} mood="lost" />
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-4xl font-extrabold">This page doesn't exist</h1>
      <p className="text-muted">The link may be old, or the room may have been taken down.</p>
      <div className="flex gap-2"><Link to="/" className="btn-primary">Go home</Link><Link to="/search" className="btn-secondary">Search rooms</Link></div>
    </div>
  );
}
