import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import StatusBadge from "../StatusBadge";
import Skeleton from "../Skeleton";
import OpportunityCard from "../OpportunityCard";
import Home from "../../pages/Home";
import Login from "../../pages/Login";
import Register from "../../pages/Register";
import { AuthProvider } from "../../context/AuthContext";

// jest-axe runs the real axe-core rule set against jsdom-rendered markup.
// It cannot check visual properties that require actual painting (e.g. real
// computed colour-contrast against a rendered screen), but it does check
// everything DOM-observable: label association, ARIA usage and validity,
// landmark structure, heading order, duplicate IDs, and form semantics.
// This is what "manually reviewed" (Section 4.2, previously) has been
// upgraded to: automated, repeatable, and run here for real.

function withProviders(ui) {
  return (
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

const sampleOpportunity = {
  id: "1",
  title: "Youth Learning Support",
  description: "Support young people through structured learning.",
  category: "Education Project",
  commitmentType: "recurring",
  location: "PERTAPIS programme site",
  startDatetime: "2026-10-01T10:00:00",
  capacity: 4,
  approvedCount: 1,
  requiresBriefing: true,
};

describe("Accessibility (jest-axe)", () => {
  it("StatusBadge has no violations, for every status variant", async () => {
    for (const status of ["pending", "approved", "declined", "completed", "open", "closed", "cancelled"]) {
      const { container } = render(<StatusBadge status={status} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it("Skeleton has no violations", async () => {
    const { container } = render(<Skeleton rows={3} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("OpportunityCard has no violations, for every commitment type", async () => {
    for (const commitmentType of ["ad_hoc", "recurring", "mentoring"]) {
      const { container } = render(
        <MemoryRouter>
          <OpportunityCard opportunity={{ ...sampleOpportunity, commitmentType }} />
        </MemoryRouter>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });

  it("Home page has no violations", async () => {
    const { container } = render(withProviders(<Home />));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Login page has no violations", async () => {
    const { container } = render(withProviders(<Login />));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Register page has no violations", async () => {
    const { container } = render(withProviders(<Register />));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
