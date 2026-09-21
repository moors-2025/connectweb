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

// User-management table: list/filter, disable/enable, and ownership transfer.
// A separate component (rather than inline in AdminDashboard) because it owns
// its own fetch/refetch cycle, independent of the read-only overview above it.
function UserManagement() {
  const { user: me, token } = useAuth();
  const [roleFilter, setRoleFilter] = useState("");
  const [q, setQ] = useState("");
  const [actionError, setActionError] = useState("");
  const [transferTargetId, setTransferTargetId] = useState(null); // user id being transferred *from*
  const [transferTo, setTransferTo] = useState("");

  const params = {};
  if (roleFilter) params.role = roleFilter;
  if (q.trim()) params.q = q.trim();

  const { data: users, loading, error, refetch } = useAsync(
    () => api.adminListUsers(params, token),
    [token, roleFilter, q]
  );

  async function handleToggleActive(u) {
    setActionError("");
    try {
      await api.adminSetUserActive(u.id, !u.active, token);
      refetch();
    } catch (err) {
      setActionError(err.message || "Could not update this user");
    }
  }

  function openTransfer(u) {
    setActionError("");
    setTransferTo("");
    setTransferTargetId(u.id);
  }

  async function submitTransfer(fromId) {
    if (!transferTo) return;
    setActionError("");
    try {
      await api.adminTransferOwnership(fromId, transferTo, token);
      setTransferTargetId(null);
      refetch();
    } catch (err) {
      setActionError(err.message || "Could not transfer ownership");
    }
  }

  const transferCandidates = (users || []).filter(
    (u) => u.active && ["coordinator", "admin"].includes(u.role) && u.id !== transferTargetId
  );

  return (
    <section className="mt-10 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">User management</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email"
            className="rounded border border-line px-2 py-1 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded border border-line px-2 py-1 text-sm"
          >
            <option value="">All roles</option>
            <option value="volunteer">Volunteer</option>
            <option value="coordinator">Coordinator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {actionError && <p className="mt-3 text-sm text-brick">{actionError}</p>}

      {loading ? (
        <div className="mt-4">
          <Skeleton rows={3} />
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-brick">{error}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-ink/60">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Owns</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    {u.name}
                    {u.id === me.id && <span className="ml-1 text-xs text-ink/50">(you)</span>}
                  </td>
                  <td className="px-4 py-2 text-ink/70">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.role}</td>
                  <td className="px-4 py-2">
                    <span className={u.active ? "text-forest-dark" : "text-brick"}>
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-2">{u.ownedCount}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {u.ownedCount > 0 && u.active && (
                        <button
                          onClick={() => openTransfer(u)}
                          className="rounded border border-line px-2 py-1 text-xs hover:border-forest hover:text-forest"
                        >
                          Transfer ownership
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={u.id === me.id}
                        className="rounded border border-line px-2 py-1 text-xs hover:border-forest hover:text-forest disabled:opacity-40"
                        title={u.id === me.id ? "You cannot disable your own account" : undefined}
                      >
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </div>

                    {transferTargetId === u.id && (
                      <div className="mt-2 flex items-center gap-2 rounded border border-line bg-surface p-2">
                        <select
                          value={transferTo}
                          onChange={(e) => setTransferTo(e.target.value)}
                          className="rounded border border-line px-2 py-1 text-xs"
                        >
                          <option value="">Reassign {u.ownedCount} opportunit{u.ownedCount === 1 ? "y" : "ies"} to…</option>
                          {transferCandidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.role})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => submitTransfer(u.id)}
                          disabled={!transferTo}
                          className="rounded bg-forest-dark px-2 py-1 text-xs text-white disabled:opacity-40"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setTransferTargetId(null)}
                          className="text-xs text-ink/60 hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(users || []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink/50">
                    No users match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink/50">
        Disabling a coordinator or admin who still owns opportunities is blocked until those
        opportunities are reassigned — use "Transfer ownership" first.
      </p>
    </section>
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

          <UserManagement />

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
            Report generated {new Date(data.generatedAt).toLocaleString()}. Listing, disabling, and
            ownership transfer are built above; full user creation/editing pages remain a stretch
            goal (Appendix F, Table 27).
          </p>
        </>
      )}
    </div>
  );
}
