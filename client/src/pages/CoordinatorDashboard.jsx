import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function CoordinatorDashboard() {
  const { user, token } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listOpportunities({ status: "open" }), api.volunteerHoursReport(token)])
      .then(([opps, rep]) => {
        setOpportunities(opps.filter((o) => o.createdBy === user.id));
        setReport(rep);
      })
      .finally(() => setLoading(false));
  }, [token, user.id]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Coordinator dashboard</h1>
        <Link
          to="/coordinator/new"
          className="rounded bg-forest px-4 py-2.5 font-medium text-white hover:bg-forest-dark"
        >
          Create opportunity
        </Link>
      </div>

      {loading ? (
        <p className="mt-10 text-ink/60">Loading...</p>
      ) : (
        <>
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">My open opportunities</h2>
            {opportunities.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">You haven't published anything yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {opportunities.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded border border-line p-4"
                  >
                    <div>
                      <Link to={`/opportunities/${o.id}`} className="font-medium hover:text-forest">
                        {o.title}
                      </Link>
                      <p className="text-sm text-ink/60">
                        {o.approvedCount}/{o.capacity} approved · {new Date(o.startDatetime).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold">Volunteer hours report</h2>
            {report.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No attendance recorded yet.</p>
            ) : (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-ink/60">
                    <th className="py-2">Volunteer</th>
                    <th className="py-2">Activities</th>
                    <th className="py-2">Total hours</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.email} className="border-b border-line">
                      <td className="py-2">{r.volunteerName}</td>
                      <td className="py-2">{r.activitiesCount}</td>
                      <td className="py-2">{r.totalHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
