/**
 * AFROLOC Public API Documentation
 * 
 * OpenAPI-style documentation page for partner integrations (Yamioo, etc.)
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, ExternalLink, Shield, Globe, Zap, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  summary: string;
  auth: "none" | "jwt" | "service_role";
  request?: object;
  response?: object;
  tags: string[];
}

const endpoints: Endpoint[] = [
  {
    method: "POST",
    path: "/qg-engine",
    summary: "Resolve lat/lon into an AFROLOC code with automatic urban/rural zone detection via PostGIS.",
    auth: "jwt",
    tags: ["Core", "Geospatial"],
    request: { latitude: -8.8383, longitude: 13.2344, countryCode: "AO" },
    response: { afroloc: "AO-ZU-G10-X35O8-YN247T", zone: "urban", grid_m: 10, centroid: { lat: -8.838, lon: 13.234 } },
  },
  {
    method: "POST",
    path: "/batch-resolve",
    summary: "Resolve up to 100 coordinate pairs into AFROLOC codes in parallel.",
    auth: "jwt",
    tags: ["Core", "Bulk"],
    request: {
      points: [{ id: "p1", latitude: -8.8383, longitude: 13.2344, countryCode: "AO" }],
      defaultCountry: "AO",
    },
    response: { results: [{ id: "p1", code: "AO-ZU-G10-X35O8-YN247T", zone: "urban", gridSize: 10 }], total: 1, resolved: 1, failed: 0 },
  },
  {
    method: "POST",
    path: "/address-create",
    summary: "Create a new AFROLOC address with QG/SQ engine integration and initial ATS scoring.",
    auth: "jwt",
    tags: ["Address", "Core"],
    request: {
      countryCode: "AO",
      latitude: -8.8383,
      longitude: 13.2344,
      street_name: "Rua Major Kanhangulo",
      number: "45",
      level1_name: "Luanda",
    },
    response: { success: true, record: { id: "uuid", code: "AO-ZU-G10-X...-Y...", status: "pending" } },
  },
  {
    method: "POST",
    path: "/address-verify",
    summary: "Verify an address based on GPS proximity to stored coordinates.",
    auth: "jwt",
    tags: ["Address", "Verification"],
    request: { afrolocRecordId: "uuid", latitude: -8.8383, longitude: 13.2344 },
    response: { verified: true, distance_m: 12.5, threshold_m: 150 },
  },
  {
    method: "POST",
    path: "/ats-score",
    summary: "Calculate Address Trust Score (0-100) based on verification history, witnesses, and check-ins.",
    auth: "jwt",
    tags: ["Address", "Trust"],
    request: { afrolocRecordId: "uuid" },
    response: { score: 78, breakdown: { completeness: 90, witnesses: 70, checkins: 85, verification: 65 } },
  },
  {
    method: "POST",
    path: "/resident-checkin",
    summary: "Record proof-of-presence check-in (72h cooldown, 150m/500m radius).",
    auth: "jwt",
    tags: ["Residency", "Verification"],
    request: { afrolocRecordId: "uuid", latitude: -8.8383, longitude: 13.2344, deviceFingerprint: "fp_abc" },
    response: { success: true, valid: true, streak: 5, nextCheckinDue: "2026-02-10T00:00:00Z" },
  },
  {
    method: "GET",
    path: "/resolve-zone",
    summary: "Public endpoint — determine urban/rural zone for given coordinates (no auth required).",
    auth: "none",
    tags: ["Public", "Geospatial"],
    request: { lat: -8.8383, lon: 13.2344 },
    response: { zone: "urban", grid_m: 10, tags: ["luanda", "maianga"] },
  },
  {
    method: "GET",
    path: "/export-geojson",
    summary: "Export address records as GeoJSON FeatureCollection with administrative metadata.",
    auth: "jwt",
    tags: ["GIS", "Export"],
    request: { countryCode: "AO", status: "approved" },
    response: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [13.234, -8.838] } }] },
  },
  {
    method: "POST",
    path: "/webhook-dispatch",
    summary: "Register webhook subscription for AFROLOC events (HMAC-SHA256 signed).",
    auth: "jwt",
    tags: ["Integration", "Webhooks"],
    request: { url: "https://yamioo.com/webhooks/afroloc", events: ["address.status_changed", "checkin.completed"], secret: "whsec_..." },
    response: { success: true, subscription_id: "uuid" },
  },
  {
    method: "POST",
    path: "/normalize",
    summary: "Normalize raw address string to standard AFROLOC format with rule-based corrections.",
    auth: "jwt",
    tags: ["Address", "Processing"],
    request: { input: "avenida 4 de fevereiro, 123, luanda" },
    response: { success: true, normalized: { thoroughfare: { type: "AV", name: "4 de Fevereiro" }, premise: { number: "123" } } },
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const authBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  none: { label: "Public", variant: "secondary" },
  jwt: { label: "JWT", variant: "default" },
  service_role: { label: "Service Role", variant: "outline" },
};

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copiado!");
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/50 border rounded-lg p-4 text-xs overflow-x-auto font-mono">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function ApiDocumentation() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const tagGroups = endpoints.reduce((acc, ep) => {
    const primary = ep.tags[0];
    if (!acc[primary]) acc[primary] = [];
    acc[primary].push(ep);
    return acc;
  }, {} as Record<string, Endpoint[]>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">AFROLOC API</h1>
              <p className="text-muted-foreground mt-1">Documentação pública para integrações de parceiros</p>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" />v1.0.0</Badge>
                <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" />HMAC-SHA256</Badge>
                <Badge variant="outline" className="gap-1"><Zap className="h-3 w-3" />REST + JSON</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Base URL */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5" /> Base URL</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={API_BASE} language="text" />
            <p className="text-sm text-muted-foreground mt-3">
              Todas as chamadas autenticadas requerem o header <code className="bg-muted px-1.5 py-0.5 rounded text-xs">Authorization: Bearer {'<JWT>'}</code>.
              O token anon key deve ser enviado no header <code className="bg-muted px-1.5 py-0.5 rounded text-xs">apikey</code>.
            </p>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" /> Autenticação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border rounded-lg p-4">
                <Badge variant="secondary" className="mb-2">Public</Badge>
                <p className="text-sm text-muted-foreground">Sem autenticação. Apenas endpoints de leitura pública (resolve-zone).</p>
              </div>
              <div className="border rounded-lg p-4">
                <Badge className="mb-2">JWT</Badge>
                <p className="text-sm text-muted-foreground">Token de utilizador autenticado. Acesso baseado em RLS e roles.</p>
              </div>
              <div className="border rounded-lg p-4">
                <Badge variant="outline" className="mb-2">Service Role</Badge>
                <p className="text-sm text-muted-foreground">Chave de serviço para operações administrativas e backend-to-backend.</p>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Exemplo cURL</h4>
              <CodeBlock code={`curl -X POST "${API_BASE}/qg-engine" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -H "Authorization: Bearer <JWT_TOKEN>" \\
  -d '{"latitude": -8.8383, "longitude": 13.2344, "countryCode": "AO"}'`} />
            </div>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5" /> Webhooks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Eventos são entregues via HTTP POST com assinatura HMAC-SHA256 no header <code className="bg-muted px-1.5 py-0.5 rounded text-xs">X-Afroloc-Signature</code>.
            </p>
            <div>
              <h4 className="font-medium mb-2">Eventos disponíveis</h4>
              <div className="flex flex-wrap gap-2">
                {["address.created", "address.status_changed", "address.verified", "checkin.completed", "witness.confirmed", "resident.approved"].map(evt => (
                  <Badge key={evt} variant="outline" className="font-mono text-xs">{evt}</Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Verificação de assinatura (Node.js)</h4>
              <CodeBlock code={`const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`} />
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Endpoints</h2>
          
          <Tabs defaultValue={Object.keys(tagGroups)[0]} className="w-full">
            <TabsList className="flex-wrap h-auto gap-1">
              {Object.keys(tagGroups).map(tag => (
                <TabsTrigger key={tag} value={tag} className="text-xs">{tag}</TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(tagGroups).map(([tag, eps]) => (
              <TabsContent key={tag} value={tag} className="space-y-4 mt-4">
                {eps.map((ep, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={`${methodColors[ep.method]} border font-mono text-xs px-2`}>
                          {ep.method}
                        </Badge>
                        <code className="font-mono text-sm font-medium">{ep.path}</code>
                        <Badge {...authBadge[ep.auth]} className="text-xs ml-auto">
                          {authBadge[ep.auth].label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{ep.summary}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {ep.request && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">
                            {ep.method === "GET" ? "Query Parameters" : "Request Body"}
                          </h4>
                          <CodeBlock code={JSON.stringify(ep.request, null, 2)} />
                        </div>
                      )}
                      {ep.response && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">Response</h4>
                          <CodeBlock code={JSON.stringify(ep.response, null, 2)} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* SDK */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">SDK Offline — @afroloc/sdk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Funções offline (sem I/O) para encode/decode/validate AFROLOC codes no cliente, sem dependência de rede.
            </p>
            <CodeBlock code={`import { encode, decode, validate, distance, deepLink } from '@afroloc/sdk';

// Encode coordenadas → código AFROLOC
const result = encode(-8.8383, 13.2344, 'AO', 'urban');
// → { code: 'AO-ZU-G10-X35O8-YN247T', zone: 'urban', gridSize: 10 }

// Decode código → coordenadas
const geo = decode('AO-ZU-G10-X35O8-YN247T');
// → { centroid: { lat: -8.838, lon: 13.234 }, bbox: {...} }

// Validar formato (inclui conversão de legacy codes)
const check = validate('AO-URBAN-G10-X35O8-YN247T');
// → { valid: true, wasConverted: true, normalizedCode: 'AO-ZU-G10-...' }

// Deep link
const links = deepLink('address', 'AO-ZU-G10-X35O8-YN247T');
// → { native: 'afroloc://address/...', web: 'https://.../dl/address/...' }`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
