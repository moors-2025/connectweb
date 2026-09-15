// In dev, Vite proxies "/api" to localhost:4000 (see vite.config.js).
// In production the client and API are on different domains (Vercel + Render),
// so VITE_API_BASE_URL must be set at build time to the deployed API's URL,
// e.g. https://pertapis-volunteer-connect-api.onrender.com/api
const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),

  listOpportunities: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/opportunities${qs ? `?${qs}` : ""}`);
  },
  getOpportunity: (id, token) => request(`/opportunities/${id}`, { token }),
  createOpportunity: (payload, token) => request("/opportunities", { method: "POST", body: payload, token }),
  updateOpportunity: (id, payload, token) => request(`/opportunities/${id}`, { method: "PATCH", body: payload, token }),

  apply: (opportunityId, message, token) =>
    request(`/opportunities/${opportunityId}/apply`, { method: "POST", body: { message }, token }),
  listApplicationsFor: (opportunityId, token) => request(`/opportunities/${opportunityId}/applications`, { token }),
  reviewApplication: (applicationId, status, token, briefingConfirmed) =>
    request(`/applications/${applicationId}`, {
      method: "PATCH",
      body: briefingConfirmed !== undefined ? { status, briefingConfirmed } : { status },
      token,
    }),

  recordAttendance: (payload, token) => request("/attendance", { method: "POST", body: payload, token }),

  myProfile: (token) => request("/volunteers/me/profile", { token }),
  updateMyProfile: (payload, token) => request("/volunteers/me/profile", { method: "PATCH", body: payload, token }),
  mySchedule: (token) => request("/volunteers/me/schedule", { token }),
  myApplications: (token) => request("/volunteers/me/applications", { token }),
  myHours: (token) => request("/volunteers/me/hours", { token }),

  volunteerHoursReport: (token) => request("/reports/volunteer-hours", { token }),
  opportunityBreakdown: (token) => request("/reports/opportunity-breakdown", { token }),
  reportSummary: (token) => request("/reports/summary", { token }),

  adminOverview: (token) => request("/admin/overview", { token }),
  adminBackup: (token) => request("/admin/backup", { method: "POST", token }),
  adminReindex: (token) => request("/admin/reindex", { method: "POST", token }),
};

// CSV export needs the auth header, so it can't just be a plain <a href> link —
// fetch it as a blob and trigger the browser download manually.
export async function downloadVolunteerHoursCsv(token) {
  const res = await fetch(`${BASE}/reports/volunteer-hours/export.csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Could not export the report");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "volunteer-hours-report.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
