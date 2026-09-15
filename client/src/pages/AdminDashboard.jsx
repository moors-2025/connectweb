import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import Skeleton from "../components/Skeleton";

function AdminAction({ label, description, onRun }) {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [message, setMessage] = useState("");

  async function handleClick() {
    setStatus("running");
    setMessage("");
    try {
      const result = await onRun();
      setStatus("done");
      setMessage(
        result.destination
          ? `Backed up to ${result.destination.split("/").pop()}${result.pruned.length ? `; pruned ${result.pruned.length} old backup(s)` : ""}.`
          : `Done at ${new Date(result.ranAt).toLocaleTimeString()}.`
      );
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Something went wrong.");
    }
  }

  return (
    <div className="rounded border border-line p-4 print:hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-ink/60">{description}</p>
        </div>
        <button
          onClick={handleClick}
          disabled={status === "running"}
          className="shrink-0 rounded border border-line px-3 py-1.5 text-sm hover:border-forest hover:text-forest disabled:opacity-50"
        >
          {status === "running" ? "Running..." : "Run"}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-sm ${status === "error" ? "text-brick" : "text-forest-dark"}`}>{message}</p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const { data, loading, error } = useAsync(() => api.adminOverview(token), [token]);

  const totalUsers = (data?.usersByRole || []).reduce((sum, r) => sum + r.count, 0);
  const totalOpportunities = (data?.opportunitiesByStatus || []).reduce((sum, r) => sum + r.count, 0);
  const totalHours = data?.attendance?.totalHours ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">System overview</h1>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-sm text-ink/60">
          Signed in as {user.name} · read-only report, refreshed on each visit.
        </p>
        <button
          onClick={() => window.print()}
          className="print:hidden shrink-0 rounded border border-line px-3 py-1.5 text-sm hover:border-forest hover:text-forest"
        >
          Print report
        </button>
      </div>

      {loading ? (
        <div className="mt-10">
          <Skeleton rows={3} />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-brick">{error}</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-line bg-surface p-5">
              <p className="text-sm text-ink/60">Total users</p>
              <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">{totalUsers}</p>
            </div>
            <div className="rounded border border-line bg-surface p-5">
              <p className="text-sm text-ink/60">Total opportunities</p>
              <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">{totalOpportunities}</p>
            </div>
            <div className="rounded border border-line bg-surface p-5">
              <p className="text-sm text-ink/60">Hours logged (all-time)</p>
              <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">{totalHours}</p>
            </div>
          </div>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Users by role</h2>
            <ul className="mt-3 space-y-2">
              {(data.usersByRole || []).map((r) => (
                <li key={r.role} className="flex items-center justify-between rounded border border-line p-4">
                  <span className="capitalize">{r.role}</span>
                  <span className="font-medium text-forest-dark">{r.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Opportunities by status</h2>
            <ul className="mt-3 space-y-2">
              {(data.opportunitiesByStatus || []).map((r) => (
                <li key={r.status} className="flex items-center justify-between rounded border border-line p-4">
                  <span className="capitalize">{r.status}</span>
                  <span className="font-medium text-forest-dark">{r.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Applications by status</h2>
            <ul className="mt-3 space-y-2">
              {(data.applicationsByStatus || []).map((r) => (
                <li key={r.status} className="flex items-center justify-between rounded border border-line p-4">
                  <span className="capitalize">{r.status}</span>
                  <span className="font-medium text-forest-dark">{r.count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10 print:hidden">
            <h2 className="font-display text-xl font-semibold">Operational tools</h2>
            <div className="mt-3 space-y-3">
              <AdminAction
                label="Back up database"
                description="Copies the live SQLite file to a timestamped backup, keeping the 10 most recent (same logic as npm run backup)."
                onRun={() => api.adminBackup(token)}
              />
              <AdminAction
                label="Rebuild indexes"
                description="Runs SQLite's REINDEX. A basic prototype only — not a tuned indexing strategy (Appendix F)."
                onRun={() => api.adminReindex(token)}
              />
            </div>
          </section>

          <p className="mt-10 text-xs text-ink/50">
            Report generated {new Date(data.generatedAt).toLocaleString()}. User creation, editing, disabling,
            and ownership transfer are not built yet (Appendix F, Stretch Goals).
          </p>
        </>
      )}
    </div>
  );
}
