import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import Skeleton from "../components/Skeleton";

export default function OpportunityDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const [opportunity, setOpportunity] = useState(null);
  const [applications, setApplications] = useState([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const o = await api.getOpportunity(id, token);
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
    setApplying(true);
    try {
      await api.apply(id, message, token);
      setStatus({ type: "ok", text: "Application submitted — you'll see it under My Applications." });
      setMessage("");
      load();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setApplying(false);
    }
  }

  async function handleReview(applicationId, decision, briefingConfirmed) {
    try {
      await api.reviewApplication(applicationId, decision, token, briefingConfirmed);
      load();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Skeleton rows={1} />
      </div>
    );
  }
  if (!opportunity) return <p className="mx-auto max-w-3xl px-6 py-12">Opportunity not found.</p>;

  const spotsLeft = opportunity.capacity - (opportunity.approvedCount || 0);
  const isOwner = user?.role === "coordinator" && opportunity.createdBy === user.id;
  const myApplication = opportunity.myApplication;

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

      {/* Conditional CTA: an existing application replaces the apply form entirely,
          rather than letting the volunteer submit a second one that the API would reject. */}
      {user?.role === "volunteer" && myApplication && (
        <div className="mt-8 flex items-center gap-3 rounded border border-line bg-surface p-4">
          <span className="text-sm text-ink/70">You've already applied to this opportunity:</span>
          <StatusBadge status={myApplication.status} />
        </div>
      )}

      {user?.role === "volunteer" && !myApplication && (
        <form onSubmit={handleApply} className="mt-8 space-y-3">
          <label htmlFor="apply-message" className="block text-sm font-medium">
            A short note to the coordinator (optional)
          </label>
          <textarea
            id="apply-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full rounded border border-line bg-surface px-3 py-2"
            placeholder="Tell them why you're a good fit..."
          />
          <button
            type="submit"
            disabled={applying || spotsLeft <= 0 || opportunity.status !== "open"}
            className="rounded bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-dark disabled:opacity-50"
          >
            {applying ? "Submitting..." : spotsLeft <= 0 ? "This opportunity is full" : "Apply for this opportunity"}
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
                <li key={a.id} className="rounded border border-line p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{a.volunteerName}</p>
                      <p className="text-sm text-ink/60">{a.volunteerEmail}</p>
                      {a.message && <p className="mt-1 text-sm text-ink/80">"{a.message}"</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={a.status} />
                      {a.status === "approved" && (
                        <AttendanceForm
                          opportunityId={opportunity.id}
                          volunteerId={a.volunteerId}
                          token={token}
                          onRecorded={load}
                        />
                      )}
                    </div>
                  </div>

                  {a.status === "pending" && (
                    <ApprovalControls
                      application={a}
                      requiresBriefing={opportunity.requiresBriefing}
                      onDecide={handleReview}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// BR4: mentoring/briefing-required opportunities need explicit confirmation
// before an approval is allowed to go through — this mirrors the server-side rule.
function ApprovalControls({ application, requiresBriefing, onDecide }) {
  const [briefingConfirmed, setBriefingConfirmed] = useState(!!application.briefingConfirmed);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
      {requiresBriefing && (
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={briefingConfirmed}
            onChange={(e) => setBriefingConfirmed(e.target.checked)}
          />
          Briefing attended
        </label>
      )}
      <button
        onClick={() => onDecide(application.id, "approved", requiresBriefing ? briefingConfirmed : undefined)}
        disabled={requiresBriefing && !briefingConfirmed}
        title={requiresBriefing && !briefingConfirmed ? "Confirm the briefing before approving" : undefined}
        className="rounded border border-forest px-3 py-1.5 text-sm text-forest-dark hover:bg-forest/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Approve
      </button>
      <button
        onClick={() => onDecide(application.id, "declined")}
        className="rounded border border-brick px-3 py-1.5 text-sm text-brick hover:bg-brick/10"
      >
        Decline
      </button>
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
