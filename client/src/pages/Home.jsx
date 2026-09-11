import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="max-w-2xl">
        <p className="text-sm uppercase tracking-wide text-forest">
          Inspired by PERTAPIS's community programmes
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-ink">
          Find the volunteering that fits your life, not the other way around.
        </h1>
        <p className="mt-5 text-lg text-ink/80">
          Youth mentoring, senior befriending, education support, welfare-home visits,
          and fundraising drives — one place to discover an opportunity, apply, and
          track the hours you give back.
        </p>

        <div className="mt-8 flex gap-4">
          <Link
            to="/opportunities"
            className="rounded bg-forest px-5 py-3 font-medium text-white hover:bg-forest-dark"
          >
            Explore opportunities
          </Link>
          <Link
            to="/register"
            className="rounded border border-line px-5 py-3 font-medium hover:border-forest hover:text-forest"
          >
            Become a volunteer
          </Link>
        </div>
      </div>

      <div className="mt-16 grid gap-6 border-t border-line pt-10 sm:grid-cols-3">
        <div className="border-l-4 border-l-marigold pl-4">
          <h2 className="font-display text-lg font-semibold">One-time events</h2>
          <p className="mt-1 text-sm text-ink/70">
            Flag Day, workshops, and community drives — a single shift, simply booked.
          </p>
        </div>
        <div className="border-l-4 border-l-forest pl-4">
          <h2 className="font-display text-lg font-semibold">Recurring programmes</h2>
          <p className="mt-1 text-sm text-ink/70">
            Weekly or monthly commitments, like education support or community outreach.
          </p>
        </div>
        <div className="border-l-4 border-l-teal pl-4">
          <h2 className="font-display text-lg font-semibold">Long-term mentoring</h2>
          <p className="mt-1 text-sm text-ink/70">
            Structured, ongoing support that requires briefing and coordinator approval.
          </p>
        </div>
      </div>
    </div>
  );
}
