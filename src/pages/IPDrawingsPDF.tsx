import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, PageBreak, SectionType } from "docx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileDown, FileText, Pencil } from "lucide-react";

/**
 * IP Submission Technical Drawings — Patent-Format
 * 
 * Generates formal patent-style technical drawings (FIG. 1–5) with:
 * - Black & white line art (patent office compliant)
 * - Reference numerals (100, 200, 300…)
 * - Standard patent figure numbering
 * - Reference numeral legend per figure
 * - Formal title block and description sheet
 */
export default function IPDrawingsPDF() {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentW = W - margin * 2;
      let y = margin;

      const addPage = () => { doc.addPage(); y = margin; };

      // Patent drawings are B&W
      const black: [number, number, number] = [0, 0, 0];
      const white: [number, number, number] = [255, 255, 255];
      const lightGray: [number, number, number] = [200, 200, 200];
      const midGray: [number, number, number] = [140, 140, 140];
      const darkGray: [number, number, number] = [80, 80, 80];

      // ── Drawing border (patent standard) ──
      const drawBorder = () => {
        doc.setDrawColor(...black);
        doc.setLineWidth(0.5);
        doc.rect(10, 10, W - 20, H - 20);
        doc.setLineWidth(0.2);
        doc.rect(12, 12, W - 24, H - 24);
      };

      // Patent application details
      const PATENT_REF = "AFR001PEP";
      const PATENT_TITLE = "System and Method for Generating and Verifying\nDigital Location Identifiers Using Grid-Based\nTerritorial Tessellation and Multi-Source Trust Verification";
      const PATENT_TITLE_SHORT = "Grid-Based Territorial Tessellation & Trust Verification";
      const APPLICANT = "AFROFINTEK GmbH";

      // ── Title block (EP patent format) ──
      const drawTitleBlock = (figNum: number, title: string, sheetNum: number, totalSheets: number) => {
        const tbY = H - 34;
        doc.setDrawColor(...black);
        doc.setLineWidth(0.3);
        doc.line(margin, tbY, W - margin, tbY);
        doc.line(margin, tbY + 8, W - margin, tbY + 8);
        doc.line(margin, tbY + 16, W - margin, tbY + 16);

        // Row 1: Applicant | FIG | Sheet
        doc.setTextColor(...black);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(APPLICANT, margin + 2, tbY + 5);
        doc.text(figNum > 0 ? `FIG. ${figNum}` : "", W / 2, tbY + 5, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(`Sheet ${sheetNum} of ${totalSheets}`, W - margin - 2, tbY + 5, { align: "right" });

        // Row 2: Reference | Title
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(`Ref: ${PATENT_REF}`, margin + 2, tbY + 13);
        doc.setFont("helvetica", "normal");
        doc.text(title, W / 2, tbY + 13, { align: "center" });
        doc.text(`Date: ${new Date().toISOString().split("T")[0]}`, W - margin - 2, tbY + 13, { align: "right" });

        // Row 3: Patent title
        doc.setFontSize(6);
        doc.text(PATENT_TITLE_SHORT, W / 2, tbY + 21, { align: "center" });
      };

      // ── Reference numeral label ──
      const refLabel = (x: number, ry: number, num: number, desc: string) => {
        doc.setTextColor(...black);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(`${num}`, x, ry);
        doc.setFont("helvetica", "normal");
        doc.text(` — ${desc}`, x + doc.getTextWidth(`${num}`), ry);
      };

      // ── Drawing helpers ──
      const drawBox = (x: number, bY: number, w: number, h: number, label: string, refNum: number, filled = false) => {
        doc.setDrawColor(...black);
        doc.setLineWidth(0.4);
        if (filled) {
          doc.setFillColor(230, 230, 230);
          doc.rect(x, bY, w, h, "FD");
        } else {
          doc.rect(x, bY, w, h, "S");
        }
        doc.setTextColor(...black);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(label, w - 4);
        const textY = bY + h / 2 - (lines.length - 1) * 2;
        lines.forEach((line: string, i: number) => {
          doc.text(line, x + w / 2, textY + i * 3.5, { align: "center" });
        });
        // Reference numeral
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${refNum}`, x + w + 2, bY + 4);
      };

      const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
        doc.setDrawColor(...black);
        doc.setLineWidth(0.4);
        doc.line(x1, y1, x2, y2);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 2;
        doc.line(x2, y2, x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        doc.line(x2, y2, x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      };

      const drawDiamond = (cx: number, cy: number, size: number, label: string, refNum: number) => {
        doc.setDrawColor(...black);
        doc.setLineWidth(0.4);
        doc.setFillColor(...white);
        // Draw diamond with lines
        doc.line(cx, cy - size, cx + size, cy);
        doc.line(cx + size, cy, cx, cy + size);
        doc.line(cx, cy + size, cx - size, cy);
        doc.line(cx - size, cy, cx, cy - size);
        doc.setTextColor(...black);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(label, size * 1.6);
        lines.forEach((line: string, i: number) => {
          doc.text(line, cx, cy - (lines.length - 1) * 1.5 + i * 3, { align: "center" });
        });
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${refNum}`, cx + size + 3, cy - size + 3);
      };

      const dashedLine = (x1: number, y1: number, x2: number, y2: number) => {
        doc.setLineDashPattern([1.5, 1], 0);
        doc.setDrawColor(...black);
        doc.setLineWidth(0.3);
        doc.line(x1, y1, x2, y2);
        doc.setLineDashPattern([], 0);
      };

      const totalSheets = 9; // cover + 6 figures + legend sheet + claim cross-ref

      // ═══════════════════════════════════════════════════════════
      // COVER SHEET — Drawing Description
      // ═══════════════════════════════════════════════════════════
      drawBorder();
      y = 30;
      doc.setTextColor(...black);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("TECHNICAL DRAWINGS", W / 2, y, { align: "center" });
      y += 5;
      doc.setFontSize(10);
      doc.text("for European Patent Application", W / 2, y, { align: "center" });

      y += 10;
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y);

      y += 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Our Reference: ${PATENT_REF}`, margin, y); y += 6;
      doc.setFont("helvetica", "normal");

      y += 2;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(
        "System and Method for Generating and Verifying Digital Location Identifiers Using Grid-Based Territorial Tessellation and Multi-Source Trust Verification",
        contentW
      );
      titleLines.forEach((line: string) => {
        doc.text(line, W / 2, y, { align: "center" });
        y += 5;
      });

      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Applicant: ${APPLICANT}`, margin, y); y += 6;
      doc.text(`Filing Date: ${new Date().toISOString().split("T")[0]}`, margin, y); y += 6;
      doc.text("Patent Attorney: Dr. Hendrik Wahl — GK Patentanwälte, Regensburg", margin, y); y += 8;

      doc.setFontSize(8);
      doc.text("IPC Classifications:", margin, y); y += 5;
      doc.text("  G06F 16/29  — Geospatial data processing", margin, y); y += 4;
      doc.text("  G06F 16/955 — Structured data indexing", margin, y); y += 4;
      doc.text("  H04W 4/02   — Location-based services", margin, y); y += 4;
      doc.text("  G06Q 10/10  — Digital identity and verification systems", margin, y); y += 10;

      const maxContentY = H - 40;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("LIST OF DRAWINGS", margin, y); y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);

      const drawingsList = [
        "FIG. 1 — Grid Projection Model: Coordinate transformation pipeline from WGS84 geographic coordinates through EPSG:3857 Web Mercator projection to grid-based digital location identifier (Claims 1-3, 14-16)",
        "FIG. 2 — Adaptive Subdivision Tiers: Density-based hierarchical cell subdivision from 2×2 to 5×5 granularity, dynamically determined by certification density within each parent grid cell (Claims 4-5, 17)",
        "FIG. 3 — Zone Detection Pipeline: Three-tier priority-based classification of geographic locations as urban or rural, controlling grid cell resolution (Claims 6-7, 18)",
        "FIG. 4 — Offline Capture and Reconciliation Workflow: Offline data capture with idempotent synchronization and server-side authoritative code reconciliation (Claims 8-10, 19)",
        "FIG. 5 — Multi-Source Trust Verification Architecture: Five-layer trust chain from address registration through institutional certification (Claims 11-13, 20-21)",
        "FIG. 6 — System Overview: Complete system architecture showing the interrelation of all subsystems from coordinate input to verified digital location identifier output",
      ];

      let descPageNum = 1;
      drawingsList.forEach((d) => {
        const lines = doc.splitTextToSize(d, contentW - 4);
        const paragraphHeight = lines.length * 4 + 2;
        if (y + paragraphHeight > maxContentY) {
          drawTitleBlock(0, `Drawing Description Sheet (${descPageNum})`, descPageNum, totalSheets);
          descPageNum++;
          addPage();
          drawBorder();
          y = 22;
        }
        lines.forEach((line: string) => { doc.text(line, margin + 4, y); y += 4; });
        y += 2;
      });

      y += 6;
      if (y + 8 > maxContentY) {
        drawTitleBlock(0, `Drawing Description Sheet (${descPageNum})`, descPageNum, totalSheets);
        descPageNum++;
        addPage();
        drawBorder();
        y = 22;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("BRIEF DESCRIPTION OF DRAWINGS", margin, y); y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const briefDesc = [
        "FIG. 1 is a block diagram illustrating the coordinate projection pipeline according to a preferred embodiment of the invention (Claim 1). The pipeline transforms WGS84 geographic coordinates (100) through EPSG:3857 Web Mercator projection (102) into metric grid indices (104), which are subsequently encoded in base-36 alphanumeric format (106) to produce a unique digital location identifier (108). The zone detection module (110) determines the grid cell resolution as urban (112, 10m) or rural (114, 25m).",
        "FIG. 2 is a set of grid diagrams showing the four tiers of adaptive cell subdivision according to Claims 4-5. The subdivision granularity is dynamically determined by the certification density within each parent grid cell: 2x2 at low density (200, <=10), 3x3 at medium density (202, <=50), 4x4 at high density (204, <=150), and 5x5 at very high density (206, >150). The density progression indicator (220) shows the continuous scaling mechanism.",
        "FIG. 3 is a decision flowchart depicting the three-priority zone detection pipeline according to Claims 6-7. A geographic coordinate input (300) is classified through three decision stages: explicit zone override (302), polygon containment check (306), and keyword-based fallback detection (310), yielding urban (308, 312) or rural (314) classification.",
        "FIG. 4 is a sequence diagram illustrating the offline data capture and server-side reconciliation workflow according to Claims 8-10. A field operator (400) captures coordinates which are encoded locally by the client SDK (402), queued in persistent offline storage (404), and upon connectivity restoration (418), batch-synchronized with the server endpoint (406) which performs authoritative zone verification (422) and code recalculation (424).",
        "FIG. 5 is a layered architecture diagram showing the five-tier multi-source trust verification chain according to Claims 11-13. The chain progresses from address registration (508) through identity binding (506), GPS/photo validation (504), community witness verification (502), to institutional authority certification (500). An authorization level progression scale (510) quantifies the cumulative trust level.",
        "FIG. 6 is a system overview diagram showing the complete architecture of the invention. It illustrates how the grid-based territorial tessellation subsystem (600) connects to the adaptive subdivision engine (602), the zone classification module (604), the offline reconciliation system (606), and the multi-source trust verification chain (608) to produce a verified digital location identifier (610).",
      ];
      briefDesc.forEach((d) => {
        const lines = doc.splitTextToSize(d, contentW);
        const paragraphHeight = lines.length * 3.8 + 3;
        if (y + paragraphHeight > maxContentY) {
          drawTitleBlock(0, `Drawing Description Sheet (${descPageNum})`, descPageNum, totalSheets);
          descPageNum++;
          addPage();
          drawBorder();
          y = 22;
        }
        lines.forEach((line: string) => { doc.text(line, margin, y); y += 3.8; });
        y += 3;
      });

      drawTitleBlock(0, `Drawing Description Sheet (${descPageNum})`, descPageNum, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // FIG. 1 — QG Grid Projection Model
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setTextColor(...black);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("FIG. 1", W / 2, y, { align: "center" });
      y += 12;

      // Pipeline blocks — calculate sizes to fit within content area
      const pipeY = y;
      const numBoxes = 5; // 4 process + 1 output
      const numGaps = 4;
      const totalGapSpace = contentW * 0.15; // 15% for gaps
      const singleGap = totalGapSpace / numGaps;
      const totalBoxSpace = contentW - totalGapSpace;
      const bw = totalBoxSpace / numBoxes;
      const bh = 16;
      const startX = margin;

      drawBox(startX, pipeY, bw, bh, "WGS84\nCoordinates\n(lat, lon)", 100);
      drawArrow(startX + bw, pipeY + bh / 2, startX + bw + singleGap, pipeY + bh / 2);

      const x2 = startX + bw + singleGap;
      drawBox(x2, pipeY, bw, bh, "Web Mercator\nProjection\n(EPSG:3857)", 102);
      drawArrow(x2 + bw, pipeY + bh / 2, x2 + bw + singleGap, pipeY + bh / 2);

      const x3 = x2 + bw + singleGap;
      drawBox(x3, pipeY, bw, bh, "Grid Index\nComputation\n(ix = ⌊x/g⌋)", 104);
      drawArrow(x3 + bw, pipeY + bh / 2, x3 + bw + singleGap, pipeY + bh / 2);

      const x4 = x3 + bw + singleGap;
      drawBox(x4, pipeY, bw, bh, "Base-36\nEncoding\n(ix → b36)", 106);
      drawArrow(x4 + bw, pipeY + bh / 2, x4 + bw + singleGap, pipeY + bh / 2);

      // Output box
      const x5 = x4 + bw + singleGap;
      doc.setDrawColor(...black);
      doc.setLineWidth(0.6);
      doc.rect(x5, pipeY + 2, bw, bh - 4, "S");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("AFROLOC", x5 + bw / 2, pipeY + bh / 2 - 1, { align: "center" });
      doc.text("Code", x5 + bw / 2, pipeY + bh / 2 + 3, { align: "center" });
      doc.setFontSize(8);
      doc.text("108", x5 + bw + 2, pipeY + 4);

      y = pipeY + bh + 14;

      // Zone determination branch — centered under the second box (Web Mercator)
      const zoneW = bw + 4;
      const zoneCenterX = x2 + bw / 2 - zoneW / 2;
      drawBox(zoneCenterX, y, zoneW, 12, "Zone Detection\n(urban/rural)", 110, true);
      drawArrow(zoneCenterX + zoneW / 2, pipeY + bh, zoneCenterX + zoneW / 2, y);
      // Label: determines cell size
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("determines", zoneCenterX + zoneW + 2, pipeY + bh + 6);
      doc.text("cell size (g)", zoneCenterX + zoneW + 2, pipeY + bh + 10);

      // Grid cell size boxes
      const urbanBoxX = startX;
      const ruralBoxX = startX + 35;
      drawBox(urbanBoxX, y + 18, 28, 10, "Urban: g=10m", 112);
      drawBox(ruralBoxX, y + 18, 28, 10, "Rural: g=25m", 114);
      drawArrow(zoneCenterX + zoneW / 2 - 8, y + 12, urbanBoxX + 14, y + 18);
      drawArrow(zoneCenterX + zoneW / 2 + 8, y + 12, ruralBoxX + 14, y + 18);

      y += 38;

      // Grid visualization
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Grid Cell Structure:", margin, y); y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("120", margin + contentW - 10, y - 2);

      const gridX = margin + 20;
      const gridCellSz = 10;
      // Draw 6x6 grid
      doc.setDrawColor(...midGray);
      doc.setLineWidth(0.2);
      for (let r = 0; r <= 6; r++) {
        doc.line(gridX, y + r * gridCellSz, gridX + 6 * gridCellSz, y + r * gridCellSz);
        doc.line(gridX + r * gridCellSz, y, gridX + r * gridCellSz, y + 6 * gridCellSz);
      }
      // Highlight target cell
      doc.setDrawColor(...black);
      doc.setLineWidth(0.8);
      doc.rect(gridX + 3 * gridCellSz, y + 2 * gridCellSz, gridCellSz, gridCellSz, "S");
      // Cross-hatch target
      doc.setLineWidth(0.15);
      for (let d = 0; d < gridCellSz; d += 2) {
        doc.line(gridX + 3 * gridCellSz + d, y + 2 * gridCellSz, gridX + 3 * gridCellSz, y + 2 * gridCellSz + d);
        doc.line(gridX + 4 * gridCellSz, y + 2 * gridCellSz + gridCellSz - d, gridX + 3 * gridCellSz + gridCellSz - d, y + 3 * gridCellSz);
      }
      // Ref numeral for highlighted cell
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("122", gridX + 4 * gridCellSz + 3, y + 2 * gridCellSz + 5);

      // Axis labels
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("ix →", gridX + 6 * gridCellSz + 3, y + 3 * gridCellSz);
      doc.text("iy ↓", gridX - 8, y + 3 * gridCellSz + 2);

      // Code format annotation
      const codeY = y + 10;
      doc.setFontSize(7);
      doc.setFont("courier", "normal");
      doc.text("CC-ZT-GS-X{b36(ix)}-Y{b36(iy)}", gridX + 6 * gridCellSz + 15, codeY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.text("124 — Code format", gridX + 6 * gridCellSz + 15, codeY + 5);

      y += 6 * gridCellSz + 12;

      // Reference numeral legend
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("REFERENCE NUMERALS — FIG. 1", margin, y); y += 5;

      const fig1Refs = [
        [100, "WGS84 coordinate input module"],
        [102, "Web Mercator projection transformer (EPSG:3857)"],
        [104, "Grid index computation unit (floor division by cell size)"],
        [106, "Base-36 encoding module"],
        [108, "AFROLOC code output"],
        [110, "Zone detection module (urban/rural classifier)"],
        [112, "Urban cell size parameter (10 meters)"],
        [114, "Rural cell size parameter (25 meters)"],
        [120, "Grid cell matrix"],
        [122, "Target cell (identified by ix, iy indices)"],
        [124, "AFROLOC code format specification"],
      ];
      fig1Refs.forEach(([num, desc]) => {
        refLabel(margin + 4, y, num as number, desc as string);
        y += 4;
      });

      drawTitleBlock(1, "QG Grid Projection Model", 2, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // FIG. 2 — SQ Subdivision Tiers
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("FIG. 2", W / 2, y, { align: "center" });
      y += 10;

      const sqTiers = [
        { dim: 2, labels: ["A", "B", "C", "D"], ref: 200, densityRef: 210, densityLabel: "≤10 certifications" },
        { dim: 3, labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], ref: 202, densityRef: 212, densityLabel: "≤50 certifications" },
        { dim: 4, labels: ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"], ref: 204, densityRef: 214, densityLabel: "≤150 certifications" },
        { dim: 5, labels: Array.from({ length: 25 }, (_, i) => `${String.fromCharCode(65 + Math.floor(i / 5))}${(i % 5) + 1}`), ref: 206, densityRef: 216, densityLabel: ">150 certifications" },
      ];

      const sqBaseSize = 32;
      sqTiers.forEach((tier, ti) => {
        const ox = margin + 8 + (ti % 2) * 85;
        const oy = y + Math.floor(ti / 2) * 58;
        const cellSz = sqBaseSize / tier.dim;

        // Tier title
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${tier.dim}×${tier.dim} Subdivision`, ox + sqBaseSize / 2, oy - 4, { align: "center" });

        // Density threshold
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text(`(${tier.densityLabel})`, ox + sqBaseSize / 2, oy, { align: "center" });

        // Grid lines
        doc.setDrawColor(...midGray);
        doc.setLineWidth(0.2);
        for (let r = 0; r <= tier.dim; r++) {
          doc.line(ox, oy + 3 + r * cellSz, ox + tier.dim * cellSz, oy + 3 + r * cellSz);
          doc.line(ox + r * cellSz, oy + 3, ox + r * cellSz, oy + 3 + tier.dim * cellSz);
        }

        // Cell labels
        doc.setFontSize(tier.dim <= 3 ? 7 : 5);
        doc.setFont("helvetica", "normal");
        tier.labels.forEach((lbl, li) => {
          const col = li % tier.dim;
          const row = Math.floor(li / tier.dim);
          doc.setTextColor(...black);
          doc.text(lbl, ox + col * cellSz + cellSz / 2, oy + 3 + row * cellSz + cellSz / 2 + 1, { align: "center" });
        });

        // Outer border
        doc.setDrawColor(...black);
        doc.setLineWidth(0.6);
        doc.rect(ox, oy + 3, tier.dim * cellSz, tier.dim * cellSz, "S");

        // Reference numeral
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${tier.ref}`, ox + tier.dim * cellSz + 3, oy + 6);
      });

      y += 124;

      // Density progression arrow
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("220", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text("Density progression →", margin + 8, y);
      drawArrow(margin + 50, y - 2, W - margin - 10, y - 2);
      y += 3;
      doc.setFontSize(6);
      doc.text("Low density", margin + 50, y + 3);
      doc.text("Very high density", W - margin - 35, y + 3);

      y += 12;

      // Reference legend
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("REFERENCE NUMERALS — FIG. 2", margin, y); y += 5;

      const fig2Refs = [
        [200, "2×2 subdivision grid (4 sub-cells, labels A–D)"],
        [202, "3×3 subdivision grid (9 sub-cells, labels 1–9)"],
        [204, "4×4 subdivision grid (16 sub-cells, labels A1–D4)"],
        [206, "5×5 subdivision grid (25 sub-cells, labels A1–E5)"],
        [210, "Low density threshold (≤10 certifications)"],
        [212, "Medium density threshold (≤50 certifications)"],
        [214, "High density threshold (≤150 certifications)"],
        [216, "Very high density threshold (>150 certifications)"],
        [220, "Density progression indicator"],
      ];
      fig2Refs.forEach(([num, desc]) => {
        refLabel(margin + 4, y, num as number, desc as string);
        y += 4;
      });

      drawTitleBlock(2, "SQ Adaptive Subdivision Tiers", 3, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // FIG. 3 — Zone Detection Pipeline
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("FIG. 3", W / 2, y, { align: "center" });
      y += 12;

      const cx = W / 2;
      const pY = y;

      // Start
      drawBox(cx - 22, pY, 44, 12, "Input Coordinates\n(latitude, longitude)", 300);
      drawArrow(cx, pY + 12, cx, pY + 20);

      // Decision 1
      drawDiamond(cx, pY + 30, 12, "Explicit\noverride\nprovided?", 302);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("YES", cx + 14, pY + 27);
      drawArrow(cx + 12, pY + 30, cx + 35, pY + 30);
      drawBox(cx + 35, pY + 24, 38, 12, "Use specified\nzone value", 304);

      doc.text("NO", cx - 6, pY + 44);
      drawArrow(cx, pY + 42, cx, pY + 52);

      // Decision 2
      drawDiamond(cx, pY + 64, 12, "PostGIS\nST_Contains\nmatch?", 306);
      doc.setFontSize(7);
      doc.text("YES", cx + 14, pY + 61);
      drawArrow(cx + 12, pY + 64, cx + 35, pY + 64);
      drawBox(cx + 35, pY + 58, 38, 12, "Urban zone\n(G10, 10m cells)", 308);

      doc.text("NO", cx - 6, pY + 78);
      drawArrow(cx, pY + 76, cx, pY + 86);

      // Decision 3
      drawDiamond(cx, pY + 98, 12, "Keyword\nfallback\nmatch?", 310);
      doc.setFontSize(7);
      doc.text("YES", cx + 14, pY + 95);
      drawArrow(cx + 12, pY + 98, cx + 35, pY + 98);
      drawBox(cx + 35, pY + 92, 38, 12, "Urban zone\n(offline detection)", 312);

      doc.text("NO", cx - 6, pY + 112);
      drawArrow(cx, pY + 110, cx, pY + 118);

      // Default
      drawBox(cx - 22, pY + 118, 44, 12, "Rural zone\n(G25, 25m cells)", 314, true);

      // Priority labels
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text("PRIORITY 1", margin + 2, pY + 30);
      doc.text("PRIORITY 2", margin + 2, pY + 64);
      doc.text("PRIORITY 3", margin + 2, pY + 98);
      // Dashed grouping
      dashedLine(margin + 18, pY + 20, margin + 18, pY + 42);
      dashedLine(margin + 18, pY + 52, margin + 18, pY + 76);
      dashedLine(margin + 18, pY + 86, margin + 18, pY + 110);

      y = pY + 140;

      // Reference legend
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("REFERENCE NUMERALS — FIG. 3", margin, y); y += 5;

      const fig3Refs = [
        [300, "Geographic coordinate input"],
        [302, "Explicit zone override decision point"],
        [304, "User-specified zone value output"],
        [306, "PostGIS polygon containment check (ST_Contains)"],
        [308, "Urban zone classification via polygon match"],
        [310, "Keyword-based zone detection (offline fallback)"],
        [312, "Urban zone classification via keyword match"],
        [314, "Default rural zone classification"],
      ];
      fig3Refs.forEach(([num, desc]) => {
        refLabel(margin + 4, y, num as number, desc as string);
        y += 4;
      });

      drawTitleBlock(3, "Zone Detection Pipeline", 4, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // FIG. 4 — Offline/Sync Reconciliation Workflow
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("FIG. 4", W / 2, y, { align: "center" });
      y += 10;

      const seqY = y;
      const actors = [
        { label: "Field\nOperator", x: margin + 18, ref: 400 },
        { label: "Client\nSDK", x: margin + 55, ref: 402 },
        { label: "IndexedDB\nOutbox", x: margin + 92, ref: 404 },
        { label: "sync-places\nEndpoint", x: margin + 132, ref: 406 },
      ];

      // Actor boxes
      actors.forEach((a) => {
        drawBox(a.x - 14, seqY, 28, 12, a.label, a.ref);
        // Lifeline
        dashedLine(a.x, seqY + 12, a.x, seqY + 130);
      });

      // Messages
      const seqMsg = (from: number, to: number, mY: number, label: string, refNum: number, dashed = false) => {
        const x1 = actors[from].x;
        const x2 = actors[to].x;
        if (dashed) {
          doc.setLineDashPattern([1.5, 1], 0);
        }
        drawArrow(x1, mY, x2, mY);
        doc.setLineDashPattern([], 0);
        doc.setTextColor(...black);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text(label, (x1 + x2) / 2, mY - 2, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text(`${refNum}`, Math.max(x1, x2) + 3, mY + 1);
      };

      seqMsg(0, 1, seqY + 24, "capture(lat, lon)", 410);
      seqMsg(1, 1, seqY + 34, "encode() → local code", 412);
      seqMsg(1, 2, seqY + 44, "enqueue(hash, data)", 414);
      seqMsg(2, 2, seqY + 54, "persist offline", 416);

      // Connectivity restored line
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([3, 2], 0);
      doc.line(margin, seqY + 62, W - margin, seqY + 62);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text("CONNECTIVITY RESTORED", W / 2, seqY + 60, { align: "center" });
      doc.text("418", W - margin - 8, seqY + 60);

      seqMsg(2, 3, seqY + 72, "POST /sync-places", 420);
      seqMsg(3, 3, seqY + 82, "PostGIS zone verify", 422);
      seqMsg(3, 3, seqY + 90, "recalculate AFROLOC", 424);
      seqMsg(3, 2, seqY + 100, "ACK {official_code}", 426, true);
      seqMsg(2, 1, seqY + 110, "update local store", 428, true);
      seqMsg(1, 0, seqY + 120, "sync complete ✓", 430, true);

      y = seqY + 140;

      // Reference legend
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("REFERENCE NUMERALS — FIG. 4", margin, y); y += 5;

      const fig4Refs = [
        [400, "Field operator (mobile device user)"],
        [402, "Client-side AFROLOC SDK (offline-capable)"],
        [404, "IndexedDB outbox queue (persistent local storage)"],
        [406, "Server-side sync-places endpoint"],
        [410, "Coordinate capture event"],
        [412, "Local AFROLOC code generation (encode operation)"],
        [414, "Outbox enqueue with SHA-256 conflict hash"],
        [416, "Offline data persistence"],
        [418, "Network connectivity restoration event"],
        [420, "Batch synchronization request"],
        [422, "Server-side PostGIS zone verification"],
        [424, "Authoritative AFROLOC code recalculation"],
        [426, "Server acknowledgment with official code"],
        [428, "Local database update with authoritative data"],
        [430, "Synchronization completion notification"],
      ];
      fig4Refs.forEach(([num, desc]) => {
        refLabel(margin + 4, y, num as number, desc as string);
        y += 4;
      });

      drawTitleBlock(4, "Offline/Sync Reconciliation Workflow", 5, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // FIG. 5 — Trust Verification Architecture
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("FIG. 5", W / 2, y, { align: "center" });
      y += 10;

      const layerH = 16;
      const layerGap = 4;
      const layerW = contentW - 10;
      const lx = margin + 5;

      const trustLayers = [
        { label: "Layer 5: Institutional Validation", sub: "DFI/State Authority verification · Authority signature · Official certification", ref: 500 },
        { label: "Layer 4: Community Verification", sub: "2+ witnesses with OTP · Witness reputation scoring · Proximity check", ref: 502 },
        { label: "Layer 3: GPS & Photo Validation", sub: "GPS spoofing detection · EXIF metadata · Geofence radius check", ref: 504 },
        { label: "Layer 2: Identity Binding", sub: "Phone OTP verification · Device fingerprint · Biometric authentication", ref: 506 },
        { label: "Layer 1: Address Registration", sub: "AFROLOC code generation · Zone detection · Offline capture + sync", ref: 508 },
      ];

      trustLayers.forEach((layer, i) => {
        const ly = y + i * (layerH + layerGap);
        // Draw with hatching pattern for different layers
        doc.setDrawColor(...black);
        doc.setLineWidth(0.5);
        doc.rect(lx, ly, layerW, layerH, "S");

        // Hatching density varies by layer
        doc.setLineWidth(0.1);
        doc.setDrawColor(...lightGray);
        const hatchSpacing = 3 + i;
        for (let hx = 0; hx < layerW; hx += hatchSpacing) {
          doc.line(lx + hx, ly, lx + Math.min(hx + layerH, layerW), ly + Math.min(layerH, layerW - hx));
        }

        // Text
        doc.setTextColor(...black);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(layer.label, lx + 4, ly + 6);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text(layer.sub, lx + 4, ly + 12);

        // Ref numeral
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${layer.ref}`, lx + layerW + 3, ly + 5);

        // Arrow between layers
        if (i < trustLayers.length - 1) {
          drawArrow(lx + layerW / 2, ly + layerH + layerGap - 1, lx + layerW / 2, ly + layerH + 1);
        }
      });

      y += trustLayers.length * (layerH + layerGap) + 8;

      // Authorization level progression
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Authorization Level Progression", margin, y);
      doc.text("510", margin + contentW - 5, y);
      y += 6;

      const levels = [
        { level: "L0", name: "Registado", req: "Phone verified", pct: 10 },
        { level: "L1", name: "Básico", req: "+ GPS location", pct: 25 },
        { level: "L2", name: "Verificado", req: "+ 2 witnesses", pct: 50 },
        { level: "L3", name: "Certificado", req: "+ Photo + EXIF", pct: 75 },
        { level: "L4", name: "Institucional", req: "+ Authority sign", pct: 100 },
      ];

      levels.forEach((l, i) => {
        const barLY = y + i * 8;
        // Bar outline
        doc.setDrawColor(...black);
        doc.setLineWidth(0.3);
        doc.rect(margin + 40, barLY, 80, 5, "S");
        // Fill with cross-hatch
        const fillW = 80 * (l.pct / 100);
        doc.setFillColor(220, 220, 220);
        doc.rect(margin + 40, barLY, fillW, 5, "F");
        doc.setDrawColor(...black);
        doc.rect(margin + 40, barLY, fillW, 5, "S");
        // Labels
        doc.setTextColor(...black);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text(l.level, margin, barLY + 4);
        doc.setFont("helvetica", "normal");
        doc.text(l.name, margin + 8, barLY + 4);
        doc.text(l.req, margin + 125, barLY + 4);
        doc.text(`${l.pct}%`, margin + 40 + fillW + 2, barLY + 4);
      });

      y += 48;

      // Reference legend
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("REFERENCE NUMERALS — FIG. 5", margin, y); y += 5;

      const fig5Refs = [
        [500, "Institutional validation layer (highest trust tier)"],
        [502, "Community witness verification layer"],
        [504, "GPS and photographic evidence validation layer"],
        [506, "Identity binding layer (phone, device, biometric)"],
        [508, "Address registration layer (AFROLOC code generation)"],
        [510, "Authorization level progression scale (L0–L4)"],
      ];
      fig5Refs.forEach(([num, desc]) => {
        refLabel(margin + 4, y, num as number, desc as string);
        y += 4;
      });

      drawTitleBlock(5, "Trust Verification Architecture", 6, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // FIG. 6 — System Overview
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("FIG. 6", W / 2, y, { align: "center" });
      y += 12;

      // System overview - central architecture diagram
      const sysX = margin + 5;
      const sysW = contentW - 10;

      // Input
      drawBox(sysX + sysW / 2 - 25, y, 50, 12, "Geographic\nCoordinates (lat, lon)", 600);
      drawArrow(sysX + sysW / 2, y + 12, sysX + sysW / 2, y + 20);

      y += 22;
      // Grid Tessellation Engine (main box)
      doc.setDrawColor(...black);
      doc.setLineWidth(0.6);
      doc.rect(sysX, y, sysW, 50, "S");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("GRID-BASED TERRITORIAL TESSELLATION ENGINE", sysX + sysW / 2, y + 5, { align: "center" });
      doc.setFontSize(8);
      doc.text("600", sysX + sysW + 3, y + 5);

      // Internal modules
      const modW = 38;
      const modH = 12;
      const modY = y + 10;
      drawBox(sysX + 5, modY, modW, modH, "Web Mercator\nProjection\n(EPSG:3857)", 601);
      drawArrow(sysX + 5 + modW, modY + modH / 2, sysX + 10 + modW, modY + modH / 2);
      drawBox(sysX + 10 + modW, modY, modW, modH, "Grid Index\nComputation\n(floor div)", 602);
      drawArrow(sysX + 10 + 2 * modW, modY + modH / 2, sysX + 15 + 2 * modW, modY + modH / 2);
      drawBox(sysX + 15 + 2 * modW, modY, modW, modH, "Base-36\nEncoding", 603);

      // Zone detection (inside main box)
      drawBox(sysX + 5, modY + 18, modW + 5, modH, "Zone Detection\n(3-tier pipeline)", 604, true);
      // Adaptive SQ (inside main box)
      drawBox(sysX + modW + 15, modY + 18, modW + 5, modH, "Adaptive SQ\nSubdivision", 605, true);
      // Density cache
      drawBox(sysX + 2 * modW + 25, modY + 18, modW - 5, modH, "Density\nCache", 606, true);

      y += 54;
      // Arrow down to two parallel paths
      drawArrow(sysX + sysW / 3, y - 4, sysX + sysW / 3, y + 4);
      drawArrow(sysX + 2 * sysW / 3, y - 4, sysX + 2 * sysW / 3, y + 4);

      y += 6;
      // Left path: Offline Sync
      drawBox(sysX + 5, y, sysW / 2 - 15, 14, "Offline Capture &\nReconciliation System\n(idempotent sync)", 607);
      // Right path: Trust Verification
      drawBox(sysX + sysW / 2 + 5, y, sysW / 2 - 10, 14, "Multi-Source Trust\nVerification Chain\n(5-layer verification)", 608);

      y += 20;
      // Converge arrows
      drawArrow(sysX + sysW / 3, y - 6, sysX + sysW / 2, y + 2);
      drawArrow(sysX + 2 * sysW / 3, y - 6, sysX + sysW / 2, y + 2);

      y += 4;
      // Output
      doc.setDrawColor(...black);
      doc.setLineWidth(0.8);
      doc.rect(sysX + sysW / 2 - 30, y, 60, 14, "S");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Verified Digital", sysX + sysW / 2, y + 5, { align: "center" });
      doc.text("Location Identifier", sysX + sysW / 2, y + 10, { align: "center" });
      doc.text("610", sysX + sysW / 2 + 33, y + 4);

      y += 24;

      // Claim mapping table
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Claim-to-Figure Mapping:", margin, y); y += 6;

      const claimMap = [
        ["Claims 1-3, 14-16", "FIG. 1", "Grid projection and code generation method/system"],
        ["Claims 4-5, 17", "FIG. 2", "Adaptive hierarchical subdivision"],
        ["Claims 6-7, 18", "FIG. 3", "Zone detection and classification"],
        ["Claims 8-10, 19", "FIG. 4", "Offline capture and reconciliation"],
        ["Claims 11-13, 20-21", "FIG. 5", "Multi-source trust verification"],
      ];

      // Table header
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("Claims", margin + 4, y);
      doc.text("Figure", margin + 50, y);
      doc.text("Subject Matter", margin + 75, y);
      y += 2;
      doc.setDrawColor(...black);
      doc.setLineWidth(0.2);
      doc.line(margin, y, W - margin, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      claimMap.forEach(([claims, fig, desc]) => {
        doc.text(claims, margin + 4, y);
        doc.text(fig, margin + 50, y);
        doc.text(desc, margin + 75, y);
        y += 4;
      });

      y += 6;

      // Reference legend
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("REFERENCE NUMERALS — FIG. 6", margin, y); y += 5;

      const fig6Refs: [number, string][] = [
        [600, "Grid-based territorial tessellation engine (main system)"],
        [601, "Web Mercator projection module (EPSG:3857)"],
        [602, "Grid index computation module (floor division)"],
        [603, "Base-36 alphanumeric encoding module"],
        [604, "Zone detection module (3-tier priority pipeline)"],
        [605, "Adaptive subdivision engine (density-based SQ)"],
        [606, "Density cache and temporal tracking module"],
        [607, "Offline capture and reconciliation subsystem"],
        [608, "Multi-source trust verification chain (5 layers)"],
        [610, "Verified digital location identifier output"],
      ];
      fig6Refs.forEach(([num, desc]) => {
        refLabel(margin + 4, y, num, desc);
        y += 4;
      });

      drawTitleBlock(6, "System Overview", 7, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // MASTER REFERENCE NUMERAL INDEX
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("MASTER REFERENCE NUMERAL INDEX", W / 2, y, { align: "center" });
      y += 10;

      const allRefs = [
        { fig: "FIG. 1", refs: fig1Refs },
        { fig: "FIG. 2", refs: fig2Refs },
        { fig: "FIG. 3", refs: fig3Refs },
        { fig: "FIG. 4", refs: fig4Refs },
        { fig: "FIG. 5", refs: fig5Refs },
        { fig: "FIG. 6", refs: fig6Refs },
      ];

      allRefs.forEach((group) => {
        if (y > H - 50) { addPage(); drawBorder(); y = 22; }
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(group.fig, margin, y);
        y += 4;
        doc.setDrawColor(...lightGray);
        doc.setLineWidth(0.2);
        doc.line(margin, y, W - margin, y);
        y += 3;

        group.refs.forEach(([num, desc]) => {
          if (y > H - 40) { addPage(); drawBorder(); y = 22; }
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "bold");
          doc.text(`${num}`, margin + 4, y);
          doc.setFont("helvetica", "normal");
          doc.text(desc as string, margin + 16, y);
          y += 3.5;
        });
        y += 4;
      });

      drawTitleBlock(0, "Master Reference Numeral Index", 8, totalSheets);

      // ═══════════════════════════════════════════════════════════
      // CLAIM CROSS-REFERENCE SHEET
      // ═══════════════════════════════════════════════════════════
      addPage();
      drawBorder();
      y = 22;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("CLAIM CROSS-REFERENCE TABLE", W / 2, y, { align: "center" });
      y += 10;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("This table maps each patent claim to the corresponding drawing figure(s) and reference numerals.", margin, y);
      y += 8;

      // Header
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      const colWidths = [18, 12, 55, 50];
      const headers = ["Claim", "Type", "Feature Description", "Reference Numerals"];
      let cx2 = margin;
      headers.forEach((h, i) => {
        doc.text(h, cx2 + 2, y);
        cx2 += colWidths[i];
      });
      y += 2;
      doc.setDrawColor(...black);
      doc.setLineWidth(0.3);
      doc.line(margin, y, W - margin, y);
      y += 4;

      const claimsData = [
        ["1", "Ind.", "Method for generating digital location identifier using grid-based tessellation", "100, 102, 104, 106, 108"],
        ["2", "Dep.", "Wherein coordinates are projected using Web Mercator (EPSG:3857)", "102"],
        ["3", "Dep.", "Wherein grid indices are encoded in base-36 alphanumeric format", "106, 124"],
        ["4", "Dep.", "Wherein grid cells are hierarchically subdivided based on density", "200, 202, 204, 206"],
        ["5", "Dep.", "Wherein subdivision granularity ranges from 2×2 to 5×5", "200-206, 220"],
        ["6", "Dep.", "Wherein zone detection uses multi-tier priority hierarchy", "302, 306, 310"],
        ["7", "Dep.", "Wherein urban zones use 10m cells and rural zones use 25m cells", "112, 114, 308, 314"],
        ["8", "Dep.", "Wherein location identifiers are generated offline", "400, 402, 412"],
        ["9", "Dep.", "Wherein offline records are reconciled via idempotent sync", "414, 420, 424"],
        ["10", "Dep.", "Wherein conflict resolution uses cryptographic hashing", "414, 426"],
        ["11", "Dep.", "Wherein trust verification uses multiple independent sources", "500-508"],
        ["12", "Dep.", "Wherein community witnesses provide verification via OTP", "502"],
        ["13", "Dep.", "Wherein GPS and photographic evidence is validated", "504"],
        ["14", "Ind.", "System for generating and verifying digital location identifiers", "600, 610"],
        ["15", "Dep.", "System comprising a grid tessellation engine", "600, 601, 602, 603"],
        ["16", "Dep.", "System comprising a zone detection module", "604"],
        ["17", "Dep.", "System comprising an adaptive subdivision engine", "605, 606"],
        ["18", "Dep.", "System comprising a zone classification module with fallback", "604, 310, 314"],
        ["19", "Dep.", "System comprising an offline reconciliation subsystem", "607"],
        ["20", "Dep.", "System comprising a multi-source trust verification chain", "608"],
        ["21", "Dep.", "System comprising an authorization level progression mechanism", "510"],
      ];

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      claimsData.forEach((row) => {
        if (y > H - 40) { addPage(); drawBorder(); y = 22; }
        let rx = margin;
        row.forEach((cell, i) => {
          if (i === 0 || i === 1) {
            doc.setFont("helvetica", i === 0 ? "bold" : "normal");
          }
          const lines = doc.splitTextToSize(cell, colWidths[i] - 3);
          doc.text(lines[0], rx + 2, y);
          rx += colWidths[i];
        });
        doc.setFont("helvetica", "normal");
        y += 4;
      });

      y += 6;
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Ind. = Independent Claim    Dep. = Dependent Claim", margin, y);
      y += 4;
      doc.text(`Total: 2 independent claims (1, 14) + 19 dependent claims = 21 claims`, margin, y);

      drawTitleBlock(0, "Claim Cross-Reference Table", 9, totalSheets);

      doc.save(`${PATENT_REF}_Technical_Drawings.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  const [generatingWord, setGeneratingWord] = useState(false);

  const generateWord = async () => {
    setGeneratingWord(true);
    try {
      const PATENT_REF = "AFR001PEP";
      const APPLICANT = "AFROFINTEK GmbH";
      const PATENT_TITLE = "System and Method for Generating and Verifying Digital Location Identifiers Using Grid-Based Territorial Tessellation and Multi-Source Trust Verification";
      const today = new Date().toISOString().split("T")[0];

      const drawingsList = [
        "FIG. 1 — Grid Projection Model: Coordinate transformation pipeline from WGS84 geographic coordinates through EPSG:3857 Web Mercator projection to grid-based digital location identifier (Claims 1-3, 14-16)",
        "FIG. 2 — Adaptive Subdivision Tiers: Density-based hierarchical cell subdivision from 2×2 to 5×5 granularity, dynamically determined by certification density within each parent grid cell (Claims 4-5, 17)",
        "FIG. 3 — Zone Detection Pipeline: Three-tier priority-based classification of geographic locations as urban or rural, controlling grid cell resolution (Claims 6-7, 18)",
        "FIG. 4 — Offline Capture and Reconciliation Workflow: Offline data capture with idempotent synchronization and server-side authoritative code reconciliation (Claims 8-10, 19)",
        "FIG. 5 — Multi-Source Trust Verification Architecture: Five-layer trust chain from address registration through institutional certification (Claims 11-13, 20-21)",
        "FIG. 6 — System Overview: Complete system architecture showing the interrelation of all subsystems from coordinate input to verified digital location identifier output",
      ];

      const briefDesc = [
        "FIG. 1 is a block diagram illustrating the coordinate projection pipeline according to a preferred embodiment of the invention (Claim 1). The pipeline transforms WGS84 geographic coordinates (100) through EPSG:3857 Web Mercator projection (102) into metric grid indices (104), which are subsequently encoded in base-36 alphanumeric format (106) to produce a unique digital location identifier (108). The zone detection module (110) determines the grid cell resolution as urban (112, 10m) or rural (114, 25m).",
        "FIG. 2 is a set of grid diagrams showing the four tiers of adaptive cell subdivision according to Claims 4-5. The subdivision granularity is dynamically determined by the certification density within each parent grid cell: 2x2 at low density (200, ≤10), 3x3 at medium density (202, ≤50), 4x4 at high density (204, ≤150), and 5x5 at very high density (206, >150). The density progression indicator (220) shows the continuous scaling mechanism.",
        "FIG. 3 is a decision flowchart depicting the three-priority zone detection pipeline according to Claims 6-7. A geographic coordinate input (300) is classified through three decision stages: explicit zone override (302), polygon containment check (306), and keyword-based fallback detection (310), yielding urban (308, 312) or rural (314) classification.",
        "FIG. 4 is a sequence diagram illustrating the offline data capture and server-side reconciliation workflow according to Claims 8-10. A field operator (400) captures coordinates which are encoded locally by the client SDK (402), queued in persistent offline storage (404), and upon connectivity restoration (418), batch-synchronized with the server endpoint (406) which performs authoritative zone verification (422) and code recalculation (424).",
        "FIG. 5 is a layered architecture diagram showing the five-tier multi-source trust verification chain according to Claims 11-13. The chain progresses from address registration (508) through identity binding (506), GPS/photo validation (504), community witness verification (502), to institutional authority certification (500). An authorization level progression scale (510) quantifies the cumulative trust level.",
        "FIG. 6 is a system overview diagram showing the complete architecture of the invention. It illustrates how the grid-based territorial tessellation subsystem (600) connects to the adaptive subdivision engine (602), the zone classification module (604), the offline reconciliation system (606), and the multi-source trust verification chain (608) to produce a verified digital location identifier (610).",
      ];

      const refNumerals: Record<string, [number, string][]> = {
        "FIG. 1": [[100, "WGS84 coordinate input module"], [102, "Web Mercator projection transformer (EPSG:3857)"], [104, "Grid index computation unit"], [106, "Base-36 encoding module"], [108, "AFROLOC code output"], [110, "Zone detection module (urban/rural classifier)"], [112, "Urban cell size parameter (10 meters)"], [114, "Rural cell size parameter (25 meters)"], [120, "Grid cell matrix"], [122, "Target cell (identified by ix, iy indices)"], [124, "AFROLOC code format specification"]],
        "FIG. 2": [[200, "2×2 subdivision tier (low density ≤10)"], [202, "3×3 subdivision tier (medium density ≤50)"], [204, "4×4 subdivision tier (high density ≤150)"], [206, "5×5 subdivision tier (very high density >150)"], [210, "Parent grid cell boundary"], [212, "Sub-cell identifier"], [214, "Density threshold indicator"], [220, "Density progression scale"]],
        "FIG. 3": [[300, "Geographic coordinate input"], [302, "Priority 1: Explicit zone override check"], [304, "Override parameter present decision"], [306, "Priority 2: PostGIS polygon containment query"], [308, "Urban zone classification output"], [310, "Priority 3: Keyword-based fallback detection"], [312, "Urban keyword match output"], [314, "Rural default classification"]],
        "FIG. 4": [[400, "Field operator / mobile device"], [402, "Client SDK local encoder"], [404, "Persistent offline storage queue"], [406, "Server reconciliation endpoint"], [410, "GPS coordinate capture"], [412, "Local QG code computation"], [414, "Queue entry with tentative code"], [416, "Network status monitor"], [418, "Connectivity restoration trigger"], [420, "Batch synchronization request"], [422, "Server-side zone verification"], [424, "Authoritative code recalculation"], [426, "Idempotent conflict resolution"]],
        "FIG. 5": [[500, "Layer 5: Institutional authority certification"], [502, "Layer 4: Community witness verification via OTP"], [504, "Layer 3: GPS and photographic evidence validation"], [506, "Layer 2: Identity binding and document verification"], [508, "Layer 1: Address registration (base layer)"], [510, "Authorization level progression scale (0-5)"]],
        "FIG. 6": [[600, "Grid tessellation subsystem (QG engine)"], [601, "Coordinate input module"], [602, "Adaptive subdivision engine (SQ engine)"], [603, "Code generation module"], [604, "Zone classification module"], [605, "Density monitoring service"], [606, "Offline reconciliation subsystem"], [607, "Sync queue manager"], [608, "Multi-source trust verification chain"], [609, "Authorization level calculator"], [610, "Verified digital location identifier output"]],
      };

      const claimsData = [
        ["1", "Ind.", "Method for generating a digital location identifier from geographic coordinates", "100, 102, 104, 106, 108"],
        ["2", "Dep.", "Wherein projection uses EPSG:3857 Web Mercator", "102"],
        ["3", "Dep.", "Wherein encoding uses base-36 with negative coordinate prefix", "106, 108"],
        ["4", "Dep.", "Wherein subdivision granularity adapts to certification density", "200-206, 220"],
        ["5", "Dep.", "Wherein density tiers are 2x2, 3x3, 4x4, and 5x5", "200, 202, 204, 206"],
        ["6", "Dep.", "Wherein zone classification uses multi-priority pipeline", "302, 306, 310"],
        ["7", "Dep.", "Wherein fallback uses administrative keyword matching", "310, 314"],
        ["8", "Dep.", "Wherein coordinates captured offline are queued for sync", "400, 404, 418"],
        ["9", "Dep.", "Wherein offline records are reconciled via idempotent sync", "414, 420, 424"],
        ["10", "Dep.", "Wherein conflict resolution uses cryptographic hashing", "414, 426"],
        ["11", "Dep.", "Wherein trust verification uses multiple independent sources", "500-508"],
        ["12", "Dep.", "Wherein community witnesses provide verification via OTP", "502"],
        ["13", "Dep.", "Wherein GPS and photographic evidence is validated", "504"],
        ["14", "Ind.", "System for generating and verifying digital location identifiers", "600, 610"],
        ["15", "Dep.", "System comprising a grid tessellation engine", "600, 601, 602, 603"],
        ["16", "Dep.", "System comprising a zone detection module", "604"],
        ["17", "Dep.", "System comprising an adaptive subdivision engine", "605, 606"],
        ["18", "Dep.", "System comprising a zone classification module with fallback", "604, 310, 314"],
        ["19", "Dep.", "System comprising an offline reconciliation subsystem", "607"],
        ["20", "Dep.", "System comprising a multi-source trust verification chain", "608"],
        ["21", "Dep.", "System comprising an authorization level progression mechanism", "510"],
      ];

      // Build sections
      const children: Paragraph[] = [];

      // Title page
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TECHNICAL DRAWINGS", bold: true, size: 32 })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "for European Patent Application", size: 24 })] }));
      children.push(new Paragraph({ children: [] }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Our Reference: ${PATENT_REF}`, bold: true, size: 22 })] }));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: PATENT_TITLE, bold: true, size: 22 })] }));
      children.push(new Paragraph({ children: [] }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Applicant: ${APPLICANT}`, size: 20 })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Filing Date: ${today}`, size: 20 })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Patent Attorney: Dr. Hendrik Wahl — GK Patentanwälte, Regensburg", size: 20 })] }));
      children.push(new Paragraph({ children: [] }));
      children.push(new Paragraph({ children: [new TextRun({ text: "IPC Classifications:", bold: true, size: 20 })] }));
      ["G06F 16/29 — Geospatial data processing", "G06F 16/955 — Structured data indexing", "H04W 4/02 — Location-based services", "G06Q 10/10 — Digital identity and verification systems"].forEach(c => {
        children.push(new Paragraph({ indent: { left: 400 }, children: [new TextRun({ text: c, size: 18 })] }));
      });

      // List of drawings
      children.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "LIST OF DRAWINGS", bold: true, size: 22 })] }));
      drawingsList.forEach(d => {
        children.push(new Paragraph({ spacing: { before: 100 }, indent: { left: 400 }, children: [new TextRun({ text: d, size: 18 })] }));
      });

      // Brief description
      children.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "BRIEF DESCRIPTION OF DRAWINGS", bold: true, size: 22 })] }));
      briefDesc.forEach(d => {
        children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: d, size: 18 })] }));
      });

      // Figure placeholders with page breaks
      const figTitles = [
        "FIG. 1 — QG Grid Projection Model",
        "FIG. 2 — Adaptive SQ Subdivision Tiers",
        "FIG. 3 — Zone Detection Pipeline",
        "FIG. 4 — Offline Capture & Reconciliation Workflow",
        "FIG. 5 — Multi-Source Trust Verification Architecture",
        "FIG. 6 — System Overview",
      ];

      figTitles.forEach((title, idx) => {
        const figNum = idx + 1;
        const figKey = `FIG. ${figNum}`;

        // Page break + title
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `FIG. ${figNum}`, bold: true, size: 28 })] }));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: title, italics: true, size: 20 })] }));

        // Placeholder for drawing
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 400 },
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: "999999" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" }, left: { style: BorderStyle.SINGLE, size: 1, color: "999999" }, right: { style: BorderStyle.SINGLE, size: 1, color: "999999" } },
          children: [new TextRun({ text: `\n\n\n[Inserir desenho técnico — ${figKey}]\n\n\n`, color: "999999", size: 24 })]
        }));

        // Reference numerals for this figure
        children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: `REFERENCE NUMERALS — ${figKey}`, bold: true, size: 20 })] }));
        const nums = refNumerals[figKey] || [];
        nums.forEach(([num, desc]) => {
          children.push(new Paragraph({ indent: { left: 400 }, spacing: { before: 40 }, children: [new TextRun({ text: `${num}`, bold: true, size: 18 }), new TextRun({ text: ` — ${desc}`, size: 18 })] }));
        });
      });

      // Claims cross-reference table
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CLAIM CROSS-REFERENCE TABLE", bold: true, size: 28 })] }));
      children.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

      const headerRow = new TableRow({
        children: ["Claim", "Type", "Description", "Ref. Numerals"].map(h =>
          new TableCell({ width: { size: h === "Description" ? 50 : h === "Ref. Numerals" ? 20 : 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })] })
        ),
      });

      const dataRows = claimsData.map(row =>
        new TableRow({
          children: row.map((cell, i) =>
            new TableCell({ width: { size: i === 2 ? 50 : i === 3 ? 20 : 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: cell, bold: i === 0, size: 16 })] })] })
          ),
        })
      );

      const claimsTable = new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });

      // Footer note
      const footerChildren = [
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Ind. = Independent Claim    Dep. = Dependent Claim", italics: true, size: 16 })] }),
        new Paragraph({ children: [new TextRun({ text: "Total: 2 independent claims (1, 14) + 19 dependent claims = 21 claims", size: 16 })] }),
      ];

      const doc = new Document({
        sections: [{
          properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
          children: [...children, claimsTable, ...footerChildren],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${PATENT_REF}_Technical_Drawings.docx`);
    } catch (err) {
      console.error("Word generation error:", err);
    } finally {
      setGeneratingWord(false);
    }
  };

  const figures = [
    { num: "FIG. 1", title: "Grid Projection Model", desc: "Pipeline de coordenadas WGS84 → EPSG:3857 → identificador de localização digital (Claims 1-3, 14-16)" },
    { num: "FIG. 2", title: "Adaptive Subdivision Tiers", desc: "Subdivisão hierárquica adaptativa de 2×2 a 5×5 baseada na densidade (Claims 4-5, 17)" },
    { num: "FIG. 3", title: "Zone Detection Pipeline", desc: "Pipeline de 3 prioridades para classificação urbana/rural (Claims 6-7, 18)" },
    { num: "FIG. 4", title: "Offline/Sync Reconciliation", desc: "Captura offline com reconciliação idempotente servidor (Claims 8-10, 19)" },
    { num: "FIG. 5", title: "Trust Verification Architecture", desc: "Verificação multi-fonte em 5 camadas com progressão de autorização (Claims 11-13, 20-21)" },
    { num: "FIG. 6", title: "System Overview", desc: "Arquitectura completa: tessalação → subdivisão → zona → sync → verificação → identificador" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Desenhos Técnicos — AFR001PEP</h1>
            <p className="text-sm text-muted-foreground">
              Patente Europeia: Grid-Based Territorial Tessellation & Multi-Source Trust Verification
            </p>
          </div>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-primary" />
                  Technical Drawings — AFR001PEP
                </CardTitle>
                <CardDescription>
                  6 figuras técnicas + índice de numerais + tabela de referência cruzada com claims (9 folhas)
                </CardDescription>
              </div>
              <Badge variant="outline">EP Patent</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {figures.map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant="secondary" className="shrink-0 font-mono text-xs">{f.num}</Badge>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Ref: AFR001PEP — GK Patentanwälte (Dr. Hendrik Wahl)</p>
              <p>• Formato preto/branco conforme normas EPO (European Patent Office)</p>
              <p>• Numerais de referência (100–610) com legenda por figura</p>
              <p>• Tabela de referência cruzada Claims ↔ Figuras ↔ Numerais</p>
              <p>• Classificações IPC: G06F 16/29, G06F 16/955, H04W 4/02, G06Q 10/10</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={generatePDF} disabled={generating || generatingWord} className="w-full gap-2" size="lg">
                <FileDown className="h-5 w-5" />
                {generating ? "A gerar desenhos técnicos..." : "Descarregar PDF (AFR001PEP)"}
              </Button>
              <Button onClick={generateWord} disabled={generating || generatingWord} variant="outline" className="w-full gap-2" size="lg">
                <FileText className="h-5 w-5" />
                {generatingWord ? "A gerar documento Word..." : "Descarregar Word editável (.docx)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
