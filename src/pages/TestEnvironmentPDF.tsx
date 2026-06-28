import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileDown, CheckCircle, Users, MapPin, Grid3X3, Target, Eye, 
  Shield, UserCheck, Phone, Key, Home, Building2, Smartphone
} from "lucide-react";

import { useNavigate } from "react-router-dom";


const TEST_CREDENTIALS = {
  national: [
    { role: "Administrador Nacional", phone: "+244900000001", afroId: "AO-ADM-LRT5X6", password: "Test@2024!" },
    { role: "Administrador Nacional Angola", phone: "+244923828282", afroId: "-", password: "Test@2024!" },
  ],
  provincial: [
    { role: "Admin Provincial Luanda", phone: "+244900100001", afroId: "AO-ADM-Z8569E", province: "Luanda" },
    { role: "Admin Provincial Bengo", phone: "+244900100002", afroId: "AO-ADM-9POHKE", province: "Bengo" },
    { role: "Admin Provincial Benguela", phone: "+244900100003", afroId: "AO-ADM-99TPK6", province: "Benguela" },
    { role: "Admin Provincial Huambo", phone: "+244900100010", afroId: "AO-ADM-W9KVLE", province: "Huambo" },
    { role: "Admin Provincial Huíla", phone: "+244900100011", afroId: "AO-ADM-ZIUZLP", province: "Huíla" },
    { role: "Admin Provincial Cabinda", phone: "+244900100005", afroId: "AO-ADM-UEMEU0", province: "Cabinda" },
  ],
  municipal: [
    { role: "Admin Municipal Ingombota", phone: "+244900200001", afroId: "AO-ADM-G0007K", municipality: "Ingombota" },
    { role: "Admin Municipal Dande", phone: "+244900200006", afroId: "AO-ADM-DBZBYI", municipality: "Dande" },
    { role: "Admin Municipal Benguela", phone: "+244900200014", afroId: "AO-ADM-FNM53O", municipality: "Benguela" },
    { role: "Admin Municipal Huambo", phone: "+244900200009", afroId: "AO-ADM-W7BKTZ", municipality: "Huambo" },
    { role: "Admin Municipal Lubango", phone: "+244900200011", afroId: "AO-ADM-QQYSD0", municipality: "Lubango" },
  ],
  operators: [
    { role: "Operador de Campo", phone: "+244900000004", afroId: "AO-OPE-M484D3" },
  ],
  witnesses: [
    { role: "Testemunha Vizinho 1", phone: "+244900000010", afroId: "AO-TES-1Y33T8" },
    { role: "Testemunha Vizinho 2", phone: "+244900000011", afroId: "AO-TES-TNJ9NW" },
  ],
  citizens: [
    { role: "Maria Santos", phone: "+244923456789", afroId: "AO-MAR-0C0Y3X", description: "3 endereços" },
    { role: "João Pereira", phone: "+244912345678", afroId: "AO-JOÃ-8PSFLP", description: "endereços digitais" },
    { role: "Ana Costa", phone: "+244934567890", afroId: "AO-ANA-ECVVUB", description: "áreas rurais" },
    { role: "Jessica Silva", phone: "+244900000013", afroId: "-", description: "urbana" },
  ],
};

