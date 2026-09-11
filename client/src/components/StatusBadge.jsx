const STYLES = {
  pending: "bg-marigold/15 text-marigold-dark",
  approved: "bg-forest/15 text-forest-dark",
  declined: "bg-brick/15 text-brick",
  completed: "bg-teal/15 text-teal",
  open: "bg-forest/15 text-forest-dark",
  closed: "bg-ink/10 text-ink",
  cancelled: "bg-brick/15 text-brick",
};

const LABELS = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  completed: "Completed",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || "bg-ink/10 text-ink";
  const label = LABELS[status] || status;
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
