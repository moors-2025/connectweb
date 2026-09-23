// Generates a "Certificate of Recognition" PDF for a volunteer's completed
// hours, entirely client-side. Built from data already returned by
// GET /api/volunteers/me/hours (see server/src/routes/volunteers.js) — no
// new backend route or data model change needed (FR-12; Appendix F).
//
// jsPDF is loaded client-only; nothing here touches the server bundle.
import { jsPDF } from "jspdf";

const FOREST = [47, 93, 70]; // #2f5d46
const FOREST_DARK = [35, 69, 52]; // #234534
const MARIGOLD = [217, 138, 43]; // #d98a2b
const INK = [34, 34, 34]; // matches Tailwind ink

/**
 * Builds and triggers a browser download of a one-page PDF certificate.
 *
 * @param {Object} params
 * @param {string} params.name - Volunteer's display name.
 * @param {number} params.totalHours - Total attended hours (from /me/hours).
 * @param {Array<{title: string, startDatetime: string, hoursCompleted: number, attended: boolean}>} params.records
 * @param {Date} [params.issuedOn] - Defaults to now; overridable for tests.
 */
export function downloadHoursCertificate({ name, totalHours, records, issuedOn = new Date() }) {
  const doc = buildCertificateDoc({ name, totalHours, records, issuedOn });
  const fileSafeName = name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`pertapis-volunteer-certificate-${fileSafeName || "volunteer"}.pdf`);
}

// Split out so tests can inspect the built document without triggering a
// real browser download (jsPDF's .save() is a no-op / throws under jsdom).
export function buildCertificateDoc({ name, totalHours, records, issuedOn = new Date() }) {
  const attended = (records || []).filter((r) => r.attended);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // Border
  doc.setDrawColor(...FOREST);
  doc.setLineWidth(2);
  doc.rect(margin, margin, pageW - margin * 2, pageH - margin * 2);
  doc.setLineWidth(0.75);
  doc.rect(margin + 8, margin + 8, pageW - (margin + 8) * 2, pageH - (margin + 8) * 2);

  const centerX = pageW / 2;

  doc.setTextColor(...FOREST_DARK);
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("PERTAPIS VOLUNTEER CONNECT", centerX, margin + 56, { align: "center" });

  doc.setTextColor(...MARIGOLD);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(30);
  doc.text("Certificate of Recognition", centerX, margin + 96, { align: "center" });

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("This certifies that", centerX, margin + 140, { align: "center" });

  doc.setTextColor(...FOREST_DARK);
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.text(name, centerX, margin + 176, { align: "center" });

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const hoursLabel = totalHours === 1 ? "hour" : "hours";
  doc.text(
    `has contributed ${totalHours} ${hoursLabel} of volunteer service through PERTAPIS Volunteer Connect`,
    centerX,
    margin + 204,
    { align: "center" }
  );

  if (attended.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    const activityWord = attended.length === 1 ? "activity" : "activities";
    doc.text(`across ${attended.length} confirmed ${activityWord}`, centerX, margin + 224, {
      align: "center",
    });
  }

  const dateStr = issuedOn.toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Issued ${dateStr}`, centerX, pageH - margin - 24, { align: "center" });
  doc.text(
    "Generated from this volunteer's own recorded attendance — PERTAPIS Volunteer Connect",
    centerX,
    pageH - margin - 12,
    { align: "center" }
  );

  return doc;
}
