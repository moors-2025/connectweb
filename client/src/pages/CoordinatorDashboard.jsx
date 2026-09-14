import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Skeleton from "../components/Skeleton";
import { api, downloadVolunteerHoursCsv } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function CoordinatorDashboard() {
  const { user, token } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [report, setReport] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.listOpportunities({ status: "open" }),
      api.volunteerHoursReport(token),
      api.opportunityBreakdown(token),
      api.reportSummary(token),
    ])
      .then(([opps, rep, brk, sum]) => {
        setOpportunities(opps.filter((o) => o.createdBy === user.id));
        setReport(rep);
        setBreakdown(brk);
        setSummary(sum);
      })
      .finally(() => setLoading(false));
  }, [token, user.id]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadVolunteerHoursCsv(token);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  }

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
        <div className="mt-10"><Skeleton rows={3} /></div>
      ) : (
        <>
          {summary && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded border border-line bg-surface p-5">
                <p className="text-sm text-ink/60">Opportunities published</p>
                <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">
                  {summary.opportunityCount}
                </p>
              </div>
              <div className="rounded border border-line bg-surface p-5">
                <p className="text-sm text-ink/60">Active volunteers</p>
                <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">
                  {summary.activeVolunteerCount}
                </p>
              </div>
              <div className="rounded border border-line bg-surface p-5">
                <p className="text-sm text-ink/60">Total hours contributed</p>
                <p className="mt-1 font-display text-3xl font-semibold text-forest-dark">
                  {summary.totalHours}
                </p>
              </div>
            </div>
          )}

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
            <h2 className="font-display text-xl font-semibold">Per-opportunity breakdown</h2>
            {breakdown.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">No opportunities to report on yet.</p>
            ) : (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-ink/60">
                    <th className="py-2">Opportunity</th>
                    <th className="py-2">Approved</th>
                    <th className="py-2">Pending</th>
                    <th className="py-2">Hours logged</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b) => (
                    <tr key={b.id} className="border-b border-line">
                      <td className="py-2">{b.title}</td>
                      <td className="py-2">
                        {b.approvedCount}/{b.capacity}
                      </td>
                      <td className="py-2">{b.pendingCount}</td>
                      <td className="py-2">{b.totalHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Volunteer hours report</h2>
              <button
                onClick={handleExport}
                disabled={exporting || report.length === 0}
                className="rounded border border-line px-3 py-1.5 text-sm hover:border-forest hover:text-forest disabled:opacity-50"
              >
                {exporting ? "Exporting..." : "Export as CSV"}
              </button>
            </div>
            {exportError && <p className="mt-2 text-sm text-brick">{exportError}</p>}
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
