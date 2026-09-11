import { useEffect, useState } from "react";
import { api } from "../lib/api";
import OpportunityCard from "../components/OpportunityCard";

const CATEGORIES = [
  "Youth Mentoring",
  "Senior Befriending",
  "Family Support",
  "Education Project",
  "Welfare-Home Support",
  "Community Outreach",
  "Events and Fundraising",
];

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ category: "", commitmentType: "", location: "" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api
      .listOpportunities(cleanFilters)
      .then((data) => !cancelled && setOpportunities(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Explore opportunities</h1>
      <p className="mt-1 text-ink/70">Filter by category, commitment type, or location.</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={filters.category}
          onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          className="rounded border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filters.commitmentType}
          onChange={(e) => setFilters((f) => ({ ...f, commitmentType: e.target.value }))}
          className="rounded border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">All commitment types</option>
          <option value="ad_hoc">One-time event</option>
          <option value="recurring">Recurring programme</option>
          <option value="mentoring">Long-term mentoring</option>
        </select>

        <input
          placeholder="Location contains..."
          value={filters.location}
          onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
          className="rounded border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-8 space-y-4">
        {loading && <p className="text-ink/60">Loading opportunities...</p>}
        {error && <p className="text-brick">{error}</p>}
        {!loading && !error && opportunities.length === 0 && (
          <p className="text-ink/60">No opportunities match those filters right now.</p>
        )}
        {opportunities.map((o) => (
          <OpportunityCard key={o.id} opportunity={o} />
        ))}
      </div>
    </div>
  );
}
