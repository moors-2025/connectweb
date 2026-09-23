import { describe, it, expect } from "vitest";
import { buildCertificateDoc } from "../certificate";

// buildCertificateDoc is the pure/testable half of downloadHoursCertificate:
// it returns the built jsPDF document without touching the browser's
// download machinery (jsPDF's own .save() call, which jsdom can't perform).

describe("certificate.buildCertificateDoc", () => {
  const records = [
    { title: "Youth Learning Support", startDatetime: "2026-09-20T10:00:00", hoursCompleted: 3, attended: true },
    { title: "Senior Befriending Visits", startDatetime: "2026-09-27T14:00:00", hoursCompleted: 2, attended: true },
    { title: "Flag Day Fundraiser", startDatetime: "2026-10-04T08:00:00", hoursCompleted: 0, attended: false },
  ];

  it("builds a single-page landscape A4 document for a volunteer with hours", () => {
    const doc = buildCertificateDoc({ name: "Mei Tan", totalHours: 5, records, issuedOn: new Date("2026-09-22") });
    expect(doc.getNumberOfPages()).toBe(1);
    const { width, height } = doc.internal.pageSize;
    expect(width).toBeGreaterThan(height); // landscape
  });

  it("produces non-empty PDF output", () => {
    const doc = buildCertificateDoc({ name: "Mei Tan", totalHours: 5, records, issuedOn: new Date("2026-09-22") });
    const blob = doc.output("blob");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("handles a volunteer with a single hour and a single activity (singular wording)", () => {
    const single = [{ title: "Youth Learning Support", startDatetime: "2026-09-20T10:00:00", hoursCompleted: 1, attended: true }];
    expect(() => buildCertificateDoc({ name: "New Volunteer", totalHours: 1, records: single })).not.toThrow();
  });

  it("handles zero attended records without throwing (defensive — dashboard already hides the button at 0 hours)", () => {
    expect(() => buildCertificateDoc({ name: "New Volunteer", totalHours: 0, records: [] })).not.toThrow();
  });

  it("does not choke on special characters in the volunteer's name", () => {
    expect(() =>
      buildCertificateDoc({ name: "Nur D'Cruz-Osman", totalHours: 4, records, issuedOn: new Date("2026-09-22") })
    ).not.toThrow();
  });
});
