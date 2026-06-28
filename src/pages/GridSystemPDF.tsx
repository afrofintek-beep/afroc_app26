import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileDown, Grid3X3, MapPin, Layers, Ruler, Globe, Cpu, ShieldCheck } from "lucide-react";

export default function GridSystemPDF() {
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
      const checkPage = (need: number) => { if (y + need > H - 25) addPage(); };

      // Colors
      const gold: [number, number, number] = [212, 175, 55];
      const dark: [number, number, number] = [30, 30, 30];
      const gray: [number, number, number] = [120, 120, 120];
      const white: [number, number, number] = [255, 255, 255];

      // ── Cover ──
      doc.setFillColor(...dark);
      doc.rect(0, 0, W, H, "F");

      doc.setFillColor(...gold);
      doc.rect(margin, 40, contentW, 2, "F");

      doc.setTextColor(...gold);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("AFROLOC", W / 2, 60, { align: "center" });

      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text("Projection & Grid Generation System", W / 2, 72, { align: "center" });

      doc.setTextColor(...white);
      doc.setFontSize(11);
      doc.text("Technical Documentation v2.0", W / 2, 85, { align: "center" });

      doc.setFillColor(...gold);
      doc.rect(margin, 92, contentW, 0.5, "F");

      // Table of Contents
      doc.setTextColor(...white);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Table of Contents", margin, 110);

      const toc = [
        "1. System Overview",
        "2. Projection System (EPSG:3857)",
        "3. QG — Quadrant Grid Engine",
        "4. SQ — Adaptive Subdivision Engine",
        "5. Code Format & Encoding",
        "6. Zone Detection Pipeline",
        "7. Offline-First Architecture",
        "8. Edge Cases & Precision",
        "9. Density Cache & Temporal Tracking",
        "10. SDK Reference",
        "Appendix A — QG Grid Projection Diagram",
        "Appendix B — SQ Subdivision Tiers",
        "Appendix C — Zone Detection Pipeline",
        "Appendix D — Offline/Sync Reconciliation",
        "Appendix E — Trust Verification Architecture",
      ];

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      toc.forEach((item, i) => {
        doc.text(item, margin + 5, 122 + i * 7);
      });

      // Footer
      doc.setTextColor(...gray);
      doc.setFontSize(8);
      doc.text("© 2024-2026 AFROFINTEK GmbH — Confidential", W / 2, H - 15, { align: "center" });
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, W / 2, H - 10, { align: "center" });

      // ── Helper functions ──
      const heading = (title: string, level: 1 | 2 = 1) => {
        checkPage(20);
        doc.setTextColor(...dark);
        doc.setFontSize(level === 1 ? 16 : 13);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, y);
        y += level === 1 ? 3 : 2;
        doc.setDrawColor(...gold);
        doc.setLineWidth(level === 1 ? 0.8 : 0.4);
        doc.line(margin, y, margin + (level === 1 ? contentW : contentW * 0.6), y);
        y += level === 1 ? 8 : 6;
      };

      const para = (text: string) => {
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(text, contentW);
        checkPage(lines.length * 5 + 4);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 4;
      };

      const bullet = (text: string) => {
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(text, contentW - 8);
        checkPage(lines.length * 5 + 2);
        doc.text("•", margin + 2, y);
        doc.text(lines, margin + 8, y);
        y += lines.length * 5 + 2;
      };

      const codeBlock = (code: string) => {
        const lines = code.split("\n");
        checkPage(lines.length * 5 + 10);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, y - 3, contentW, lines.length * 5 + 8, 2, 2, "F");
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9);
        doc.setFont("courier", "normal");
        lines.forEach((line, i) => {
          doc.text(line, margin + 4, y + 2 + i * 5);
        });
        y += lines.length * 5 + 10;
      };

      const table = (headers: string[], rows: string[][]) => {
        const colW = contentW / headers.length;
        checkPage(10 + rows.length * 7);
        // Header
        doc.setFillColor(...gold);
        doc.rect(margin, y - 4, contentW, 8, "F");
        doc.setTextColor(...white);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        headers.forEach((h, i) => doc.text(h, margin + i * colW + 3, y));
        y += 7;
        // Rows
        doc.setTextColor(50, 50, 50);
        doc.setFont("helvetica", "normal");
        rows.forEach((row, ri) => {
          if (ri % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(margin, y - 4, contentW, 7, "F");
          }
          row.forEach((cell, ci) => doc.text(cell, margin + ci * colW + 3, y));
          y += 7;
        });
        y += 4;
      };

      const pageFooter = () => {
        doc.setTextColor(...gray);
        doc.setFontSize(7);
        doc.text("AFROLOC Grid System — Technical Documentation", margin, H - 8);
        doc.text(`Page ${doc.getNumberOfPages()}`, W - margin, H - 8, { align: "right" });
      };

      // ── Page 2: System Overview ──
      addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, W, H, "F");

      heading("1. System Overview");
      para("AFROLOC implements a deterministic geospatial grid system that assigns unique, reproducible address codes to any location across the African continent. The system uses Web Mercator projection (EPSG:3857) to convert geographic coordinates into a flat metric grid, then encodes grid cell indices into compact alphanumeric codes.");
      para("The architecture consists of two complementary engines:");
      bullet("QG (Quadrícula Geoespacial) — The primary grid engine that divides the Earth's surface into uniform cells of 10m (urban) or 25m (rural).");
      bullet("SQ (Subdivisão de Quadrícula) — An adaptive subdivision engine that further divides each QG cell based on real-time certification density, from 2×2 to 5×5 sub-cells.");

      y += 4;
      heading("Key Properties");
      table(
        ["Property", "Value", "Notes"],
        [
          ["Projection", "EPSG:3857", "Web Mercator (metric)"],
          ["Urban Grid", "10m × 10m", "~100 m² per cell"],
          ["Rural Grid", "25m × 25m", "~625 m² per cell"],
          ["Encoding", "Base-36", "Compact alphanumeric"],
          ["Deterministic", "Yes", "Same input → same code"],
          ["Offline-capable", "Yes", "Client-side SDK"],
          ["Max Latitude", "±85.05°", "Web Mercator limit"],
        ]
      );
      pageFooter();

      // ── Page 3: Projection System ──
      addPage();
      heading("2. Projection System (EPSG:3857)");
      para("AFROLOC uses Web Mercator (EPSG:3857) as the projection system. Geographic coordinates (WGS84 lat/lon) are projected to metric coordinates (x, y in meters) before grid cell computation. This ensures uniform cell sizes in meters across the covered area.");

      heading("Forward Projection (Lat/Lon → Meters)", 2);
      codeBlock(
`R = 6,378,137 m (Earth radius)
x = R × lon × (π / 180)
y = R × ln(tan(π/4 + lat × π/360))`
      );

      heading("Inverse Projection (Meters → Lat/Lon)", 2);
      codeBlock(
`lon = (x / R) × (180 / π)
lat = (2 × atan(exp(y / R)) - π/2) × (180 / π)`
      );

      para("The maximum supported latitude is ±85.0511° (the Web Mercator mathematical limit). All African countries fall well within this range.");
      pageFooter();

      // ── Page 4: QG Engine ──
      addPage();
      heading("3. QG — Quadrant Grid Engine");
      para("The QG engine is the core of AFROLOC. It divides the entire projected surface into a regular grid of square cells. Each cell is uniquely identified by its column (ix) and row (iy) index, computed by integer division of the metric coordinates by the cell size.");

      heading("Cell Index Computation", 2);
      codeBlock(
`{ x, y } = toMercator(lat, lon)
gridSize = isUrban ? 10 : 25
ix = floor(x / gridSize)
iy = floor(y / gridSize)`
      );

      heading("Code Generation", 2);
      para("The cell indices are encoded in base-36 (digits 0-9 + letters A-Z) for compact representation. Negative indices use an 'N' prefix.");
      codeBlock(
`Format: CC-ZT-GS-X{base36(ix)}-Y{base36(iy)}
  CC  = ISO 3166-1 alpha-2 country code (e.g. AO)
  ZT  = Zone tag: ZU (urban) or ZR (rural)
  GS  = Grid size: G10 or G25
  ix  = Column index (base-36, N prefix if negative)
  iy  = Row index (base-36, N prefix if negative)

Example: AO-ZU-G10-X35O8-YN247T
  → Angola, Urban, 10m grid, column 35O8₃₆, row -247T₃₆`
      );

      heading("Nomenclature Format", 2);
      para("For administrative integration, an extended format includes province, municipality, and commune codes:");
      codeBlock(
`AO-LUA-ING-ING-G10-X35O8-YN247T
  LUA = Province (Luanda)
  ING = Municipality (Ingombota)
  ING = Commune (Ingombota)`
      );
      pageFooter();

      // ── Page 5: SQ Engine ──
      addPage();
      heading("4. SQ — Adaptive Subdivision Engine");
      para("The SQ engine provides finer granularity within each QG cell. Unlike the static QG grid, the SQ subdivision is adaptive — it dynamically adjusts based on the number of certified addresses within the parent cell.");

      heading("Density-Based Tiers", 2);
      table(
        ["Density Class", "Certifications", "Subdivision", "Sub-cells", "Sub-cell Size (Urban)"],
        [
          ["Low", "≤ 10", "2×2", "4", "5m × 5m"],
          ["Medium", "≤ 50", "3×3", "9", "~3.3m × 3.3m"],
          ["High", "≤ 150", "4×4", "16", "2.5m × 2.5m"],
          ["Very High", "> 150", "5×5", "25", "2m × 2m"],
        ]
      );

      heading("Sub-cell Labels", 2);
      para("Each subdivision tier uses a unique labelling scheme:");
      bullet("2×2: A, B, C, D (row-major: top-left, top-right, bottom-left, bottom-right)");
      bullet("3×3: 1–9 (row-major, left to right, top to bottom)");
      bullet("4×4: A1–D4 (row letter + column number)");
      bullet("5×5: A1–E5 (row letter + column number)");

      heading("SQ Code Format", 2);
      codeBlock(
`SQ{dim}{dim}-{label}
Examples:
  SQ22-A    → 2×2, top-left sub-cell
  SQ33-5    → 3×3, center sub-cell
  SQ44-C2   → 4×4, third row, second column
  SQ55-E5   → 5×5, bottom-right corner

Full code: AO-ZU-G10-X35O8-YN247T-SQ44-C2`
      );
      pageFooter();

      // ── Page 6: Zone Detection ──
      addPage();
      heading("5. Code Format & Encoding");
      para("AFROLOC codes use base-36 encoding for compactness. The encoding converts integer grid indices to a combination of digits (0-9) and uppercase letters (A-Z).");

      heading("Base-36 Encoding", 2);
      codeBlock(
`Encoding:
  positive: ix.toString(36).toUpperCase()
  negative: 'N' + Math.abs(ix).toString(36).toUpperCase()

Decoding:
  starts with 'N': -parseInt(s.slice(1), 36)
  otherwise:        parseInt(s, 36)

Examples:
  3658 → 2SA   (3658₁₀ = 2SA₃₆)
  -2484 → N1XC  (2484₁₀ = 1XC₃₆, prepend N)`
      );

      heading("Legacy Format Support", 2);
      para("The system automatically detects and converts legacy code formats:");
      table(
        ["Legacy Format", "Example", "Conversion"],
        [
          ["Hyphen-negative", "AO-ZU-G10-3658--2484", "→ AO-ZU-G10-X2SA-YN1XC"],
          ["Combined XY", "AO-ZU-G10-X3658Y-2484", "→ AO-ZU-G10-X2SA-YN1XC"],
          ["Missing G prefix", "AO-ZU-10-X2SA-YN1XC", "→ AO-ZU-G10-X2SA-YN1XC"],
          ["Old zone tags", "AO-URBAN-G10-X2SA-YN1XC", "→ AO-ZU-G10-X2SA-YN1XC"],
        ]
      );
      pageFooter();

      // ── Page 7: Zone Detection Pipeline ──
      addPage();
      heading("6. Zone Detection Pipeline");
      para("Determining whether a location is urban or rural is critical — it controls the grid cell size (10m vs 25m). AFROLOC uses a three-tier detection system with clear priority ordering:");

      heading("Priority Hierarchy", 2);
      bullet("Priority 1: Explicit override — If the caller specifies 'urban' or 'rural', that value is used directly.");
      bullet("Priority 2: PostGIS polygon containment — The authoritative source. The server checks if the point falls inside any registered urban_zones polygon using ST_Contains.");
      bullet("Priority 3: Keyword fallback — Used offline. Administrative region names are matched against known urban area keywords (e.g., 'Luanda', 'Maputo').");

      heading("Server-Side (Source of Truth)", 2);
      codeBlock(
`-- PostGIS query in resolve-zone edge function
SELECT zone_type, zone_name 
FROM urban_zones 
WHERE ST_Contains(
  geometry, 
  ST_SetSRID(ST_MakePoint(lon, lat), 4326)
);
-- Returns 'urban' if inside any polygon, 'rural' otherwise`
      );

      heading("Offline Reconciliation", 2);
      para("When field operators create addresses offline, the client-side zone detection (keyword fallback) may differ from the server-side PostGIS result. The sync-places endpoint recalculates the authoritative zone and AFROLOC code upon synchronization, ensuring consistency.");
      pageFooter();

      // ── Page 8: Offline Architecture ──
      addPage();
      heading("7. Offline-First Architecture");
      para("AFROLOC supports full offline address creation for field operators in remote areas with limited connectivity. The offline system mirrors the server-side grid logic exactly.");

      heading("Client-Side SDK", 2);
      para("The @afroloc/sdk module (src/lib/afroloc/sdk.ts) provides pure functions for encode/decode operations without any network dependency:");
      codeBlock(
`import { encode, decode, validate, encodeSQ } from '@/lib/afroloc/sdk';

// Encode coordinates to AFROLOC code (offline)
const result = encode(-8.838, 13.234, 'AO', 'urban');
// → { code: 'AO-ZU-G10-X35O8-YN247T', zone: 'urban', gridSize: 10 }

// Encode SQ subdivision (offline, with density hint)
const sq = encodeSQ(-8.838, 13.234, result.code, 75);
// → { fullCode: 'AO-ZU-G10-X35O8-YN247T-SQ44-C2', subdivisionType: '4x4' }

// Decode back to coordinates
const geo = decode('AO-ZU-G10-X35O8-YN247T');
// → { centroid: { lat: -8.838, lon: 13.234 }, bbox: {...} }`
      );

      heading("Sync Contract", 2);
      para("The POST /v1/sync/places endpoint handles reconciliation:");
      bullet("Accepts offline-generated codes with a conflict_hash (SHA-256)");
      bullet("Recalculates the authoritative zone using PostGIS");
      bullet("Returns the corrected AFROLOC code if the zone changed");
      bullet("Logs operations: CREATE, IDEMPOTENT (duplicate), CONFLICT (hash mismatch)");
      pageFooter();

      // ── Page 9: Edge Cases ──
      addPage();
      heading("8. Edge Cases & Precision");

      heading("Negative Coordinates", 2);
      para("Most of Africa lies in negative latitudes (southern hemisphere) and positive longitudes. The grid handles negative coordinates by prepending 'N' to the base-36 encoded absolute value. This ensures a consistent, sortable code format.");

      heading("Grid Boundaries", 2);
      para("The grid is a strict mathematical partition — every point on Earth maps to exactly one cell. There are no overlaps or gaps by design. Points exactly on a cell boundary are assigned to the cell via floor() rounding (always towards the lower-index cell).");

      heading("Projection Distortion", 2);
      para("Web Mercator introduces area distortion at high latitudes. However, since all African countries lie between approximately 37°N and 35°S, the distortion is minimal (< 5% at the extremes). The 10m/25m cell sizes refer to metric Web Mercator dimensions, not ground-truth distances.");

      heading("Floating Point Precision", 2);
      para("The encode/decode cycle may introduce sub-millimeter rounding errors due to floating-point arithmetic. This is negligible for address resolution purposes. The centroid of a decoded cell is always within the cell boundaries.");

      heading("Country Code Validation", 2);
      para("Only valid African country codes (ISO 3166-1 alpha-2) are accepted. The SDK maintains a hardcoded set of 54 African country codes. Attempts to encode non-African coordinates are rejected with an error.");
      pageFooter();

      // ── Page 10: Density Cache ──
      addPage();
      heading("9. Density Cache & Temporal Tracking");
      para("The adaptive SQ system relies on certification density counts per cell. To avoid expensive database scans on every request, the system implements a multi-layer caching and tracking architecture.");

      heading("Cache Architecture", 2);
      table(
        ["Layer", "TTL", "Storage", "Purpose"],
        [
          ["Live Query", "0 (real-time)", "afroloc_records", "Ground truth certification count"],
          ["Density Cache", "24 hours", "cell_density_cache", "Fast lookup, avoids repeated scans"],
          ["History Snapshots", "Permanent", "cell_density_history", "Temporal analysis & growth tracking"],
        ]
      );

      heading("Growth Rate Tracking", 2);
      para("Each cache refresh calculates the annualized growth rate between the current and previous certification counts. This enables predictive subdivision promotion — areas growing rapidly can be proactively upgraded to finer subdivisions before hitting density thresholds.");
      codeBlock(
`growthRate = ((current - previous) / previous) × (365 / daysBetween) × 100

Example: 30 certs → 45 certs in 30 days
  = (15/30) × (365/30) × 100 = 608% annualized growth`
      );

      heading("Subdivision Promotion", 2);
      para("When a cell's density class changes (e.g., 'medium' → 'high'), the cache records the promotion timestamp. This allows administrators to track urbanization patterns and plan infrastructure accordingly.");
      pageFooter();

      // ── Page 11: SDK Reference ──
      addPage();
      heading("10. SDK Reference");
      para("The @afroloc/sdk (v1.1.0) provides the following public API:");

      heading("Core Functions", 2);
      table(
        ["Function", "Input", "Output"],
        [
          ["encode()", "lat, lon, country, zone", "EncodeResult (code, ix, iy)"],
          ["decode()", "AFROLOC code", "DecodeResult (centroid, bbox)"],
          ["validate()", "AFROLOC code", "ValidateResult (valid, normalized)"],
          ["encodeSQ()", "lat, lon, code, certCount", "SQEncodeResult (fullCode, bounds)"],
          ["decodeSQ()", "Full AFROLOC+SQ code", "DecodeResult + SQ bounds"],
          ["resolve()", "lat, lon, country, opts", "Server-side resolution"],
          ["batchResolve()", "points[], country, opts", "Batch resolution (≤100)"],
        ]
      );

      heading("Utility Functions", 2);
      table(
        ["Function", "Purpose"],
        [
          ["isAfricanCountry(code)", "Validate country code"],
          ["distance(lat1, lon1, lat2, lon2)", "Haversine distance (meters)"],
          ["deepLink(action, code)", "Generate native/web deep links"],
          ["classifyDensity(count)", "Map cert count to density class"],
          ["densityToSubdivision(class)", "Map density class to SQ type"],
          ["calculateGrowthRate(cur, prev, days)", "Annualized growth rate"],
        ]
      );

      heading("Execution Environments", 2);
      table(
        ["Environment", "Module", "Use Case"],
        [
          ["Browser", "src/lib/afroloc/sdk.ts", "Mobile offline encoding"],
          ["React Hook", "src/hooks/useQGSQEngine.ts", "UI grid visualization"],
          ["Edge Function (QG)", "supabase/functions/qg-engine", "Authoritative encoding"],
          ["Edge Function (SQ)", "supabase/functions/sq-engine", "Adaptive subdivision"],
          ["Edge Function (Sync)", "supabase/functions/sync-places", "Offline reconciliation"],
        ]
      );
      pageFooter();

      // ── Drawing helpers for diagrams ──
      const drawArrow = (x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = dark) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.5);
        doc.line(x1, y1, x2, y2);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 2.5;
        doc.line(x2, y2, x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        doc.line(x2, y2, x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      };

      const drawBox = (x: number, bY: number, w: number, h: number, label: string, fill: [number, number, number], textColor: [number, number, number] = white) => {
        doc.setFillColor(...fill);
        doc.roundedRect(x, bY, w, h, 2, 2, "F");
        doc.setTextColor(...textColor);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const lines = doc.splitTextToSize(label, w - 4);
        const textY = bY + h / 2 - (lines.length - 1) * 2;
        lines.forEach((line: string, i: number) => {
          doc.text(line, x + w / 2, textY + i * 4, { align: "center" });
        });
      };

      const drawDiamond = (cx: number, cy: number, size: number, label: string) => {
        doc.setFillColor(255, 200, 50);
        const pts = [
          { x: cx, y: cy - size },
          { x: cx + size, y: cy },
          { x: cx, y: cy + size },
          { x: cx - size, y: cy },
        ];
        doc.setFillColor(255, 200, 50);
        doc.triangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[3].x, pts[3].y, "F");
        doc.triangle(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y, "F");
        doc.setTextColor(...dark);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const lines = doc.splitTextToSize(label, size * 1.5);
        lines.forEach((line: string, i: number) => {
          doc.text(line, cx, cy - (lines.length - 1) * 2 + i * 4, { align: "center" });
        });
      };

      // ── Appendix A: QG Grid Projection Diagram ──
      addPage();
      heading("Appendix A — QG Grid Projection Model");
      para("This diagram illustrates the complete projection pipeline from WGS84 geographic coordinates to the final AFROLOC grid code.");

      y += 2;
      const diagramY = y;
      // Step 1: Input
      drawBox(margin, diagramY, 40, 14, "WGS84 Input\n(lat, lon)", [70, 130, 180]);
      // Arrow
      drawArrow(margin + 40, diagramY + 7, margin + 48, diagramY + 7, gold);
      // Step 2: Projection
      drawBox(margin + 50, diagramY, 45, 14, "Web Mercator\nEPSG:3857", [50, 100, 150]);
      drawArrow(margin + 95, diagramY + 7, margin + 103, diagramY + 7, gold);
      // Step 3: Grid division
      drawBox(margin + 105, diagramY, 40, 14, "Grid Division\n÷ cellSize", [40, 80, 130]);
      drawArrow(margin + 145, diagramY + 7, margin + 153, diagramY + 7, gold);
      // Step 4: Output
      drawBox(margin + 155, diagramY - 1, 15, 16, "ix\niy", gold, dark);

      y = diagramY + 22;
      // Second row: encoding
      drawBox(margin + 50, y, 45, 14, "Base-36\nEncoding", [100, 60, 120]);
      drawArrow(margin + 95, y + 7, margin + 103, y + 7, gold);
      drawBox(margin + 105, y, 55, 14, "AFROLOC Code\nCC-ZT-GS-X{b36}-Y{b36}", gold, dark);
      // Arrow from ix/iy down
      drawArrow(margin + 162, diagramY + 15, margin + 72, y, gold);

      y += 24;

      // Grid visual
      heading("Grid Cell Visualization", 2);
      const gridX = margin + 10;
      const gridY2 = y;
      const cellPx = 12;

      // Draw 5x5 sample grid
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      for (let r = 0; r <= 5; r++) {
        doc.line(gridX, gridY2 + r * cellPx, gridX + 5 * cellPx, gridY2 + r * cellPx);
        doc.line(gridX + r * cellPx, gridY2, gridX + r * cellPx, gridY2 + 5 * cellPx);
      }
      // Highlight one cell
      doc.setFillColor(212, 175, 55, 80);
      doc.rect(gridX + 2 * cellPx, gridY2 + 2 * cellPx, cellPx, cellPx, "F");
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.8);
      doc.rect(gridX + 2 * cellPx, gridY2 + 2 * cellPx, cellPx, cellPx, "S");

      // Labels
      doc.setTextColor(...dark);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("ix", gridX + 2 * cellPx + cellPx / 2, gridY2 - 2, { align: "center" });
      doc.text("iy", gridX - 4, gridY2 + 2 * cellPx + cellPx / 2 + 1, { align: "center" });
      doc.text("10m (urban)", gridX + 5 * cellPx + 5, gridY2 + 2.5 * cellPx);
      doc.text("25m (rural)", gridX + 5 * cellPx + 5, gridY2 + 2.5 * cellPx + 6);

      // Legend for urban/rural
      doc.setFillColor(70, 130, 180);
      doc.rect(margin + 110, gridY2, 8, 5, "F");
      doc.setTextColor(...dark);
      doc.setFontSize(7);
      doc.text("Urban Zone (G10, 10m)", margin + 120, gridY2 + 4);
      doc.setFillColor(100, 160, 80);
      doc.rect(margin + 110, gridY2 + 8, 8, 5, "F");
      doc.text("Rural Zone (G25, 25m)", margin + 120, gridY2 + 12);

      y = gridY2 + 5 * cellPx + 8;
      pageFooter();

      // ── Appendix B: SQ Subdivision Tiers ──
      addPage();
      heading("Appendix B — SQ Subdivision Tiers");
      para("Visual representation of the four adaptive subdivision tiers. Each QG cell is subdivided based on the certification density within it.");

      y += 4;
      const sqTiers = [
        { label: "2×2 (≤10 certs)", dim: 2, labels: ["A", "B", "C", "D"], color: [100, 180, 100] as [number, number, number] },
        { label: "3×3 (≤50 certs)", dim: 3, labels: ["1","2","3","4","5","6","7","8","9"], color: [70, 150, 200] as [number, number, number] },
        { label: "4×4 (≤150 certs)", dim: 4, labels: ["A1","A2","A3","A4","B1","B2","B3","B4","C1","C2","C3","C4","D1","D2","D3","D4"], color: [180, 120, 60] as [number, number, number] },
        { label: "5×5 (>150 certs)", dim: 5, labels: Array.from({length:25},(_,i)=>`${String.fromCharCode(65+Math.floor(i/5))}${(i%5)+1}`), color: [160, 60, 80] as [number, number, number] },
      ];

      const sqStartY = y;
      const sqCellBase = 36;
      sqTiers.forEach((tier, ti) => {
        const ox = margin + (ti % 2) * 85;
        const oy = sqStartY + Math.floor(ti / 2) * 60;
        const cellSz = sqCellBase / tier.dim;

        // Title
        doc.setTextColor(...dark);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(tier.label, ox + sqCellBase / 2, oy - 3, { align: "center" });

        // Grid
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        for (let r = 0; r <= tier.dim; r++) {
          doc.line(ox, oy + r * cellSz, ox + tier.dim * cellSz, oy + r * cellSz);
          doc.line(ox + r * cellSz, oy, ox + r * cellSz, oy + tier.dim * cellSz);
        }

        // Fill cells with labels
        doc.setFontSize(tier.dim <= 3 ? 8 : 6);
        doc.setFont("helvetica", "normal");
        tier.labels.forEach((lbl, li) => {
          const col = li % tier.dim;
          const row = Math.floor(li / tier.dim);
          // Alternate fill
          if ((col + row) % 2 === 0) {
            doc.setFillColor(tier.color[0], tier.color[1], tier.color[2]);
            doc.rect(ox + col * cellSz, oy + row * cellSz, cellSz, cellSz, "F");
            doc.setTextColor(...white);
          } else {
            doc.setFillColor(240, 240, 240);
            doc.rect(ox + col * cellSz, oy + row * cellSz, cellSz, cellSz, "F");
            doc.setTextColor(...dark);
          }
          doc.text(lbl, ox + col * cellSz + cellSz / 2, oy + row * cellSz + cellSz / 2 + 1.5, { align: "center" });
        });

        // Border
        doc.setDrawColor(...gold);
        doc.setLineWidth(0.6);
        doc.rect(ox, oy, tier.dim * cellSz, tier.dim * cellSz, "S");
      });

      y = sqStartY + 128;

      // Density scale bar
      heading("Density Scale", 2);
      const scaleY = y;
      const scaleW = contentW;
      const segments = [
        { label: "Low", range: "0–10", w: 0.15, color: [100, 180, 100] as [number, number, number] },
        { label: "Medium", range: "11–50", w: 0.25, color: [70, 150, 200] as [number, number, number] },
        { label: "High", range: "51–150", w: 0.30, color: [180, 120, 60] as [number, number, number] },
        { label: "Very High", range: "151+", w: 0.30, color: [160, 60, 80] as [number, number, number] },
      ];
      let sx = margin;
      segments.forEach((seg) => {
        const sw = scaleW * seg.w;
        doc.setFillColor(...seg.color);
        doc.rect(sx, scaleY, sw, 8, "F");
        doc.setTextColor(...white);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(`${seg.label} (${seg.range})`, sx + sw / 2, scaleY + 5, { align: "center" });
        sx += sw;
      });
      y = scaleY + 16;
      pageFooter();

      // ── Appendix C: Zone Detection Pipeline ──
      addPage();
      heading("Appendix C — Zone Detection Pipeline");
      para("Flowchart showing the three-tier priority hierarchy for determining urban/rural zone classification.");

      y += 6;
      const pY = y;
      const cx = W / 2;

      // Start
      drawBox(cx - 25, pY, 50, 12, "Input: (lat, lon)", [70, 130, 180]);
      drawArrow(cx, pY + 12, cx, pY + 20, gold);

      // Decision 1: Override?
      drawDiamond(cx, pY + 30, 12, "Explicit\noverride?");
      // Yes branch
      doc.setTextColor(...dark);
      doc.setFontSize(7);
      doc.text("YES", cx + 14, pY + 28);
      drawArrow(cx + 12, pY + 30, cx + 40, pY + 30, gold);
      drawBox(cx + 40, pY + 24, 38, 12, "Use override\nzone value", [100, 180, 100]);

      // No branch
      doc.setTextColor(...dark);
      doc.text("NO", cx + 3, pY + 44);
      drawArrow(cx, pY + 42, cx, pY + 52, gold);

      // Decision 2: PostGIS
      drawDiamond(cx, pY + 64, 12, "PostGIS\nST_Contains?");
      doc.setTextColor(...dark);
      doc.text("YES", cx + 14, pY + 62);
      drawArrow(cx + 12, pY + 64, cx + 40, pY + 64, gold);
      drawBox(cx + 40, pY + 58, 38, 12, "Urban\n(G10, 10m)", [212, 175, 55], dark);

      doc.setTextColor(...dark);
      doc.text("NO", cx + 3, pY + 78);
      drawArrow(cx, pY + 76, cx, pY + 86, gold);

      // Decision 3: Keyword
      drawDiamond(cx, pY + 98, 12, "Keyword\nmatch?");
      doc.setTextColor(...dark);
      doc.text("YES", cx + 14, pY + 96);
      drawArrow(cx + 12, pY + 98, cx + 40, pY + 98, gold);
      drawBox(cx + 40, pY + 92, 38, 12, "Urban\n(G10, 10m)", [212, 175, 55], dark);

      doc.setTextColor(...dark);
      doc.text("NO", cx + 3, pY + 112);
      drawArrow(cx, pY + 110, cx, pY + 118, gold);

      drawBox(cx - 22, pY + 118, 44, 12, "Rural (G25, 25m)", [100, 160, 80], white);

      y = pY + 140;
      // Priority labels
      doc.setTextColor(...gray);
      doc.setFontSize(7);
      doc.text("Priority 1", margin, pY + 30);
      doc.text("Priority 2", margin, pY + 64);
      doc.text("Priority 3 (offline fallback)", margin, pY + 98);
      pageFooter();

      // ── Appendix D: Offline/Sync Reconciliation Workflow ──
      addPage();
      heading("Appendix D — Offline/Sync Reconciliation Workflow");
      para("Sequence diagram showing the data flow from offline capture to server reconciliation.");

      y += 4;
      const seqY = y;
      // Lifelines
      const actors = [
        { label: "Field\nOperator", x: margin + 15 },
        { label: "Client SDK\n(offline)", x: margin + 55 },
        { label: "IndexedDB\nOutbox", x: margin + 95 },
        { label: "sync-places\nEndpoint", x: margin + 135 },
      ];
      actors.forEach((a) => {
        drawBox(a.x - 15, seqY, 30, 14, a.label, dark, white);
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(a.x, seqY + 14, a.x, seqY + 140);
      });
      doc.setLineDashPattern([], 0);

      // Messages
      const msg = (from: number, to: number, mY: number, label: string, dashed = false) => {
        const x1 = actors[from].x;
        const x2 = actors[to].x;
        if (dashed) {
          doc.setLineDashPattern([1.5, 1.5], 0);
        }
        drawArrow(x1, mY, x2, mY, gold);
        doc.setLineDashPattern([], 0);
        doc.setTextColor(...dark);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.text(label, (x1 + x2) / 2, mY - 2, { align: "center" });
      };

      msg(0, 1, seqY + 24, "capture(lat, lon)");
      msg(1, 1, seqY + 34, "encode() → local code");
      msg(1, 2, seqY + 44, "enqueue(idempotency_key, conflict_hash)");
      msg(2, 2, seqY + 54, "store offline");

      // Online sync
      doc.setTextColor(100, 180, 100);
      doc.setFontSize(6);
      doc.text("── connectivity restored ──", margin + 75, seqY + 64, { align: "center" });

      msg(2, 3, seqY + 74, "POST /sync-places (batch)");
      msg(3, 3, seqY + 84, "PostGIS zone check");
      msg(3, 3, seqY + 92, "recalculate AFROLOC");
      msg(3, 2, seqY + 102, "ack: {official_code, zone}", true);
      msg(2, 1, seqY + 112, "update local DB", true);
      msg(1, 0, seqY + 122, "sync complete ✓", true);

      // Status legend
      y = seqY + 150;
      heading("Sync Statuses", 2);
      const statuses = [
        { status: "ok", desc: "New record created successfully", color: [100, 180, 100] as [number, number, number] },
        { status: "idempotent", desc: "Duplicate detected (same idempotency_key)", color: [70, 150, 200] as [number, number, number] },
        { status: "conflict", desc: "Same location, different data (conflict_hash mismatch)", color: [200, 80, 60] as [number, number, number] },
        { status: "error", desc: "Server error (retried with exponential backoff)", color: [160, 60, 80] as [number, number, number] },
      ];
      statuses.forEach((s) => {
        checkPage(8);
        doc.setFillColor(...s.color);
        doc.rect(margin, y, 4, 4, "F");
        doc.setTextColor(...dark);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(s.status, margin + 7, y + 3);
        doc.setFont("helvetica", "normal");
        doc.text(`— ${s.desc}`, margin + 7 + doc.getTextWidth(s.status) + 2, y + 3);
        y += 7;
      });
      pageFooter();

      // ── Appendix E: Trust Verification Architecture ──
      addPage();
      heading("Appendix E — Trust Verification Architecture");
      para("Layered architecture diagram showing the trust chain from initial address creation through full verification.");

      y += 6;
      const tvY = y;
      const layerH = 16;
      const layerGap = 6;
      const layerW = contentW - 20;
      const lx = margin + 10;

      const layers = [
        { label: "Layer 5: Institutional Validation", sub: "DFI / State Authority verification · Authority signature · Official certification", color: [140, 50, 50] as [number, number, number] },
        { label: "Layer 4: Community Verification", sub: "2+ witnesses with OTP confirmation · Witness reputation scoring · Proximity check", color: [180, 100, 50] as [number, number, number] },
        { label: "Layer 3: GPS & Photo Validation", sub: "GPS spoofing detection · EXIF metadata extraction · Geofence radius check", color: [200, 160, 50] as [number, number, number] },
        { label: "Layer 2: Identity Binding", sub: "Phone OTP verification · Device fingerprint · Biometric authentication", color: [70, 150, 200] as [number, number, number] },
        { label: "Layer 1: Address Registration", sub: "AFROLOC code generation · Zone detection · Offline capture + sync", color: [100, 160, 80] as [number, number, number] },
      ];

      layers.forEach((layer, i) => {
        const ly = tvY + i * (layerH + layerGap);
        doc.setFillColor(...layer.color);
        doc.roundedRect(lx, ly, layerW, layerH, 2, 2, "F");
        doc.setTextColor(...white);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(layer.label, lx + 5, ly + 6);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(layer.sub, lx + 5, ly + 12);

        // Arrow between layers
        if (i < layers.length - 1) {
          const arrowY = ly + layerH + 1;
          drawArrow(lx + layerW / 2, arrowY + layerGap - 2, lx + layerW / 2, arrowY, [180, 180, 180]);
        }
      });

      y = tvY + layers.length * (layerH + layerGap) + 8;

      // Trust score progression
      heading("Authorization Level Progression", 2);
      const lvls = [
        { level: "Level 0", name: "Registado", req: "Phone verified", pct: 10 },
        { level: "Level 1", name: "Básico", req: "+ GPS location", pct: 25 },
        { level: "Level 2", name: "Verificado", req: "+ 2 witnesses", pct: 50 },
        { level: "Level 3", name: "Certificado", req: "+ Photo + EXIF", pct: 75 },
        { level: "Level 4", name: "Institucional", req: "+ Authority sign", pct: 100 },
      ];

      const barY = y + 2;
      const barH = 6;
      lvls.forEach((l, i) => {
        checkPage(12);
        const lY = barY + i * 10;
        // Progress bar bg
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(margin + 45, lY, 80, barH, 1, 1, "F");
        // Fill
        doc.setFillColor(...gold);
        doc.roundedRect(margin + 45, lY, 80 * (l.pct / 100), barH, 1, 1, "F");
        // Labels
        doc.setTextColor(...dark);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(`${l.level}`, margin, lY + 4.5);
        doc.setFont("helvetica", "normal");
        doc.text(l.name, margin + 17, lY + 4.5);
        doc.text(l.req, margin + 130, lY + 4.5);
        doc.text(`${l.pct}%`, margin + 45 + 80 * (l.pct / 100) + 3, lY + 4.5);
      });

      y = barY + 55;
      pageFooter();


      addPage();
      doc.setFillColor(...dark);
      doc.rect(0, 0, W, H, "F");

      doc.setTextColor(...gold);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("AFROLOC", W / 2, H / 2 - 20, { align: "center" });

      doc.setTextColor(...white);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Projection & Grid Generation System", W / 2, H / 2 - 8, { align: "center" });
      doc.text("Technical Documentation v2.0", W / 2, H / 2 + 4, { align: "center" });

      doc.setFillColor(...gold);
      doc.rect(W / 2 - 30, H / 2 + 14, 60, 0.5, "F");

      doc.setTextColor(...gray);
      doc.setFontSize(9);
      doc.text("© 2024-2026 AFROFINTEK GmbH", W / 2, H / 2 + 30, { align: "center" });
      doc.text("All rights reserved. Confidential.", W / 2, H / 2 + 37, { align: "center" });

      doc.save("AFROLOC_Grid_System_v2.0.pdf");
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  const sections = [
    { icon: Globe, title: "Projeção EPSG:3857", desc: "Web Mercator com células métricas de 10m (urbano) e 25m (rural)" },
    { icon: Grid3X3, title: "Motor QG", desc: "Grelha determinística com codificação base-36 e suporte a formatos legacy" },
    { icon: Layers, title: "Motor SQ Adaptativo", desc: "Subdivisão dinâmica de 2×2 a 5×5 baseada na densidade de certificações" },
    { icon: MapPin, title: "Deteção de Zona", desc: "Pipeline de 3 níveis: override → PostGIS → keyword fallback" },
    { icon: Cpu, title: "Offline-First SDK", desc: "Encode/decode completo no cliente, com reconciliação via sync-places" },
    { icon: Ruler, title: "Cache de Densidade", desc: "TTL de 24h com tracking temporal e taxa de crescimento anualizada" },
    { icon: ShieldCheck, title: "Casos Extremos", desc: "Coordenadas negativas, distorção de projeção, precisão de ponto flutuante" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Sistema de Projeção & Grelha</h1>
            <p className="text-sm text-muted-foreground">Documentação técnica do motor geoespacial AFROLOC</p>
          </div>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5 text-primary" />
                  AFROLOC Grid System v2.0
                </CardTitle>
                <CardDescription>
                  Documentação completa do sistema de projeção, grelha QG/SQ e motor de subdivisão adaptativa
                </CardDescription>
              </div>
              <Badge>PDF</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {sections.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <s.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <Button onClick={generatePDF} disabled={generating} className="w-full gap-2" size="lg">
              <FileDown className="h-5 w-5" />
              {generating ? "A gerar PDF..." : "Descarregar PDF Técnico"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
