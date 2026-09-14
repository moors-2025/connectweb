// A simple pulse-animated placeholder shown while data is loading, instead of
// a bare "Loading..." string. `rows` controls how many card-shaped skeletons render.
export default function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded border border-line bg-surface p-5">
          <div className="h-3 w-24 rounded bg-line" />
          <div className="mt-3 h-5 w-2/3 rounded bg-line" />
          <div className="mt-3 h-3 w-full rounded bg-line" />
          <div className="mt-4 flex gap-4">
            <div className="h-3 w-16 rounded bg-line" />
            <div className="h-3 w-16 rounded bg-line" />
            <div className="h-3 w-16 rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
