/**
 * AFROLOC × Yamioo — Integration API Documentation
 * Public page for Yamioo partners to integrate with AFROLOC
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Shield, Globe, Zap, MapPin, CheckCircle, Truck, Bell, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import { generateYamiooIntegrationPdf } from "@/utils/yamiooIntegrationPdf";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const GATEWAY = `${BASE_URL}/yamioo-gateway`;

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Copied!");
  };
  return (
    <div className="relative group">
      {label && <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>}
      <pre className="bg-muted/50 border rounded-lg p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap">
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

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export default function YamiooApiDocs() {
  const copyUrl = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL copiado!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="text-xs gap-1"><Globe className="h-3 w-3" />Public</Badge>
            <Badge variant="outline" className="text-xs">v1.0.0</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AFROLOC × Yamioo</h1>
          <p className="text-muted-foreground mt-2">API de Integração para a plataforma Yamioo — consulta, verificação e webhooks de endereços AFROLOC.</p>
          <div className="mt-4 flex items-center gap-2">
            <code className="bg-muted px-3 py-1.5 rounded text-xs font-mono flex-1 truncate">{GATEWAY}</code>
            <Button variant="outline" size="sm" onClick={() => copyUrl(GATEWAY)} className="gap-1 shrink-0">
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
            <Button variant="default" size="sm" onClick={generateYamiooIntegrationPdf} className="gap-1 shrink-0">
              <Download className="h-3.5 w-3.5" /> Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* AFROLOC Code Format */}
        <Section title="Formato do Código AFROLOC" icon={<MapPin className="h-5 w-5" />}>
          <p className="text-sm text-muted-foreground">
            O sistema AFROLOC utiliza códigos geoespaciais baseados na projeção Web Mercator. Existem dois formatos aceites:
          </p>
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium mb-1">Formato Standard</h4>
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono">CC-ZT-Gnn-Xxxxx-Yyyyy</code>
              <p className="text-xs text-muted-foreground mt-1">Exemplo: <code className="bg-muted px-1 rounded">AO-ZU-G10-X35O8-YN247T</code></p>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Formato Nomenclatura (com hierarquia administrativa)</h4>
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono">CC-PROV-MUN-COM-BAI-Gnn-Xxxxx-Yyyyy</code>
              <p className="text-xs text-muted-foreground mt-1">Exemplo: <code className="bg-muted px-1 rounded">AO-LUA-BEL-TAL-CAM-G10-X35O8-YN247T</code></p>
            </div>
            <div className="bg-muted/30 border rounded-lg p-3">
              <h4 className="text-xs font-medium mb-1">Legenda</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                <li><strong>CC</strong> — Código do país (ISO 3166-1, ex: AO)</li>
                <li><strong>ZT</strong> — Tipo de zona: ZU (urbano, 10m) ou ZR (rural, 25m)</li>
                <li><strong>PROV/MUN/COM/BAI</strong> — Hierarquia administrativa</li>
                <li><strong>Gnn</strong> — Tamanho da grelha em metros (G10 ou G25)</li>
                <li><strong>X/Y</strong> — Coordenadas Web Mercator em Base-36 (prefixo N = negativo)</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* Quick Start */}
        <Section title="Quick Start" icon={<Zap className="h-5 w-5" />}>
          <p className="text-sm text-muted-foreground">
            Todas as chamadas usam um único endpoint com o parâmetro <code className="bg-muted px-1 py-0.5 rounded text-xs">?action=</code>. 
            O header <code className="bg-muted px-1 py-0.5 rounded text-xs">apikey</code> é obrigatório em todas as chamadas.
            Códigos AFROLOC devem seguir o formato <code className="bg-muted px-1 py-0.5 rounded text-xs">CC-ZT-Gnn-Xxxxx-Yyyyy</code>.
          </p>
          <CodeBlock label="Health Check" code={`curl "${GATEWAY}?action=status" \\
  -H "apikey: <ANON_KEY>"`} />
          <CodeBlock label="Response" code={`{
  "status": "operational",
  "partner": "yamioo",
  "version": "2.0.0",
  "code_format": {
    "standard": "CC-ZT-Gnn-Xxxxx-Yyyyy",
    "nomenclature": "CC-PROV-MUN-COM-BAI-Gnn-Xxxxx-Yyyyy",
    "examples": [
      "AO-ZU-G10-X35O8-YN247T",
      "AO-LUA-BEL-TAL-CAM-G10-X35O8-YN247T"
    ]
  },
  "endpoints": ["lookup", "verify", "subscribe", "status"]
}`} />
        </Section>

        {/* 1. Lookup */}
        <Section title="1. Lookup — Consultar Endereço" icon={<MapPin className="h-5 w-5" />}>
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 border font-mono text-xs">POST</Badge>
          <code className="font-mono text-sm ml-2">?action=lookup</code>

          <div className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Opção A — Lookup por código AFROLOC</h4>
              <CodeBlock label="Request" code={`curl -X POST "${GATEWAY}?action=lookup" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -d '{
    "code": "AO-ZU-G10-X35O8-YN247T"
  }'`} />
              <CodeBlock label="Response" code={`{
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
    },
    "street": "Rua Major Kanhangulo 45",
    "property_type": "residential"
  }
}`} />
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Opção B — Lookup por coordenadas GPS</h4>
              <CodeBlock label="Request" code={`curl -X POST "${GATEWAY}?action=lookup" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -d '{
    "latitude": -8.8383,
    "longitude": 13.2344,
    "countryCode": "AO"
  }'`} />
              <CodeBlock label="Response" code={`{
  "found": true,
  "resolved": {
    "afroloc": "AO-ZU-G10-X35O8-YN247T",
    "zone": "urban",
    "grid_m": 10
  }
}`} />
            </div>
          </div>
        </Section>

        {/* 2. Verify */}
        <Section title="2. Verify — Verificar Entrega GPS" icon={<CheckCircle className="h-5 w-5" />}>
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 border font-mono text-xs">POST</Badge>
          <code className="font-mono text-sm ml-2">?action=verify</code>

          <p className="text-sm text-muted-foreground mt-2">
            Verifica se a posição GPS do entregador está dentro do raio do endereço AFROLOC.
            Thresholds: <strong>150m</strong> (urbano) / <strong>500m</strong> (rural).
          </p>

          <CodeBlock label="Request" code={`curl -X POST "${GATEWAY}?action=verify" \\
  -H "Content-Type: application/json" \\
  -H "apikey: <ANON_KEY>" \\
  -d '{
    "code": "AO-ZU-G10-X35O8-YN247T",
    "latitude": -8.8390,
    "longitude": 13.2350
  }'`} />
          <CodeBlock label="Response" code={`{
  "verified": true,
  "distance_m": 87.3,
  "threshold_m": 150,
  "status": "approved",
  "address_type": "formal"
}`} />

          <div className="bg-muted/30 border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-1">Lógica de verificação</h4>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>verified = true</strong> → distância ≤ threshold (entrega confirmada)</li>
              <li><strong>verified = false</strong> → distância &gt; threshold (fora do raio)</li>
              <li>Distância calculada via fórmula Haversine (precisão sub-metro)</li>
            </ul>
          </div>
        </Section>

        {/* 3. Subscribe */}
        <Section title="3. Subscribe — Webhooks em Tempo Real" icon={<Bell className="h-5 w-5" />}>
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 border font-mono text-xs">POST</Badge>
          <code className="font-mono text-sm ml-2">?action=subscribe</code>

          <CodeBlock label="Request" code={`curl -X POST "${GATEWAY}?action=subscribe" \\
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
  }'`} />
          <CodeBlock label="Response" code={`{
  "subscription_id": "uuid-da-subscricao",
  "events": ["address.created", "address.status_changed", "address.verified", "checkin.completed"],
  "status": "active"
}`} />

          <div>
            <h4 className="text-sm font-medium mb-2">Eventos disponíveis</h4>
            <div className="flex flex-wrap gap-2">
              {[
                "address.created",
                "address.status_changed",
                "address.verified",
                "checkin.completed",
                "witness.confirmed",
                "resident.approved",
              ].map(evt => (
                <Badge key={evt} variant="outline" className="font-mono text-xs">{evt}</Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Verificação de assinatura HMAC-SHA256</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Cada webhook inclui o header <code className="bg-muted px-1 py-0.5 rounded">X-Afroloc-Signature</code>.
            </p>
            <CodeBlock label="Node.js" code={`const crypto = require('crypto');

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

// No handler Express/Fastify:
app.post('/webhooks/afroloc', (req, res) => {
  const sig = req.headers['x-afroloc-signature'];
  if (!verifyWebhook(JSON.stringify(req.body), sig, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  // Processar evento...
  res.status(200).send('OK');
});`} />
          </div>
        </Section>

        {/* 4. Delivery Flow */}
        <Section title="4. Fluxo de Entrega Recomendado" icon={<Truck className="h-5 w-5" />}>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-sm font-medium">Cliente fornece código AFROLOC</p>
                <p className="text-xs text-muted-foreground">Ex: AO-ZU-G10-X35O8-YN247T</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-sm font-medium">Yamioo faz lookup para obter coordenadas</p>
                <p className="text-xs text-muted-foreground">POST ?action=lookup → coordenadas + hierarquia administrativa</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-sm font-medium">Entregador navega até ao local</p>
                <p className="text-xs text-muted-foreground">Usar coordinates.lat / coordinates.lon no GPS do entregador</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <div>
                <p className="text-sm font-medium">Confirmar entrega com verificação GPS</p>
                <p className="text-xs text-muted-foreground">POST ?action=verify → verified: true/false</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Error Codes */}
        <Section title="Códigos de Erro" icon={<Shield className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Status</th>
                  <th className="text-left py-2 pr-4 font-medium">Erro</th>
                  <th className="text-left py-2 font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b"><td className="py-2 pr-4 font-mono">400</td><td className="pr-4">Bad Request</td><td>Parâmetros em falta ou inválidos</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono">404</td><td className="pr-4">Not Found</td><td>Código AFROLOC não encontrado</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono">405</td><td className="pr-4">Method Not Allowed</td><td>Método HTTP incorrecto (usar POST)</td></tr>
                <tr className="border-b"><td className="py-2 pr-4 font-mono">500</td><td className="pr-4">Internal Error</td><td>Erro interno do servidor</td></tr>
                <tr><td className="py-2 pr-4 font-mono">502</td><td className="pr-4">Bad Gateway</td><td>Falha na resolução de coordenadas</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Support */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-6">
            <div className="text-center space-y-2">
              <h3 className="font-semibold">Suporte Técnico</h3>
              <p className="text-sm text-muted-foreground">
                Para questões de integração: <strong>api@afroloc.com</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Documentação geral da API AFROLOC disponível em <a href="/api-docs" className="text-primary underline">/api-docs</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
