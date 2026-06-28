/**
 * AFROLOC × Yamioo — Downloadable Integration Guide PDF
 */
import jsPDF from "jspdf";

const GATEWAY_URL = "https://rxhtdejvjgopfseysuhl.supabase.co/functions/v1/yamioo-gateway";
const MARGIN = 20;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addPage(doc: jsPDF) {
  doc.addPage();
  return 30;
}

function checkPage(doc: jsPDF, y: number, needed = 30): number {
  if (y + needed > 275) return addPage(doc);
  return y;
}

function heading(doc: jsPDF, text: string, y: number, size = 14): number {
  y = checkPage(doc, y, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(30, 30, 30);
  doc.text(text, MARGIN, y);
  return y + size * 0.6 + 4;
}

function para(doc: jsPDF, text: string, y: number, fontSize = 10): number {
  y = checkPage(doc, y, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(60, 60, 60);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * (fontSize * 0.45) + 6;
}

function code(doc: jsPDF, text: string, y: number): number {
  const fontSize = 8;
  doc.setFont("courier", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, CONTENT_W - 10);
  const blockH = lines.length * 4 + 8;
  y = checkPage(doc, y, blockH + 5);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(MARGIN, y - 4, CONTENT_W, blockH, 2, 2, "F");
  doc.setTextColor(40, 40, 40);
  doc.text(lines, MARGIN + 5, y + 2);
  return y + blockH + 4;
}

function bullet(doc: jsPDF, text: string, y: number): number {
  y = checkPage(doc, y, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text("•", MARGIN + 2, y);
  const lines = doc.splitTextToSize(text, CONTENT_W - 12);
  doc.text(lines, MARGIN + 8, y);
  return y + lines.length * 4.5 + 2;
}

export function generateYamiooIntegrationPdf() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 30;

  // === COVER ===
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, PAGE_W, 100, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text("AFROLOC × Yamioo", MARGIN, 45);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text("Integration Guide — API v2.0.0", MARGIN, 60);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString("pt-PT")}`, MARGIN, 75);
  doc.text("Confidential — For Yamioo Development Team", MARGIN, 85);

  y = 115;

  // === TABLE OF CONTENTS ===
  y = heading(doc, "Table of Contents", y, 16);
  const toc = [
    "1. Overview & Authentication",
    "2. AFROLOC Code Format",
    "3. Lookup — Address Resolution",
    "4. Verify — GPS Delivery Confirmation",
    "5. Subscribe — Real-time Webhooks",
    "6. Recommended Delivery Flow",
    "7. Error Codes",
    "8. HMAC-SHA256 Signature Verification",
    "9. Best Practices",
  ];
  for (const item of toc) {
    y = bullet(doc, item, y);
  }

  // === 1. OVERVIEW ===
  y = addPage(doc);
  y = heading(doc, "1. Overview & Authentication", y, 16);
  y = para(doc, "The AFROLOC × Yamioo integration uses a single REST endpoint (the Gateway) for all operations. All requests use the query parameter ?action= to specify the operation.", y);
  y = heading(doc, "Gateway URL", y, 11);
  y = code(doc, GATEWAY_URL, y);
  y = heading(doc, "Authentication", y, 11);
  y = para(doc, 'All requests must include the apikey header with the AFROLOC anon key provided during onboarding.', y);
  y = code(doc, `curl "${GATEWAY_URL}?action=status" \\\n  -H "apikey: <YOUR_ANON_KEY>"`, y);
  y = heading(doc, "Health Check Response", y, 11);
  y = code(doc, `{
  "status": "operational",
  "partner": "yamioo",
  "version": "2.0.0",
  "endpoints": ["lookup", "verify", "subscribe", "status"]
}`, y);

  // === 2. CODE FORMAT ===
  y = addPage(doc);
  y = heading(doc, "2. AFROLOC Code Format", y, 16);
  y = para(doc, "AFROLOC uses geospatial codes based on Web Mercator projection. Two formats are accepted:", y);
  y = heading(doc, "Standard Format", y, 11);
  y = code(doc, "CC-ZT-Gnn-Xxxxx-Yyyyy\nExample: AO-ZU-G10-X35O8-YN247T", y);
  y = heading(doc, "Nomenclature Format (with administrative hierarchy)", y, 11);
  y = code(doc, "CC-PROV-MUN-COM-BAI-Gnn-Xxxxx-Yyyyy\nExample: AO-LUA-BEL-TAL-CAM-G10-X35O8-YN247T", y);
  y = heading(doc, "Legend", y, 11);
  y = bullet(doc, "CC — Country code (ISO 3166-1, e.g. AO)", y);
  y = bullet(doc, "ZT — Zone type: ZU (urban, 10m grid) or ZR (rural, 25m grid)", y);
  y = bullet(doc, "PROV/MUN/COM/BAI — Administrative hierarchy (province/municipality/commune/neighborhood)", y);
  y = bullet(doc, "Gnn — Grid cell size in meters (G10 or G25)", y);
  y = bullet(doc, "X/Y — Web Mercator coordinates in Base-36 (N prefix = negative)", y);

  // === 3. LOOKUP ===
  y = addPage(doc);
  y = heading(doc, "3. Lookup — Address Resolution", y, 16);
  y = para(doc, "POST ?action=lookup — Resolves an AFROLOC code or GPS coordinates to a full address.", y);
  y = heading(doc, "Option A: Lookup by AFROLOC code", y, 11);
  y = code(doc, `curl -X POST "${GATEWAY_URL}?action=lookup" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -d '{ "code": "AO-ZU-G10-X35O8-YN247T" }'`, y);
  y = heading(doc, "Response", y, 11);
  y = code(doc, `{
  "found": true,
  "address": {
    "code": "AO-ZU-G10-X35O8-YN247T",
    "country": "AO",
    "status": "approved",
    "type": "formal",
    "coordinates": { "lat": -8.8383, "lon": 13.2344 },
    "hierarchy": {
      "province": "Luanda",
      "municipality": "Belas",
      "commune": "Talatona",
      "neighborhood": "Camama"
    }
  }
}`, y);

  y = checkPage(doc, y, 60);
  y = heading(doc, "Option B: Lookup by GPS coordinates", y, 11);
  y = code(doc, `curl -X POST "${GATEWAY_URL}?action=lookup" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -d '{
    "latitude": -8.8383,
    "longitude": 13.2344,
    "countryCode": "AO"
  }'`, y);

  // === 4. VERIFY ===
  y = addPage(doc);
  y = heading(doc, "4. Verify — GPS Delivery Confirmation", y, 16);
  y = para(doc, "POST ?action=verify — Checks if the delivery driver's GPS is within the address radius. Thresholds: 150m (urban) / 500m (rural).", y);
  y = code(doc, `curl -X POST "${GATEWAY_URL}?action=verify" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -d '{
    "code": "AO-ZU-G10-X35O8-YN247T",
    "latitude": -8.8390,
    "longitude": 13.2350
  }'`, y);
  y = heading(doc, "Response", y, 11);
  y = code(doc, `{
  "verified": true,
  "distance_m": 87.3,
  "threshold_m": 150,
  "status": "approved",
  "address_type": "formal"
}`, y);
  y = heading(doc, "Verification Logic", y, 11);
  y = bullet(doc, "verified = true → distance ≤ threshold (delivery confirmed)", y);
  y = bullet(doc, "verified = false → distance > threshold (outside radius)", y);
  y = bullet(doc, "Distance calculated via Haversine formula (sub-meter precision)", y);

  // === 5. SUBSCRIBE ===
  y = addPage(doc);
  y = heading(doc, "5. Subscribe — Real-time Webhooks", y, 16);
  y = para(doc, "POST ?action=subscribe — Register a webhook URL to receive real-time notifications about address events.", y);
  y = code(doc, `curl -X POST "${GATEWAY_URL}?action=subscribe" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -d '{
    "webhook_url": "https://api.yamioo.com/webhooks/afroloc",
    "events": [
      "address.created",
      "address.status_changed",
      "address.verified",
      "checkin.completed"
    ],
    "secret": "whsec_your_webhook_secret_here"
  }'`, y);
  y = heading(doc, "Available Events", y, 11);
  const events = [
    "address.created — New AFROLOC address created",
    "address.status_changed — Address status updated",
    "address.verified — Address verification completed",
    "checkin.completed — Resident check-in completed",
    "witness.confirmed — Witness confirmation received",
    "resident.approved — Resident request approved",
  ];
  for (const e of events) {
    y = bullet(doc, e, y);
  }

  // === 6. DELIVERY FLOW ===
  y = addPage(doc);
  y = heading(doc, "6. Recommended Delivery Flow", y, 16);
  const steps = [
    "1. Customer provides their AFROLOC code (e.g. AO-ZU-G10-X35O8-YN247T)",
    "2. Yamioo calls POST ?action=lookup to get GPS coordinates + administrative hierarchy",
    "3. Driver navigates to coordinates.lat / coordinates.lon using GPS",
    "4. At destination, call POST ?action=verify with the driver's current GPS position",
    "5. If verified=true, confirm delivery. If false, ask driver to get closer.",
  ];
  for (const s of steps) {
    y = bullet(doc, s, y);
  }

  // === 7. ERROR CODES ===
  y += 10;
  y = heading(doc, "7. Error Codes", y, 16);
  const errors = [
    ["400", "Bad Request", "Missing or invalid parameters"],
    ["404", "Not Found", "AFROLOC code not found in database"],
    ["405", "Method Not Allowed", "Wrong HTTP method (use POST)"],
    ["422", "Unprocessable", "Address exists but lacks GPS coordinates"],
    ["500", "Internal Error", "Server error"],
    ["502", "Bad Gateway", "Coordinate resolution failure"],
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  y = checkPage(doc, y, 10);
  doc.text("Status", MARGIN, y);
  doc.text("Error", MARGIN + 25, y);
  doc.text("Description", MARGIN + 70, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  for (const [status, err, desc] of errors) {
    y = checkPage(doc, y, 8);
    doc.setFont("courier", "normal");
    doc.text(status, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(err, MARGIN + 25, y);
    doc.text(desc, MARGIN + 70, y);
    y += 5;
  }

  // === 8. HMAC ===
  y = addPage(doc);
  y = heading(doc, "8. HMAC-SHA256 Signature Verification", y, 16);
  y = para(doc, "Each webhook includes the header X-Afroloc-Signature. Always verify the signature before processing events.", y);
  y = heading(doc, "Node.js Example", y, 11);
  y = code(doc, `const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhooks/afroloc', (req, res) => {
  const sig = req.headers['x-afroloc-signature'];
  if (!verifyWebhook(JSON.stringify(req.body), sig, SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  // Process event...
  res.status(200).send('OK');
});`, y);

  y = checkPage(doc, y, 40);
  y = heading(doc, "Python Example", y, 11);
  y = code(doc, `import hmac, hashlib

def verify_signature(body, signature, secret):
    expected = hmac.new(
        secret.encode(), body.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)`, y);

  // === 9. BEST PRACTICES ===
  y = addPage(doc);
  y = heading(doc, "9. Best Practices", y, 16);
  const practices = [
    "Always validate the HMAC signature before processing webhook events.",
    "Check the X-Afroloc-Timestamp header — reject events older than 5 minutes to prevent replay attacks.",
    "Respond to webhooks within 10 seconds. Process asynchronously if needed.",
    "Implement idempotency — the same event may be delivered more than once. Use recordId + event as deduplication key.",
    "Store the webhook secret securely — never expose it in frontend code.",
    "Use the nomenclature format (CC-PROV-MUN-COM-BAI-G10-X-Y) for full address resolution.",
    "Cache lookup results to reduce API calls for frequently accessed addresses.",
    "Handle the 422 status code gracefully — it means the address exists but lacks GPS coordinates.",
  ];
  for (const p of practices) {
    y = bullet(doc, p, y);
  }

  // === FOOTER ===
  y += 15;
  y = checkPage(doc, y, 30);
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(MARGIN, y, CONTENT_W, 25, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Technical Support", MARGIN + 5, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("For integration questions: api@afroloc.com", MARGIN + 5, y + 15);
  doc.text("Full API documentation: /yamioo-api", MARGIN + 5, y + 21);

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`AFROLOC × Yamioo — Integration Guide v2.0.0`, MARGIN, 290);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN - 20, 290);
  }

  doc.save("AFROLOC_Yamioo_Integration_Guide_v2.pdf");
}
