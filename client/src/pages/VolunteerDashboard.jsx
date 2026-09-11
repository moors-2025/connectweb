import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function VolunteerDashboard() {
  const { user, token } = useAuth();
  const [applications, setApplications] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [hours, setHours] = useState({ totalHours: 0, records: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.myApplications(token), api.mySchedule(token), api.myHours(token)])
      .then(([apps, sched, hrs]) => {
        setApplications(apps);
        setSchedule(sched);
        setHours(hrs);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Welcome back, {user.name}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-line bg-surface p-5">
          <p className="text-sm text-ink/60">Hours contributed</p>
          <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">
            {hours.totalHours}
          </p>
        </div>
        <div className="rounded border border-line bg-surface p-5">
          <p className="text-sm text-ink/60">Confirmed activities</p>
          <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">
            {schedule.length}
          </p>
        </div>
        <div className="rounded border border-line bg-surface p-5">
          <p className="text-sm text-ink/60">Applications pending</p>
          <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">
            {applications.filter((a) => a.status === "pending").length}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-10 text-ink/60">Loading your dashboard...</p>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">My schedule</h2>
            {schedule.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">
                No confirmed activities yet.{" "}
                <Link to="/opportunities" className="text-forest underline">
                  Browse opportunities
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {schedule.map((s) => (
                  <li key={s.id} className="rounded border border-line p-4">
                    <Link to={`/opportunities/${s.id}`} className="font-medium hover:text-forest">
                      {s.title}
                    </Link>
                    <p className="text-sm text-ink/60">
                      {new Date(s.startDatetime).toLocaleString()} · {s.location}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">My applications</h2>
            {applications.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">You haven't applied to anything yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {applications.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded border border-line p-4"
                  >
                    <div>
                      <Link to={`/opportunities/${a.opportunityId}`} className="font-medium hover:text-forest">
                        {a.title}
                      </Link>
                      <p className="text-sm text-ink/60">{new Date(a.startDatetime).toLocaleString()}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Attendance & hours</h2>
            {hours.records.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No attendance recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {hours.records.map((r, i) => (
                  <li key={i} className="flex items-center justify-between rounded border border-line p-4">
                    <div>
                      <p className="font-medium">{r.title}</p>
                      <p className="text-sm text-ink/60">{new Date(r.startDatetime).toLocaleString()}</p>
                    </div>
                    <span className="text-sm font-medium text-forest-dark">
                      {r.attended ? `${r.hoursCompleted} hrs` : "Did not attend"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
