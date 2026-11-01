import { Mascot } from "../components/ui";
import { Link, useTitle } from "../lib/router";

export function NotFound({ what }: { what: string }) {
  useTitle(`${what[0].toUpperCase()}${what.slice(1)} not found`);
  return (
    <div className="wrap grid max-w-xl justify-items-start gap-4 py-16">
      <Mascot size={110} mood="lost" />
      <h1 className="text-3xl font-extrabold">We couldn't find that {what}</h1>
      <p className="text-muted">It may have been let or taken down by the lister.</p>
      <Link to="/search" className="btn-primary">Search rooms</Link>
    </div>
  );
}
