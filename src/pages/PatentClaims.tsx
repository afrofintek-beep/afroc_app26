/**
 * © 2025 AFROFINTEK GmbH. All rights reserved.
 * Patent Claims Viewer — AFR001PEP
 */

import { useState } from "react";
import { afr001pepClaims, type PatentClaim } from "@/lib/afroloc/claims";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Shield,
  Cpu,
  HardDrive,
  ArrowLeft,
  Scale,
  Globe,
  Layers,
  Lock,
  MapPin,
  Download,
} from "lucide-react";
import { generatePatentClaimsPdf } from "@/utils/patentClaimsPdf";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const categoryIcon: Record<string, React.ReactNode> = {
  Method: <Cpu className="h-4 w-4" />,
  System: <Shield className="h-4 w-4" />,
  "Computer-readable medium": <HardDrive className="h-4 w-4" />,
};

const categoryColor: Record<string, string> = {
  Method: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  System: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  "Computer-readable medium": "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

function ClaimCard({ claim }: { claim: PatentClaim }) {
  const { t } = useLanguage();
  const lines = Array.isArray(claim.text) ? claim.text : [claim.text];
  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {t('patent_claim')} {claim.number}
            </span>
            <Badge
              variant="outline"
              className={categoryColor[claim.category] ?? ""}
            >
              {categoryIcon[claim.category]} <span className="ml-1">{claim.category}</span>
            </Badge>
            <Badge variant={claim.type === "Independent" ? "default" : "secondary"} className="text-[10px]">
              {claim.type}
            </Badge>
          </div>
          {claim.dependsOn && (
            <span className="text-[10px] text-muted-foreground">
              ← {t('patent_claim')} {claim.dependsOn}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm leading-relaxed text-foreground/80 space-y-1.5">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PatentClaims() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { claims } = afr001pepClaims;

  const independent = claims.filter((c) => c.type === "Independent");
  const methods = claims.filter((c) => c.category === "Method");
  const systems = claims.filter((c) => c.category === "System");
  const media = claims.filter((c) => c.category === "Computer-readable medium");

  const highlights = [
    { icon: <MapPin className="h-5 w-5" />, label: t('patent_highlight_grid_label'), desc: t('patent_highlight_grid_desc') },
    { icon: <Lock className="h-5 w-5" />, label: t('patent_highlight_trust_label'), desc: t('patent_highlight_trust_desc') },
    { icon: <Globe className="h-5 w-5" />, label: t('patent_highlight_tenant_label'), desc: t('patent_highlight_tenant_desc') },
    { icon: <Layers className="h-5 w-5" />, label: t('patent_highlight_offline_label'), desc: t('patent_highlight_offline_desc') },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/30 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                {t('patent_title')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {afr001pepClaims.reference} — {afr001pepClaims.applicant}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {afr001pepClaims.ipcClasses.length} {t('patent_ipc_classes')}
            </Badge>
            <Button variant="outline" size="sm" onClick={generatePatentClaimsPdf}>
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Abstract */}
        <section>
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {t('patent_abstract')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/80">
                {afr001pepClaims.abstract}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {afr001pepClaims.ipcClasses.map((ipc) => (
                  <Badge key={ipc} variant="secondary" className="font-mono text-[10px]">
                    {ipc}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Innovation Highlights */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t('patent_key_innovations')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {highlights.map((h) => (
              <Card key={h.label} className="border-border/40">
                <CardContent className="flex items-start gap-3 py-4">
                  <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                    {h.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{h.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{h.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        {/* Statistics */}
        <div className="flex flex-wrap gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{claims.length}</p>
            <p className="text-xs text-muted-foreground">{t('patent_stat_total_claims')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{independent.length}</p>
            <p className="text-xs text-muted-foreground">{t('patent_stat_independent')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{methods.length}</p>
            <p className="text-xs text-muted-foreground">{t('patent_stat_method')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{systems.length}</p>
            <p className="text-xs text-muted-foreground">{t('patent_stat_system')}</p>
          </div>
        </div>

        <Separator />

        {/* Claims Tabs */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">{t('patent_tab_all')} ({claims.length})</TabsTrigger>
            <TabsTrigger value="method">{t('patent_stat_method')} ({methods.length})</TabsTrigger>
            <TabsTrigger value="system">{t('patent_stat_system')} ({systems.length})</TabsTrigger>
            <TabsTrigger value="medium">{t('patent_tab_medium')} ({media.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-4">
            {claims.map((c) => (
              <ClaimCard key={c.number} claim={c} />
            ))}
          </TabsContent>
          <TabsContent value="method" className="space-y-3 mt-4">
            {methods.map((c) => (
              <ClaimCard key={c.number} claim={c} />
            ))}
          </TabsContent>
          <TabsContent value="system" className="space-y-3 mt-4">
            {systems.map((c) => (
              <ClaimCard key={c.number} claim={c} />
            ))}
          </TabsContent>
          <TabsContent value="medium" className="space-y-3 mt-4">
            {media.map((c) => (
              <ClaimCard key={c.number} claim={c} />
            ))}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-8 pb-4">
          <p>© 2025 AFROFINTEK GmbH — {t('patent_confidential')}</p>
          <p className="mt-1">
            {t('patent_doc_representation')}{" "}
            <span className="font-mono">{afr001pepClaims.reference}</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
