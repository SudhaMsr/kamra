import { useEffect, useRef, useState, type FormEvent } from "react";
import { LuArrowLeft, LuInbox, LuLock, LuSend, LuTrash2 } from "react-icons/lu";
import { Avatar, Dialog, Empty, useToast } from "../components/ui";
import { deleteThread, findListing, markRead, sendMessage, useStore } from "../data/store";
import { errorMessage } from "../lib/errors";
import { relTime } from "../lib/format";
import { Link, navigate, useTitle } from "../lib/router";

export function Messages({ threadId }: { threadId?: string }) {
  const threads = useStore((s) => [...s.threads].sort((a, b) => b.lastAt - a.lastAt));
  const messages = useStore((s) => s.messages);
  useTitle("Messages");
  const current = threads.find((t) => t.id === threadId);

  if (threads.length === 0) {
    return (
      <div className="wrap max-w-2xl py-10">
        <Empty page icon={<LuInbox size={26} />} title="No conversations yet" body="When you message a lister or a flatmate, the conversation shows up here. Your phone number is never shared."
          action={<Link to="/search" className="btn-primary">Find a room</Link>} />
      </div>
    );
  }

  return (
    <div className="wrap grid gap-4 py-6 md:grid-cols-[20rem_1fr]">
      <section aria-labelledby="inbox-h" className={`${current ? "hidden md:grid" : "grid"} content-start gap-3`}>
        <h1 id="inbox-h" className="text-2xl font-extrabold">Messages</h1>
        <ul className="grid gap-1">
          {threads.map((t) => {
            const msgs = messages.filter((m) => m.threadId === t.id);
            const last = msgs[msgs.length - 1];
            const unread = msgs.filter((m) => m.from === "them" && m.at > t.readAt).length;
            const listing = t.listingId ? findListing(t.listingId) : undefined;
            return (
              <li key={t.id}>
                <Link to={`/messages/${t.id}`} className={`flex items-center gap-3 rounded-xl p-3 ${t.id === threadId ? "bg-brand-soft" : "hover:bg-raised"}`}>
                  <Avatar name={t.withName} />
                  <span className="grid min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate ${unread ? "font-bold" : "font-semibold"}`}>{t.withName}</span>
                      <span className="shrink-0 text-xs text-muted">{relTime(t.lastAt)}</span>
                    </span>
                    <span className="truncate text-sm text-muted">{listing ? listing.locality + " · " : ""}{last ? (last.from === "me" ? "You: " : "") + last.text : "No messages yet"}</span>
                  </span>
                  {unread > 0 && <span className="rounded-full bg-marigold px-2 text-xs font-bold text-ink">{unread}<span className="sr-only"> unread</span></span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      {current ? <Conversation key={current.id} threadId={current.id} /> : (
        <div className="card hidden place-items-center p-10 text-center text-muted md:grid">Choose a conversation.</div>
      )}
    </div>
  );
}

function Conversation({ threadId }: { threadId: string }) {
  const thread = useStore((s) => s.threads.find((t) => t.id === threadId))!;
  const msgs = useStore((s) => s.messages.filter((m) => m.threadId === threadId));
  const listing = thread.listingId ? findListing(thread.listingId) : undefined;
  const [text, setText] = useState("");
  const [err, setErr] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => { markRead(threadId); endRef.current?.scrollIntoView({ block: "end" }); }, [threadId, msgs.length]);

  const send = (e: FormEvent) => {
    e.preventDefault();
    try {
      const m = sendMessage(threadId, text);
      setText(""); setErr(undefined);
      if (m.redacted) toast("We hid the phone number or email. Share contact details in person once you've met.");
    } catch (x) { setErr(errorMessage(x)); }
  };

  return (
    <section aria-label={`Conversation with ${thread.withName}`} className="card flex min-h-[70vh] flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line p-3">
        <Link to="/messages" className="btn-ghost p-2 md:hidden" aria-label="Back to all messages"><LuArrowLeft aria-hidden /></Link>
        <Avatar name={thread.withName} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold">{thread.withName}</h2>
          {listing && <Link to={`/rooms/${listing.id}`} className="block truncate text-sm text-brand hover:underline">{listing.title}</Link>}
        </div>
        <button type="button" className="btn-ghost p-2" onClick={() => setConfirm(true)} aria-label="Delete conversation"><LuTrash2 aria-hidden /></button>
      </header>
      <ol className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite" aria-label="Messages">
        <li className="mx-auto mb-2 flex max-w-sm items-center gap-2 rounded-xl bg-raised px-3 py-2 text-center text-xs text-muted"><LuLock aria-hidden className="shrink-0" />Phone numbers and emails are hidden in chat. Meet first, then share.</li>
        {msgs.map((m) => (
          <li key={m.id} className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.from === "me" ? "self-end rounded-br-md bg-brand text-brand-ink" : "self-start rounded-bl-md bg-raised"}`}>
            <span className="sr-only">{m.from === "me" ? "You" : thread.withName}: </span>
            <p className="whitespace-pre-wrap break-words">{m.text}</p>
            <p className={`mt-0.5 text-[0.7rem] ${m.from === "me" ? "text-brand-ink/75" : "text-muted"}`}>{relTime(m.at)}{m.redacted ? " · contact details hidden" : ""}</p>
          </li>
        ))}
        <div ref={endRef} />
      </ol>
      <form onSubmit={send} className="grid gap-1 border-t border-line p-3">
        <div className="flex items-end gap-2">
          <label htmlFor="compose" className="sr-only">Write a message</label>
          <textarea id="compose" rows={1} maxLength={1000} value={text} placeholder="Write a message" aria-invalid={!!err} aria-describedby={err ? "compose-err" : undefined}
            onChange={(e) => { setText(e.target.value); setErr(undefined); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            className="input max-h-40 min-h-[2.75rem] resize-y" />
          <button type="submit" className="btn-primary h-11 w-11 shrink-0 p-0" aria-label="Send" disabled={!text.trim()}><LuSend aria-hidden /></button>
        </div>
        {err && <p id="compose-err" className="error">{err}</p>}
      </form>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Delete this conversation?">
        <p>It will be removed from this device.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
          <button type="button" className="btn-danger" onClick={() => { deleteThread(threadId); navigate("/messages", { replace: true }); }}>Delete</button>
        </div>
      </Dialog>
    </section>
  );
}