const TEST_ADDRESSES = {
  formal: [
    { code: "AO-TAL-TAL-VID-G10-2ZP1-N1FTR", owner: "Maria Santos", location: "Talatona, Vida Pacífica" },
    { code: "AO-MAI-PRD-NOV-G10-2ZRV-N1FI6", owner: "Maria Santos", location: "Maianga, Prenda Nova" },
    { code: "AO-VIA-ZAN-ZN1-G10-2ZXH-N1FQ6", owner: "Maria Santos", location: "Viana, Zango 1" },
    { code: "AO-TAL-BNV-NOV-G10-2ZPV-N1FS0", owner: "João Pereira", location: "Talatona, Benfica Nova" },
    { code: "AO-ING-CEN-HIS-G10-2ZRO-N1FIZ", owner: "Testemunha 1", location: "Ingombota, Centro Histórico" },
    { code: "AO-MAI-PRE-ALT-G10-2ZRV-N1FI6", owner: "Testemunha 2", location: "Maianga, Prenda Alta" },
  ],
  digital: [
    { code: "AO-CAZ-HOJ-DIG-G10-2ZU9-N1FJM", owner: "João Pereira", location: "Cazenga, Hoji-Ya-Henda" },
    { code: "AO-VIA-EST-DIG-G10-2ZXH-N1FPM", owner: "João Pereira", location: "Viana, Estalagem" },
    { code: "AO-RAN-RAN-DIG-G10-2ZQD-N1FKD", owner: "Ana Costa", location: "Rangel" },
    { code: "AO-CAX-CAX-DIG-G25-K8DN-N9HBI", owner: "Ana Costa", location: "Bengo, Caxito (rural)" },
  ],
};

const DEMO_SCENARIOS = [
  { id: 1, title: "Registo de Endereço Formal", route: "/identities/create", icon: Home },
  { id: 2, title: "Registo de Endereço Digital", route: "/identities/create", icon: Smartphone },
  { id: 3, title: "Validação por Testemunhas", route: "/identities", icon: UserCheck },
  { id: 4, title: "Validação Administrativa", route: "/regional-validation", icon: Shield },
  { id: 5, title: "Consulta por QR Code", route: "/identities", icon: Eye },
  { id: 6, title: "Gestão Hierárquica", route: "/admin/user-management", icon: Users },
  { id: 7, title: "Visualização das Grids QGSQ", route: "/geospatial-grid", icon: Grid3X3 },
  { id: 8, title: "Proximidade de Testemunhas (100m)", route: "/witness-proximity", icon: Target },
];

const PROXIMITY_DATA = [
  { address: "AO-TAL-TAL-VID-G10-2ZP1-N1FTR", witness: "Testemunha 1", distance: "45m", valid: true },
  { address: "AO-TAL-TAL-VID-G10-2ZP1-N1FTR", witness: "Testemunha 2", distance: "78m", valid: true },
  { address: "AO-MAI-PRD-NOV-G10-2ZRV-N1FI6", witness: "Testemunha 1", distance: "32m", valid: true },
  { address: "AO-CAX-CAX-DIG-G25-K8DN-N9HBI", witness: "Testemunha 1", distance: "230m", valid: true, note: "rural <500m" },
];

