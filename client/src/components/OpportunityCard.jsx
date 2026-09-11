import { Link } from "react-router-dom";

const COMMITMENT_STYLE = {
  ad_hoc: { border: "border-l-marigold", label: "One-time event" },
  recurring: { border: "border-l-forest", label: "Recurring programme" },
  mentoring: { border: "border-l-teal", label: "Long-term mentoring" },
};

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OpportunityCard({ opportunity }) {
  const style = COMMITMENT_STYLE[opportunity.commitmentType] || COMMITMENT_STYLE.ad_hoc;
  const spotsLeft = opportunity.capacity - (opportunity.approvedCount || 0);

  return (
    <Link
      to={`/opportunities/${opportunity.id}`}
      className={`block rounded border border-line border-l-4 ${style.border} bg-surface p-5 transition hover:border-l-8`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/50">{style.label}</p>
          <h3 className="mt-1 font-display text-lg font-semibold">{opportunity.title}</h3>
        </div>
        {opportunity.requiresBriefing && (
          <span className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs text-ink/70">
            Briefing required
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-ink/80">{opportunity.description}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/70">
        <span>{opportunity.category}</span>
        <span>{opportunity.location}</span>
        <span>{formatDate(opportunity.startDatetime)}</span>
        <span>
          {Math.max(spotsLeft, 0)} of {opportunity.capacity} spots open
        </span>
      </div>
    </Link>
  );
}
