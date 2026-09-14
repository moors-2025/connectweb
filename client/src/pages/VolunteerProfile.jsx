import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import Skeleton from "../components/Skeleton";

const COMMITMENT_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "ad_hoc", label: "One-time events" },
  { value: "recurring", label: "Recurring programmes" },
  { value: "mentoring", label: "Long-term mentoring" },
];

export default function VolunteerProfile() {
  const { token } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .myProfile(token)
      .then((p) =>
        setForm({
          skills: p?.skills || "",
          interests: p?.interests || "",
          availability: p?.availability || "",
          preferredLocations: p?.preferredLocations || "",
          commitmentPreference: p?.commitmentPreference || "",
        })
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, commitmentPreference: form.commitmentPreference || null };
      await api.updateMyProfile(payload, token);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-12">
        <Skeleton rows={1} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">My profile</h1>
      <p className="mt-1 text-sm text-ink/70">
        This helps opportunities feel relevant to you — none of it is required.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="profile-skills" className="block text-sm font-medium">Skills</label>
          <textarea
            id="profile-skills"
            rows={2}
            value={form.skills}
            onChange={(e) => update("skills", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            placeholder="Teaching, first aid, event planning..."
          />
        </div>
        <div>
          <label htmlFor="profile-interests" className="block text-sm font-medium">Interests</label>
          <textarea
            id="profile-interests"
            rows={2}
            value={form.interests}
            onChange={(e) => update("interests", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            placeholder="Education, elderly care, community events..."
          />
        </div>
        <div>
          <label htmlFor="profile-availability" className="block text-sm font-medium">Availability</label>
          <input
            id="profile-availability"
            value={form.availability}
            onChange={(e) => update("availability", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            placeholder="Weekday evenings, weekend mornings..."
          />
        </div>
        <div>
          <label htmlFor="profile-locations" className="block text-sm font-medium">Preferred locations</label>
          <input
            id="profile-locations"
            value={form.preferredLocations}
            onChange={(e) => update("preferredLocations", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
            placeholder="Yishun, Ang Mo Kio..."
          />
        </div>
        <div>
          <label htmlFor="profile-commitment" className="block text-sm font-medium">Preferred commitment type</label>
          <select
            id="profile-commitment"
            value={form.commitmentPreference}
            onChange={(e) => update("commitmentPreference", e.target.value)}
            className="mt-1 w-full rounded border border-line bg-surface px-3 py-2"
          >
            {COMMITMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-brick">{error}</p>}
        {saved && <p className="text-sm text-forest-dark">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-forest px-5 py-2.5 font-medium text-white hover:bg-forest-dark disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>
    </div>
  );
}
