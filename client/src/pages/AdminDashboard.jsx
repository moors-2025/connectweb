import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import Skeleton from "../components/Skeleton";

const ROLES = ["volunteer", "coordinator", "admin"];

// Shared by "Add user" and "Edit" — the two admin GUI actions Table 27 named
// as the remaining "Roles" gap (creating/editing directly, not just
// enabling/disabling). `editingUser` null means create mode; otherwise the
// form is pre-filled and password becomes optional ("leave blank to keep the
// current password").
function UserFormModal({ editingUser, onClose, onSaved }) {
  const { token } = useAuth();
  const isEdit = !!editingUser;
  const [form, setForm] = useState({
    name: editingUser?.name || "",
    email: editingUser?.email || "",
    password: "",
    role: editingUser?.role || "volunteer",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (isEdit) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.adminUpdateUser(editingUser.id, payload, token);
      } else {
        await api.adminCreateUser(form, token);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Could not save this user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="w-full max-w-md rounded border border-line bg-white p-6 shadow-lg">
        <h3 id="user-form-title" className="font-display text-lg font-semibold">
          {isEdit ? `Edit ${editingUser.name}` : "Add user"}
        </h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="uf-name" className="block text-sm font-medium">Name</label>
            <input
              id="uf-name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus-visible:outline-none"
            />
          </div>
          <div>
            <label htmlFor="uf-email" className="block text-sm font-medium">Email</label>
            <input
              id="uf-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus-visible:outline-none"
            />
          </div>
          <div>
            <label htmlFor="uf-password" className="block text-sm font-medium">
              Password {isEdit && <span className="font-normal text-ink/50">(leave blank to keep current)</span>}
            </label>
            <input
              id="uf-password"
              type="password"
              required={!isEdit}
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={isEdit ? "••••••••" : undefined}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 focus-visible:outline-none"
            />
          </div>
          <div>
            <label htmlFor="uf-role" className="block text-sm font-medium">Role</label>
            <select
              id="uf-role"
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 capitalize focus-visible:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">{r}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-brick">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded border border-line px-3 py-1.5 text-sm hover:border-forest hover:text-forest">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-forest-dark px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
function UserManagement({ onUserAction }) {
  const { user: me, token } = useAuth();
  const [roleFilter, setRoleFilter] = useState("");
  const [q, setQ] = useState("");
  const [actionError, setActionError] = useState("");
  const [transferTargetId, setTransferTargetId] = useState(null); // user id being transferred *from*
  const [transferTo, setTransferTo] = useState("");
  // "create" | "edit" | null — which form modal (if any) is open, and for
  // "edit" which user it's editing.
  const [formMode, setFormMode] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

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
      onUserAction?.();
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
      onUserAction?.();
    } catch (err) {
      setActionError(err.message || "Could not transfer ownership");
    }
  }

  const transferCandidates = (users || []).filter(
    (u) => u.active && ["coordinator", "admin"].includes(u.role) && u.id !== transferTargetId
  );

  function openCreate() {
    setActionError("");
    setEditingUser(null);
    setFormMode("create");
  }

  function openEdit(u) {
    setActionError("");
    setEditingUser(u);
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode(null);
    setEditingUser(null);
  }

  function handleSaved() {
    closeForm();
    refetch();
    onUserAction?.();
  }

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
          <button
            onClick={openCreate}
            className="rounded bg-forest-dark px-3 py-1.5 text-sm text-white hover:bg-forest"
          >
            Add user
          </button>
        </div>
      </div>

      {formMode && (
        <UserFormModal editingUser={editingUser} onClose={closeForm} onSaved={handleSaved} />
      )}

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
                      <button
                        onClick={() => openEdit(u)}
                        className="rounded border border-line px-2 py-1 text-xs hover:border-forest hover:text-forest"
                      >
                        Edit
                      </button>
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

// Read-only audit trail of admin actions (Table 27's other half of the same
// deferred item as UserManagement's create/edit above). Every mutating admin
// route logs here (server/src/routes/admin.js's logAudit) — user
// create/update/disable/enable, ownership transfer, backup, and reindex —
// so this table is the one place to answer "who did what, and when."
function AuditLog({ refreshSignal }) {
  const { token } = useAuth();
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const params = actionFilter ? { action: actionFilter } : {};
  const { data: entries, loading, error } = useAsync(
    () => api.adminAuditLog(params, token),
    [token, actionFilter, refreshSignal]
  );

  const actionOptions = [
    "user.create", "user.update", "user.disable", "user.enable",
    "ownership.transfer", "backup.run", "reindex.run",
  ];

  return (
    <section className="mt-10 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Audit log</h2>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded border border-line px-2 py-1 text-sm"
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

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
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Target</th>
                <th className="px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {(entries || []).map((entry) => (
                <tr key={entry.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-ink/70">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{entry.actorName}</td>
                  <td className="px-4 py-2 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-2 text-ink/70">
                    {entry.targetType}
                    {entry.targetId ? ` · ${entry.targetId.slice(0, 8)}…` : ""}
                  </td>
                  <td className="px-4 py-2">
                    {entry.details ? (
                      <button
                        onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                        className="text-xs text-forest-dark hover:underline"
                      >
                        {expandedId === entry.id ? "Hide" : "Show"}
                      </button>
                    ) : (
                      <span className="text-xs text-ink/40">—</span>
                    )}
                    {expandedId === entry.id && (
                      <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-surface p-2 text-xs">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {(entries || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink/50">
                    No actions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink/50">
        Every admin mutation is logged here, including this dashboard's own operational tools
        (backup, reindex) — not just user changes.
      </p>
    </section>
  );
}

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const { data, loading, error } = useAsync(() => api.adminOverview(token), [token]);
  // Bumped after any admin mutation (user changes, backup, reindex) so the
  // audit log below reflects it without a full page reload.
  const [auditRefresh, setAuditRefresh] = useState(0);
  const bumpAudit = () => setAuditRefresh((n) => n + 1);

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

          <UserManagement onUserAction={bumpAudit} />

          <section className="mt-10 print:hidden">
            <h2 className="font-display text-xl font-semibold">Operational tools</h2>
            <div className="mt-3 space-y-3">
              <AdminAction
                label="Back up database"
                description="Copies the live SQLite file to a timestamped backup, keeping the 10 most recent (same logic as npm run backup)."
                onRun={async () => {
                  const result = await api.adminBackup(token);
                  bumpAudit();
                  return result;
                }}
              />
              <AdminAction
                label="Rebuild indexes"
                description="Runs SQLite's REINDEX. A basic prototype only — not a tuned indexing strategy (Appendix F)."
                onRun={async () => {
                  const result = await api.adminReindex(token);
                  bumpAudit();
                  return result;
                }}
              />
            </div>
          </section>

          <AuditLog refreshSignal={auditRefresh} />

          <p className="mt-10 text-xs text-ink/50">
            Report generated {new Date(data.generatedAt).toLocaleString()}. User management above
            covers the full lifecycle — create, edit, disable/enable, ownership transfer — and every
            admin action is recorded in the audit log (Table 27).
          </p>
        </>
      )}
    </div>
  );
}
