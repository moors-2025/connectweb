import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

const CATEGORIES = [
  "Youth Mentoring",
  "Senior Befriending",
  "Family Support",
  "Education Project",
  "Welfare-Home Support",
  "Community Outreach",
  "Events and Fundraising",
];

const initial = {
  title: "",
  description: "",
  category: CATEGORIES[0],
  commitmentType: "ad_hoc",
  location: "",
  startDatetime: "",
  endDatetime: "",
  capacity: 4,
  requiresBriefing: false,
};

export default function CreateOpportunity() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const created = await api.createOpportunity(form, token);
      navigate(`/opportunities/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Create an opportunity</h1>
      <p className="mt-1 text-sm text-ink/70">
        Mentoring-type opportunities should require a briefing before approval.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="opp-title" className="block text-sm font-medium">Title</label>
          <input
            id="opp-title"
            required
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="opp-description" className="block text-sm font-medium">Description</label>
          <textarea
            id="opp-description"
            required
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="opp-category" className="block text-sm font-medium">Category</label>
            <select
              id="opp-category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="opp-commitment" className="block text-sm font-medium">Commitment type</label>
            <select
              id="opp-commitment"
              value={form.commitmentType}
              onChange={(e) => update("commitmentType", e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            >
              <option value="ad_hoc">One-time event</option>
              <option value="recurring">Recurring programme</option>
              <option value="mentoring">Long-term mentoring</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="opp-location" className="block text-sm font-medium">Location</label>
          <input
            id="opp-location"
            required
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="opp-start" className="block text-sm font-medium">Starts</label>
            <input
              id="opp-start"
              type="datetime-local"
              required
              value={form.startDatetime}
              onChange={(e) => update("startDatetime", e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="opp-end" className="block text-sm font-medium">Ends</label>
            <input
              id="opp-end"
              type="datetime-local"
              required
              value={form.endDatetime}
              onChange={(e) => update("endDatetime", e.target.value)}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 items-end gap-4">
          <div>
            <label htmlFor="opp-capacity" className="block text-sm font-medium">Capacity</label>
            <input
              id="opp-capacity"
              type="number"
              min="1"
              required
              value={form.capacity}
              onChange={(e) => update("capacity", Number(e.target.value))}
              className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.requiresBriefing}
              onChange={(e) => update("requiresBriefing", e.target.checked)}
            />
            Requires a briefing before approval
          </label>
        </div>

        {error && <p className="text-sm text-brick">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-dark disabled:opacity-60"
        >
          {loading ? "Publishing..." : "Publish opportunity"}
        </button>
      </form>
    </div>
  );
}
