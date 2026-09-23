import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import VolunteerDashboard from "../VolunteerDashboard";
import { downloadHoursCertificate } from "../../lib/certificate";

// The dashboard fetches through the shared api client and reads the current
// user from AuthContext; both are mocked here so the component can be
// rendered in isolation, the same way the codebase already isolates route
// components from the network in other suites (see server/test/api.test.js
// for the equivalent backend-side isolation via an in-memory DB).
vi.mock("../../lib/api", () => ({
  api: {
    myApplications: vi.fn().mockResolvedValue([]),
    mySchedule: vi.fn().mockResolvedValue([]),
    myHours: vi.fn().mockResolvedValue({
      totalHours: 5,
      records: [
        { title: "Youth Learning Support", startDatetime: "2026-09-20T10:00:00", hoursCompleted: 5, attended: true },
      ],
    }),
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "v1", name: "Mei Tan", role: "volunteer" }, token: "session" }),
}));

vi.mock("../../lib/certificate", () => ({
  downloadHoursCertificate: vi.fn(),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <VolunteerDashboard />
    </MemoryRouter>
  );
}

describe("VolunteerDashboard — certificate download", () => {
  it("shows a 'Download certificate' button once hours are loaded, with no accessibility violations", async () => {
    const { container } = renderDashboard();
    const button = await screen.findByRole("button", { name: /download certificate/i });
    expect(button).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("calls downloadHoursCertificate with the volunteer's name and hours when clicked", async () => {
    renderDashboard();
    const button = await screen.findByRole("button", { name: /download certificate/i });
    await userEvent.click(button);

    expect(downloadHoursCertificate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Mei Tan", totalHours: 5 })
    );
  });

  it("hides the button for a freshly registered volunteer with zero hours", async () => {
    const { api } = await import("../../lib/api");
    api.myHours.mockResolvedValueOnce({ totalHours: 0, records: [] });

    renderDashboard();
    await waitFor(() => expect(api.myHours).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /download certificate/i })).not.toBeInTheDocument();
  });
});
