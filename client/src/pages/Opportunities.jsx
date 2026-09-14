import { useState } from "react";
import { useOpportunities } from "../hooks/useOpportunities";
import OpportunityCard from "../components/OpportunityCard";
import Skeleton from "../components/Skeleton";

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
  const [filters, setFilters] = useState({ category: "", commitmentType: "", location: "" });
  const { opportunities, loading, error } = useOpportunities(filters);

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

      <div className="mt-8">
        {loading && <Skeleton rows={3} />}
        {error && <p className="text-brick">{error}</p>}
        {!loading && !error && opportunities.length === 0 && (
          <p className="text-ink/60">No opportunities match those filters right now.</p>
        )}
        {!loading && !error && (
          <div className="space-y-4">
            {opportunities.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
