import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function OpportunityDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [opportunity, setOpportunity] = useState(null);
  const [applications, setApplications] = useState([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const o = await api.getOpportunity(id);
    setOpportunity(o);
    if (user?.role === "coordinator" && o.createdBy === user.id) {
      const apps = await api.listApplicationsFor(id, token).catch(() => []);
      setApplications(apps);
    }
    setLoading(false);
  }, [id, user, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleApply(e) {
    e.preventDefault();
    setStatus(null);
    try {
      await api.apply(id, message, token);
      setStatus({ type: "ok", text: "Application submitted — you'll see it under My Applications." });
      setMessage("");
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  async function handleReview(applicationId, decision) {
    try {
      await api.reviewApplication(applicationId, decision, token);
      load();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  if (loading) return <p className="mx-auto max-w-3xl px-6 py-12 text-ink/60">Loading...</p>;
  if (!opportunity) return <p className="mx-auto max-w-3xl px-6 py-12">Opportunity not found.</p>;

  const spotsLeft = opportunity.capacity - (opportunity.approvedCount || 0);
  const isOwner = user?.role === "coordinator" && opportunity.createdBy === user.id;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-ink/60">{opportunity.category}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">{opportunity.title}</h1>
        </div>
        <StatusBadge status={opportunity.status} />
      </div>

      <p className="mt-4 text-ink/80">{opportunity.description}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-6 text-sm">
        <div>
          <dt className="text-ink/50">Location</dt>
          <dd>{opportunity.location}</dd>
        </div>
        <div>
          <dt className="text-ink/50">When</dt>
          <dd>{new Date(opportunity.startDatetime).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-ink/50">Spots</dt>
          <dd>
            {Math.max(spotsLeft, 0)} of {opportunity.capacity} open
          </dd>
        </div>
        <div>
          <dt className="text-ink/50">Before applying</dt>
          <dd>{opportunity.requiresBriefing ? "Attend a volunteer briefing" : "No briefing required"}</dd>
        </div>
      </dl>

      {user?.role === "volunteer" && (
        <form onSubmit={handleApply} className="mt-8 space-y-3">
          <label className="block text-sm font-medium">
            A short note to the coordinator (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded border border-line bg-surface px-3 py-2"
            placeholder="Tell them why you're a good fit..."
          />
          <button
            type="submit"
            disabled={spotsLeft <= 0 || opportunity.status !== "open"}
            className="rounded bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-dark disabled:opacity-50"
          >
            Apply for this opportunity
          </button>
        </form>
      )}

      {!user && <p className="mt-8 text-sm text-ink/70">Log in as a volunteer to apply.</p>}

      {status && (
        <p className={`mt-4 text-sm ${status.type === "ok" ? "text-forest-dark" : "text-brick"}`}>
          {status.text}
        </p>
      )}

      {isOwner && (
        <div className="mt-10 border-t border-line pt-8">
          <h2 className="font-display text-xl font-semibold">Applications</h2>
          {applications.length === 0 ? (
            <p className="mt-2 text-sm text-ink/60">No applications yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {applications.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded border border-line p-4"
                >
                  <div>
                    <p className="font-medium">{a.volunteerName}</p>
                    <p className="text-sm text-ink/60">{a.volunteerEmail}</p>
                    {a.message && <p className="mt-1 text-sm text-ink/80">"{a.message}"</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={a.status} />
                    {a.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleReview(a.id, "approved")}
                          className="rounded border border-forest px-3 py-1.5 text-sm text-forest-dark hover:bg-forest/10"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(a.id, "declined")}
                          className="rounded border border-brick px-3 py-1.5 text-sm text-brick hover:bg-brick/10"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {a.status === "approved" && (
                      <AttendanceForm
                        opportunityId={opportunity.id}
                        volunteerId={a.volunteerId}
                        token={token}
                        onRecorded={load}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AttendanceForm({ opportunityId, volunteerId, token, onRecorded }) {
  const [hoursCompleted, setHoursCompleted] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(e) {
    e.preventDefault();
    await api.recordAttendance(
      { opportunityId, volunteerId, attended: true, hoursCompleted: Number(hoursCompleted) || 0 },
      token
    );
    setSaved(true);
    onRecorded();
  }

  if (saved) return <span className="text-sm text-forest-dark">Attendance recorded</span>;

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        step="0.5"
        required
        placeholder="hrs"
        value={hoursCompleted}
        onChange={(e) => setHoursCompleted(e.target.value)}
        className="w-16 rounded border border-line px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded bg-forest px-3 py-1.5 text-sm text-white hover:bg-forest-dark">
        Record attendance
      </button>
    </form>
  );
}