export default function TestEnvironmentPDF() {
  const [downloaded, setDownloaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  const generatePDF = async () => {
    try {
      setGenerating(true);
      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("AFROLOC - Ambiente de Testes", pageWidth / 2, y, { align: "center" });
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-PT")}`, pageWidth / 2, y, { align: "center" });
      y += 5;
      doc.text("Senha padrão: Test@2024!", pageWidth / 2, y, { align: "center" });
      y += 15;

      // Credentials Section
      const addCredentialsSection = (title: string, creds: any[]) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, margin, y);
        y += 6;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        creds.forEach((c) => {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          doc.text(`${c.role} | ${c.phone} | ${c.afroId || "-"}`, margin, y);
          y += 4;
        });
        y += 5;
      };

      addCredentialsSection("Administradores Nacionais (Nível 5)", TEST_CREDENTIALS.national);
      addCredentialsSection("Administradores Provinciais (Nível 4)", TEST_CREDENTIALS.provincial);
      addCredentialsSection("Administradores Municipais (Nível 3)", TEST_CREDENTIALS.municipal);
      addCredentialsSection("Operadores (Nível 2)", TEST_CREDENTIALS.operators);
      addCredentialsSection("Testemunhas (Nível 1)", TEST_CREDENTIALS.witnesses);
      addCredentialsSection("Cidadãos", TEST_CREDENTIALS.citizens);

      // Addresses
      doc.addPage();
      y = 20;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Endereços AFROLOC de Teste", margin, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Endereços Formais:", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      TEST_ADDRESSES.formal.forEach((a) => {
        doc.text(`${a.code} | ${a.owner} | ${a.location}`, margin, y);
        y += 4;
      });

      y += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Endereços Digitais:", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      TEST_ADDRESSES.digital.forEach((a) => {
        doc.text(`${a.code} | ${a.owner} | ${a.location}`, margin, y);
        y += 4;
      });

      // Grid & Proximity Info
      y += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Sistema de Grids QGSQ", margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("• Células urbanas: 10m x 10m (G10)", margin, y);
      y += 4;
      doc.text("• Células rurais: 25m x 25m (G25)", margin, y);
      y += 4;
      doc.text("• Coordenadas em Base36 (X-Y)", margin, y);
      y += 4;
      doc.text("• Formato: CC-MUN-COM-BAI-G10-X-Y", margin, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.text("Validação de Proximidade", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.text("• Zona urbana: raio máximo 100m", margin, y);
      y += 4;
      doc.text("• Zona rural: raio máximo 500m", margin, y);
      y += 4;
      doc.text("• Fórmula: Haversine (distância geodésica)", margin, y);
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.text("Dados de Proximidade de Teste:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      PROXIMITY_DATA.forEach((p) => {
        doc.text(
          `${p.witness}: ${p.distance} de ${p.address.slice(0, 25)}... ${p.valid ? "✓" : "✗"}`,
          margin,
          y,
        );
        y += 4;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text("AFROLOC - Sistema de Endereçamento Digital para África", pageWidth / 2, 285, { align: "center" });

      doc.save("AFROLOC-Ambiente-Testes.pdf");
      setDownloaded(true);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl p-3 sm:p-4 md:p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Ambiente de Testes AFROLOC
                </CardTitle>
                <CardDescription>
                  Credenciais, endereços e cenários de demonstração
                </CardDescription>
              </div>
              <Button onClick={() => void generatePDF()} className="gap-2" disabled={generating}>
                {downloaded ? <CheckCircle className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
                {generating ? "A gerar PDF..." : downloaded ? "PDF Descarregado" : "Descarregar PDF"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium">Senha padrão para todos os utilizadores:</p>
              <code className="text-lg font-mono text-primary">Test@2024!</code>
              <p className="text-xs text-muted-foreground mt-1">
                Login via telefone + OTP (auto-confirmado em ambiente de teste)
              </p>
            </div>

            <Tabs defaultValue="credentials" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                <TabsTrigger value="credentials">Credenciais</TabsTrigger>
                <TabsTrigger value="addresses">Endereços</TabsTrigger>
                <TabsTrigger value="scenarios">Cenários</TabsTrigger>
                <TabsTrigger value="grids">Grids & Proximidade</TabsTrigger>
              </TabsList>

              <TabsContent value="credentials" className="space-y-4">
                {/* National */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="default">Nível 5</Badge>
                      Administradores Nacionais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {TEST_CREDENTIALS.national.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
                          <span>{c.role}</span>
                          <div className="flex items-center gap-4">
                            <code className="text-xs">{c.phone}</code>
                            <Badge variant="outline">{c.afroId}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Provincial */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="secondary">Nível 4</Badge>
                      Administradores Provinciais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-2 md:grid-cols-2">
                      {TEST_CREDENTIALS.provincial.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
                          <span className="truncate">{c.province}</span>
                          <code className="text-xs">{c.phone}</code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Municipal */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="outline">Nível 3</Badge>
                      Administradores Municipais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-2 md:grid-cols-2">
                      {TEST_CREDENTIALS.municipal.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
                          <span className="truncate">{c.municipality}</span>
                          <code className="text-xs">{c.phone}</code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Witnesses & Citizens */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Testemunhas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {TEST_CREDENTIALS.witnesses.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1">
                          <span>{c.role}</span>
                          <code className="text-xs">{c.phone}</code>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Cidadãos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {TEST_CREDENTIALS.citizens.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1">
                          <span>{c.role}</span>
                          <code className="text-xs">{c.phone}</code>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="addresses" className="space-y-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Endereços Formais (com rua e número)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {TEST_ADDRESSES.formal.map((a, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-muted/30 p-2 rounded gap-2">
                          <code className="text-xs font-mono text-primary">{a.code}</code>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{a.owner}</span>
                            <Badge variant="outline" className="text-xs">{a.location}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Endereços Digitais (só GPS)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {TEST_ADDRESSES.digital.map((a, i) => (
                        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-muted/30 p-2 rounded gap-2">
                          <code className="text-xs font-mono text-primary">{a.code}</code>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{a.owner}</span>
                            <Badge variant="secondary" className="text-xs">{a.location}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="scenarios" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {DEMO_SCENARIOS.map((scenario) => (
                    <Card 
                      key={scenario.id} 
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => navigate(scenario.route)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <scenario.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Cenário {scenario.id}</p>
                          <p className="text-sm text-muted-foreground">{scenario.title}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="grids" className="space-y-4">
                {/* Grid Info */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      Sistema de Grids QGSQ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="font-medium text-blue-600 dark:text-blue-400">Células Urbanas (G10)</p>
                        <p className="text-2xl font-bold">10m × 10m</p>
                        <p className="text-sm text-muted-foreground">Alta precisão para áreas densas</p>
                      </div>
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <p className="font-medium text-green-600 dark:text-green-400">Células Rurais (G25)</p>
                        <p className="text-2xl font-bold">25m × 25m</p>
                        <p className="text-sm text-muted-foreground">Cobertura para áreas extensas</p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2">Nomenclatura Oficial:</p>
                      <code className="text-lg font-mono text-primary">CC-PROV-MUN-COM-BAI-G10-X-Y</code>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        <div><span className="font-medium">CC:</span> Código do país</div>
                        <div><span className="font-medium">MUN:</span> Município</div>
                        <div><span className="font-medium">COM:</span> Comuna</div>
                        <div><span className="font-medium">BAI/DIG:</span> Bairro ou Digital</div>
                        <div><span className="font-medium">G10/G25:</span> Tamanho da célula</div>
                        <div><span className="font-medium">X-Y:</span> Coordenadas Base36</div>
                      </div>
                    </div>

                    <Button 
                      onClick={() => navigate('/geospatial-grid')} 
                      className="w-full gap-2"
                    >
                      <Grid3X3 className="h-4 w-4" />
                      Ver Grid Geoespacial
                    </Button>
                  </CardContent>
                </Card>

                {/* Proximity Info */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Validação de Proximidade das Testemunhas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                        <p className="font-medium text-orange-600 dark:text-orange-400">Zona Urbana</p>
                        <p className="text-2xl font-bold">≤ 100m</p>
                        <p className="text-sm text-muted-foreground">Raio máximo de validação</p>
                      </div>
                      <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-4">
                        <p className="font-medium text-teal-600 dark:text-teal-400">Zona Rural</p>
                        <p className="text-2xl font-bold">≤ 500m</p>
                        <p className="text-sm text-muted-foreground">Raio máximo de validação</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Dados de Proximidade de Teste:</p>
                      <div className="space-y-2">
                        {PROXIMITY_DATA.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
                            <div className="flex items-center gap-2">
                              {p.valid ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <div className="h-4 w-4 rounded-full bg-red-500" />
                              )}
                              <span>{p.witness}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={p.valid ? "default" : "destructive"}>{p.distance}</Badge>
                              {p.note && <span className="text-xs text-muted-foreground">({p.note})</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button 
                      onClick={() => navigate('/witness-proximity')} 
                      variant="outline"
                      className="w-full gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      Ver Mapa de Proximidade
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
