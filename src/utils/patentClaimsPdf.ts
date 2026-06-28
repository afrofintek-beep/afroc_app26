/**
 * © 2025 AFROFINTEK GmbH. All rights reserved.
 * Patent Claims PDF Generator — AFR001PEP
 */

import jsPDF from "jspdf";
import { afr001pepClaims } from "@/lib/afroloc/claims";

export function generatePatentClaimsPdf() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 25;
  const marginR = 25;
  const maxW = pageW - marginL - marginR;
  let y = 0;

  const { reference, applicant, filingDate, ipcClasses, abstract: abs, claims } = afr001pepClaims;

  function checkPage(needed: number) {
    if (y + needed > pageH - 25) {
      doc.addPage();
      y = 25;
    }
  }

  // ── Cover header ──
  y = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("CONFIDENTIAL — AFROFINTEK GmbH", pageW / 2, y, { align: "center" });

  y += 20;
  doc.setFontSize(18);
  doc.setTextColor(30);
  doc.text("EUROPEAN PATENT APPLICATION", pageW / 2, y, { align: "center" });

  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(80);
  doc.text(`Reference: ${reference}`, pageW / 2, y, { align: "center" });

  y += 7;
  doc.setFontSize(10);
  doc.text(`Applicant: ${applicant} · Filing Year: ${filingDate}`, pageW / 2, y, { align: "center" });

  y += 7;
  doc.setFontSize(8);
  doc.text(`IPC Classes: ${ipcClasses.join(" | ")}`, pageW / 2, y, { align: "center" });

  // ── Separator ──
  y += 10;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageW - marginR, y);

  // ── Abstract ──
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text("ABSTRACT", marginL, y);

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(50);
  const absLines = doc.splitTextToSize(abs, maxW);
  doc.text(absLines, marginL, y);
  y += absLines.length * 4.2;

  // ── Claims section ──
  y += 8;
  doc.setDrawColor(180);
  doc.line(marginL, y, pageW - marginR, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text("CLAIMS", marginL, y);
  y += 4;

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    `Total: ${claims.length} claims · Independent: ${claims.filter(c => c.type === "Independent").length} · Dependent: ${claims.filter(c => c.type === "Dependent").length}`,
    marginL,
    y + 4
  );
  y += 12;

  // ── Render each claim ──
  claims.forEach((claim) => {
    checkPage(30);

    // Claim header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30);
    const header = `Claim ${claim.number} — ${claim.category} (${claim.type})`;
    doc.text(header, marginL, y);

    if (claim.dependsOn) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      doc.text(`Depends on Claim ${claim.dependsOn}`, pageW - marginR, y, { align: "right" });
    }

    y += 5;

    // Claim text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(50);

    const textLines = Array.isArray(claim.text) ? claim.text : [claim.text];
    textLines.forEach((line) => {
      checkPage(12);
      const wrapped = doc.splitTextToSize(line, maxW - 4);
      doc.text(wrapped, marginL + 4, y);
      y += wrapped.length * 3.8 + 1;
    });

    y += 4;
  });

  // ── Footer on last page ──
  y = pageH - 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`© ${new Date().getFullYear()} AFROFINTEK GmbH — All Rights Reserved`, pageW / 2, y, { align: "center" });
  doc.text("This document is an abstract representation of the patent application.", pageW / 2, y + 4, { align: "center" });

  // ── Page numbers ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${totalPages}`, pageW - marginR, pageH - 10, { align: "right" });
  }

  doc.save(`${reference}_Patent_Claims.pdf`);
}
