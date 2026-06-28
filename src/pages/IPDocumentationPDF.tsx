/**
 * AFROLOC - African Digital Address Identification System
 * 
 * Copyright (c) 2024-2026 AFROFINTEK GmbH. All rights reserved.
 * 
 * This file is part of the AFROLOC proprietary software.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited.
 * 
 * For licensing inquiries, contact: legal@afroloc.com
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Shield, CheckCircle, AlertTriangle, Loader2, Globe } from "lucide-react";
import { jsPDF } from "jspdf";

type Language = 'en' | 'pt';

interface Translations {
  coverTitle: string;
  coverSubtitle: string;
  preparedFor: string;
  date: string;
  version: string;
  classification: string;
  owner: string;
  executiveSummary: string;
  companyOverview: string;
  companyDescription: string;
  overallRisk: string;
  riskDescription: string;
  ipPortfolio: string;
  coreProprietaryTech: string;
  ipAsset: string;
  type: string;
  status: string;
  brandAssets: string;
  asset: string;
  dependencyAnalysis: string;
  totalDependencies: string;
  license: string;
  count: string;
  percentage: string;
  compatibility: string;
  keyFinding: string;
  keyFindingDesc: string;
  sourceCodeOwnership: string;
  category: string;
  files: string;
  ownership: string;
  keyAlgorithms: string;
  atsDesc: string;
  qgsqDesc: string;
  gpsDesc: string;
  witnessDesc: string;
  riskAssessment: string;
  riskCategory: string;
  assessment: string;
  details: string;
  complianceStatus: string;
  sbom: string;
  thirdParty: string;
  copyrightHeaders: string;
  licenseDocs: string;
  noConflicts: string;
  recommendations: string;
  immediate: string;
  shortTerm: string;
  longTerm: string;
  rec1: string;
  rec2: string;
  rec3: string;
  rec4: string;
  rec5: string;
  rec6: string;
  rec7: string;
  rec8: string;
  rec9: string;
  conclusion: string;
  conclusionText: string;
  keyStrengths: string;
  strength1: string;
  strength2: string;
  strength3: string;
  strength4: string;
  documentInfo: string;
  preparedBy: string;
  reviewStatus: string;
  generated: string;
  footer1: string;
  footer2: string;
  commercialFriendly: string;
  noneFound: string;
  tradeSecret: string;
  // Risk rows
  copyleftContamination: string;
  licenseCompliance: string;
  thirdPartyClaims: string;
  patentRisk: string;
  tradeSecretProtection: string;
  none: string;
  compliant: string;
  lowRisk: string;
  reviewNeeded: string;
  moderate: string;
  noCopyleft: string;
  allDepsPermissive: string;
  standardStack: string;
  priorArt: string;
  ndaRecommended: string;
  // Ownership rows
  proprietaryLogic: string;
  uiComponents: string;
  thirdPartyDeps: string;
  translationFiles: string;
  documentation: string;
  mitModified: string;
  openSourceLicensed: string;
}

const translations: Record<Language, Translations> = {
  en: {
    coverTitle: "INTELLECTUAL PROPERTY DOCUMENTATION",
    coverSubtitle: "INTELLECTUAL PROPERTY DOCUMENTATION",
    preparedFor: "Prepared for: Investors & Regulators",
    date: "Date: January 16, 2026",
    version: "Version: 1.0",
    classification: "Classification: Confidential",
    owner: "Owner: AFROFINTEK GmbH",
    executiveSummary: "EXECUTIVE SUMMARY",
    companyOverview: "Company Overview",
    companyDescription: "AFROLOC is a proprietary digital addressing system owned by AFROFINTEK GmbH, designed to provide unique, verifiable addresses for every location in Africa. The platform enables digital identity verification, financial inclusion, and essential service delivery across the continent.",
    overallRisk: "Overall IP Risk Assessment: LOW",
    riskDescription: "The codebase is predominantly proprietary with well-documented open-source dependencies under permissive licenses (MIT, Apache 2.0, ISC). No copyleft (GPL/AGPL/LGPL) licenses detected.",
    ipPortfolio: "INTELLECTUAL PROPERTY PORTFOLIO",
    coreProprietaryTech: "Core Proprietary Technology (Trade Secrets)",
    ipAsset: "IP Asset",
    type: "Type",
    status: "Status",
    brandAssets: "Brand Assets",
    asset: "Asset",
    dependencyAnalysis: "DEPENDENCY ANALYSIS",
    totalDependencies: "Total Dependencies: 82 packages",
    license: "License",
    count: "Count",
    percentage: "Percentage",
    compatibility: "Compatibility",
    keyFinding: "Key Finding: No Copyleft Contamination",
    keyFindingDesc: "The codebase contains zero GPL, AGPL, or LGPL licensed dependencies. This means there are no viral license obligations that would require disclosure of proprietary source code.",
    sourceCodeOwnership: "SOURCE CODE OWNERSHIP",
    category: "Category",
    files: "Files",
    ownership: "Ownership",
    keyAlgorithms: "Key Algorithms (Protected as Trade Secrets)",
    atsDesc: "ATS Score Calculation - Weighted multi-factor scoring (GPS, Telecom, EXIF, Witness, Audit)",
    qgsqDesc: "QGSQ Grid System - Continental grid tessellation with urban/rural cell differentiation",
    gpsDesc: "GPS Spoofing Detection - EXIF-GPS correlation, impossible movement detection",
    witnessDesc: "Witness Reputation System - Reputation-weighted scoring, collusion detection",
    riskAssessment: "RISK ASSESSMENT",
    riskCategory: "Risk Category",
    assessment: "Assessment",
    details: "Details",
    complianceStatus: "Compliance Status",
    sbom: "Software Bill of Materials (SBOM) - Complete in CycloneDX format",
    thirdParty: "Third-Party Notices - Comprehensive notices documented",
    copyrightHeaders: "Copyright Headers - Applied to core proprietary source files",
    licenseDocs: "License Documentation - All dependency licenses documented",
    noConflicts: "No license conflicts identified",
    recommendations: "RECOMMENDATIONS",
    immediate: "Immediate (0-30 days)",
    shortTerm: "Short-term (30-90 days)",
    longTerm: "Long-term (90+ days)",
    rec1: "Register AFROLOC trademark in key jurisdictions",
    rec2: "Implement source code copyright notices across all files",
    rec3: "Review Mapbox commercial license requirements",
    rec4: "Establish contributor IP assignment agreements",
    rec5: "Implement automated license scanning in CI/CD",
    rec6: "Create comprehensive trade secret documentation",
    rec7: "Consider patent applications for core algorithms",
    rec8: "Conduct freedom-to-operate analysis",
    rec9: "Establish trade secret protection policies",
    conclusion: "CONCLUSION",
    conclusionText: "AFROLOC, owned by AFROFINTEK GmbH, has a clean and commercially viable IP portfolio. The codebase uses industry-standard open-source components under permissive licenses (MIT, Apache 2.0, BSD), with no copyleft contamination. Core business logic and algorithms are 100% proprietary.",
    keyStrengths: "Key Strengths:",
    strength1: "No GPL/AGPL/LGPL dependencies",
    strength2: "Clear ownership of core algorithms",
    strength3: "Well-documented third-party usage",
    strength4: "Copyright headers applied to proprietary files",
    documentInfo: "DOCUMENT INFORMATION",
    preparedBy: "Prepared by: AFROFINTEK GmbH - IP Audit System",
    reviewStatus: "Review Status: Complete",
    generated: "Generated: ",
    footer1: "This document is prepared for investor due diligence and regulatory compliance purposes.",
    footer2: "For detailed technical analysis, refer to the complete IP Audit documentation in the codebase.",
    commercialFriendly: "Commercial-friendly",
    noneFound: "None found",
    tradeSecret: "Trade Secret",
    copyleftContamination: "Copyleft Contamination",
    licenseCompliance: "License Compliance",
    thirdPartyClaims: "Third-Party Claims",
    patentRisk: "Patent Risk",
    tradeSecretProtection: "Trade Secret Protection",
    none: "None",
    compliant: "Compliant",
    lowRisk: "Low Risk",
    reviewNeeded: "Review Needed",
    moderate: "Moderate",
    noCopyleft: "No GPL/AGPL/LGPL dependencies",
    allDepsPermissive: "All dependencies MIT/Apache/BSD",
    standardStack: "Standard open-source stack",
    priorArt: "Geographic algorithms may have prior art",
    ndaRecommended: "NDA/employment agreements recommended",
    proprietaryLogic: "Proprietary Business Logic",
    uiComponents: "UI Components (shadcn/ui)",
    thirdPartyDeps: "Third-Party Dependencies",
    translationFiles: "Translation Files",
    documentation: "Documentation",
    mitModified: "MIT Licensed (modifications owned)",
    openSourceLicensed: "Open Source (licensed)",
  },
  pt: {
    coverTitle: "DOCUMENTAÇÃO DE PROPRIEDADE INTELECTUAL",
    coverSubtitle: "DOCUMENTAÇÃO DE PROPRIEDADE INTELECTUAL",
    preparedFor: "Preparado para: Investidores & Reguladores",
    date: "Data: 16 de Janeiro de 2026",
    version: "Versão: 1.0",
    classification: "Classificação: Confidencial",
    owner: "Proprietário: AFROFINTEK GmbH",
    executiveSummary: "RESUMO EXECUTIVO",
    companyOverview: "Visão Geral da Empresa",
    companyDescription: "O AFROLOC é um sistema proprietário de endereçamento digital pertencente à AFROFINTEK GmbH, concebido para fornecer endereços únicos e verificáveis para cada localização em África. A plataforma permite a verificação de identidade digital, inclusão financeira e prestação de serviços essenciais em todo o continente.",
    overallRisk: "Avaliação Global de Risco de PI: BAIXO",
    riskDescription: "O código-fonte é predominantemente proprietário com dependências de código aberto bem documentadas sob licenças permissivas (MIT, Apache 2.0, ISC). Não foram detectadas licenças copyleft (GPL/AGPL/LGPL).",
    ipPortfolio: "PORTFÓLIO DE PROPRIEDADE INTELECTUAL",
    coreProprietaryTech: "Tecnologia Proprietária Central (Segredos Comerciais)",
    ipAsset: "Ativo de PI",
    type: "Tipo",
    status: "Estado",
    brandAssets: "Ativos de Marca",
    asset: "Ativo",
    dependencyAnalysis: "ANÁLISE DE DEPENDÊNCIAS",
    totalDependencies: "Total de Dependências: 82 pacotes",
    license: "Licença",
    count: "Quantidade",
    percentage: "Percentagem",
    compatibility: "Compatibilidade",
    keyFinding: "Descoberta Principal: Sem Contaminação Copyleft",
    keyFindingDesc: "O código-fonte não contém nenhuma dependência licenciada sob GPL, AGPL ou LGPL. Isto significa que não existem obrigações de licença viral que exigiriam a divulgação do código-fonte proprietário.",
    sourceCodeOwnership: "PROPRIEDADE DO CÓDIGO-FONTE",
    category: "Categoria",
    files: "Ficheiros",
    ownership: "Propriedade",
    keyAlgorithms: "Algoritmos Principais (Protegidos como Segredos Comerciais)",
    atsDesc: "Cálculo da Pontuação ATS - Pontuação multifatorial ponderada (GPS, Telecom, EXIF, Testemunha, Auditoria)",
    qgsqDesc: "Sistema de Grelha QGSQ - Tesselação continental com diferenciação de células urbanas/rurais",
    gpsDesc: "Detecção de Falsificação de GPS - Correlação EXIF-GPS, detecção de movimento impossível",
    witnessDesc: "Sistema de Reputação de Testemunhas - Pontuação ponderada por reputação, detecção de conluio",
    riskAssessment: "AVALIAÇÃO DE RISCO",
    riskCategory: "Categoria de Risco",
    assessment: "Avaliação",
    details: "Detalhes",
    complianceStatus: "Estado de Conformidade",
    sbom: "Lista de Materiais de Software (SBOM) - Completa em formato CycloneDX",
    thirdParty: "Avisos de Terceiros - Avisos abrangentes documentados",
    copyrightHeaders: "Cabeçalhos de Copyright - Aplicados aos ficheiros de código proprietário",
    licenseDocs: "Documentação de Licenças - Todas as licenças de dependências documentadas",
    noConflicts: "Sem conflitos de licença identificados",
    recommendations: "RECOMENDAÇÕES",
    immediate: "Imediato (0-30 dias)",
    shortTerm: "Curto prazo (30-90 dias)",
    longTerm: "Longo prazo (90+ dias)",
    rec1: "Registar marca AFROLOC nas jurisdições principais",
    rec2: "Implementar avisos de copyright em todos os ficheiros",
    rec3: "Rever requisitos de licença comercial do Mapbox",
    rec4: "Estabelecer acordos de cessão de PI para contribuidores",
    rec5: "Implementar verificação automática de licenças no CI/CD",
    rec6: "Criar documentação abrangente de segredos comerciais",
    rec7: "Considerar pedidos de patente para algoritmos principais",
    rec8: "Realizar análise de liberdade de operação",
    rec9: "Estabelecer políticas de proteção de segredos comerciais",
    conclusion: "CONCLUSÃO",
    conclusionText: "O AFROLOC, pertencente à AFROFINTEK GmbH, possui um portfólio de PI limpo e comercialmente viável. O código-fonte utiliza componentes de código aberto padrão da indústria sob licenças permissivas (MIT, Apache 2.0, BSD), sem contaminação copyleft. A lógica de negócio e os algoritmos principais são 100% proprietários.",
    keyStrengths: "Pontos Fortes:",
    strength1: "Sem dependências GPL/AGPL/LGPL",
    strength2: "Propriedade clara dos algoritmos principais",
    strength3: "Uso de terceiros bem documentado",
    strength4: "Cabeçalhos de copyright aplicados aos ficheiros proprietários",
    documentInfo: "INFORMAÇÃO DO DOCUMENTO",
    preparedBy: "Preparado por: AFROFINTEK GmbH - Sistema de Auditoria de PI",
    reviewStatus: "Estado da Revisão: Completo",
    generated: "Gerado: ",
    footer1: "Este documento foi preparado para fins de due diligence de investidores e conformidade regulatória.",
    footer2: "Para análise técnica detalhada, consulte a documentação completa de Auditoria de PI no código-fonte.",
    commercialFriendly: "Compatível comercialmente",
    noneFound: "Nenhuma encontrada",
    tradeSecret: "Segredo Comercial",
    copyleftContamination: "Contaminação Copyleft",
    licenseCompliance: "Conformidade de Licenças",
    thirdPartyClaims: "Reclamações de Terceiros",
    patentRisk: "Risco de Patentes",
    tradeSecretProtection: "Proteção de Segredos Comerciais",
    none: "Nenhuma",
    compliant: "Conforme",
    lowRisk: "Baixo Risco",
    reviewNeeded: "Revisão Necessária",
    moderate: "Moderado",
    noCopyleft: "Sem dependências GPL/AGPL/LGPL",
    allDepsPermissive: "Todas as dependências MIT/Apache/BSD",
    standardStack: "Stack de código aberto padrão",
    priorArt: "Algoritmos geográficos podem ter arte prévia",
    ndaRecommended: "Acordos de NDA/emprego recomendados",
    proprietaryLogic: "Lógica de Negócio Proprietária",
    uiComponents: "Componentes de UI (shadcn/ui)",
    thirdPartyDeps: "Dependências de Terceiros",
    translationFiles: "Ficheiros de Tradução",
    documentation: "Documentação",
    mitModified: "Licença MIT (modificações próprias)",
    openSourceLicensed: "Código Aberto (licenciado)",
  }
};

const IPDocumentationPDF = () => {
  const [generating, setGenerating] = useState<Language | null>(null);

  const generatePDF = async (lang: Language) => {
    setGenerating(lang);
    const t = translations[lang];
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;
      let yPos = 20;

      const addPage = () => {
        doc.addPage();
        yPos = 20;
      };

      const checkPageBreak = (height: number) => {
        if (yPos + height > 270) {
          addPage();
        }
      };

      const addTitle = (text: string, size: number = 16) => {
        checkPageBreak(15);
        doc.setFontSize(size);
        doc.setFont("helvetica", "bold");
        doc.text(text, margin, yPos);
        yPos += size * 0.5 + 5;
      };

      const addSubtitle = (text: string) => {
        checkPageBreak(12);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(text, margin, yPos);
        yPos += 8;
      };

      const addText = (text: string, indent: number = 0) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(text, contentWidth - indent);
        lines.forEach((line: string) => {
          checkPageBreak(6);
          doc.text(line, margin + indent, yPos);
          yPos += 5;
        });
        yPos += 2;
      };

      const addBullet = (text: string) => {
        checkPageBreak(6);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(text, contentWidth - 10);
        doc.text("•", margin + 5, yPos);
        lines.forEach((line: string, idx: number) => {
          doc.text(line, margin + 12, yPos);
          if (idx < lines.length - 1) {
            yPos += 5;
            checkPageBreak(6);
          }
        });
        yPos += 6;
      };

      const addTableRow = (cols: string[], isHeader: boolean = false) => {
        checkPageBreak(8);
        doc.setFontSize(9);
        doc.setFont("helvetica", isHeader ? "bold" : "normal");
        const colWidth = contentWidth / cols.length;
        cols.forEach((col, idx) => {
          const lines = doc.splitTextToSize(col, colWidth - 4);
          doc.text(lines[0] || "", margin + idx * colWidth + 2, yPos);
        });
        yPos += 6;
        if (isHeader) {
          doc.setDrawColor(200);
          doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
          yPos += 2;
        }
      };

      // ========== COVER PAGE ==========
      doc.setFillColor(26, 26, 26);
      doc.rect(0, 0, pageWidth, 60, 'F');
      
      doc.setTextColor(212, 175, 55);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("AFROLOC", pageWidth / 2, 35, { align: "center" });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(t.coverTitle, pageWidth / 2, 48, { align: "center" });
      
      doc.setTextColor(0, 0, 0);
      yPos = 80;
      
      addText(t.preparedFor);
      addText(t.date);
      addText(t.version);
      addText(t.classification);
      addText(t.owner);
      
      yPos += 10;
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;

      // ========== EXECUTIVE SUMMARY ==========
      addTitle(t.executiveSummary, 18);
      yPos += 5;
      
      addSubtitle(t.companyOverview);
      addText(t.companyDescription);
      
      yPos += 5;
      addSubtitle(t.overallRisk);
      addText(t.riskDescription);

      // ========== IP PORTFOLIO ==========
      addPage();
      addTitle(t.ipPortfolio, 16);
      yPos += 5;
      
      addSubtitle(t.coreProprietaryTech);
      const ipAssets = [
        ["Address Trust Score (ATS) Algorithm", t.tradeSecret, "✓ AFROFINTEK GmbH"],
        ["QGSQ Grid System", t.tradeSecret, "✓ AFROFINTEK GmbH"],
        ["GPS Spoofing Detection System", t.tradeSecret, "✓ AFROFINTEK GmbH"],
        ["5-Tier Authorization Framework", t.tradeSecret, "✓ AFROFINTEK GmbH"],
        ["Witness Reputation Scoring", t.tradeSecret, "✓ AFROFINTEK GmbH"],
        ["Address Gateway Service", t.tradeSecret, "✓ AFROFINTEK GmbH"],
        ["Telecom Triangulation Fusion", t.tradeSecret, "✓ AFROFINTEK GmbH"],
        ["Verification Cycle Engine", t.tradeSecret, "✓ AFROFINTEK GmbH"],
      ];
      
      addTableRow([t.ipAsset, t.type, t.status], true);
      ipAssets.forEach(row => addTableRow(row));

      yPos += 10;
      addSubtitle(t.brandAssets);
      addTableRow([t.asset, t.type, t.status], true);
      addTableRow(["AFROLOC", "Brand Name", "© AFROFINTEK GmbH"]);
      addTableRow(["AFROLOC Logo", "Visual Identity", "© AFROFINTEK GmbH"]);

      // ========== DEPENDENCY ANALYSIS ==========
      addPage();
      addTitle(t.dependencyAnalysis, 16);
      yPos += 5;
      
      addText(t.totalDependencies);
      yPos += 3;
      
      const licenses = [
        ["MIT License", "74", "90.2%", `✓ ${t.commercialFriendly}`],
        ["Apache 2.0", "4", "4.9%", `✓ ${t.commercialFriendly}`],
        ["ISC License", "3", "3.7%", `✓ ${t.commercialFriendly}`],
        ["BSD-3-Clause", "1", "1.2%", `✓ ${t.commercialFriendly}`],
        ["GPL/AGPL/LGPL", "0", "0.0%", `✓ ${t.noneFound}`],
      ];
      
      addTableRow([t.license, t.count, t.percentage, t.compatibility], true);
      licenses.forEach(row => addTableRow(row));

      yPos += 10;
      addSubtitle(t.keyFinding);
      addText(t.keyFindingDesc);

      // ========== SOURCE CODE OWNERSHIP ==========
      addPage();
      addTitle(t.sourceCodeOwnership, 16);
      yPos += 5;
      
      const ownership = [
        [t.proprietaryLogic, "89+", "100% AFROFINTEK GmbH"],
        [t.uiComponents, "25", t.mitModified],
        [t.thirdPartyDeps, "82", t.openSourceLicensed],
        [t.translationFiles, "13", "Content © AFROFINTEK GmbH"],
        [t.documentation, "15+", "100% AFROFINTEK GmbH"],
      ];
      
      addTableRow([t.category, t.files, t.ownership], true);
      ownership.forEach(row => addTableRow(row));

      yPos += 10;
      addSubtitle(t.keyAlgorithms);
      
      addBullet(t.atsDesc);
      addBullet(t.qgsqDesc);
      addBullet(t.gpsDesc);
      addBullet(t.witnessDesc);

      // ========== RISK ASSESSMENT ==========
      addPage();
      addTitle(t.riskAssessment, 16);
      yPos += 5;
      
      const risks = [
        [t.copyleftContamination, `✓ ${t.none}`, t.noCopyleft],
        [t.licenseCompliance, `✓ ${t.compliant}`, t.allDepsPermissive],
        [t.thirdPartyClaims, `✓ ${t.lowRisk}`, t.standardStack],
        [t.patentRisk, t.reviewNeeded, t.priorArt],
        [t.tradeSecretProtection, t.moderate, t.ndaRecommended],
      ];
      
      addTableRow([t.riskCategory, t.assessment, t.details], true);
      risks.forEach(row => addTableRow(row));

      // ========== COMPLIANCE STATUS ==========
      yPos += 15;
      addSubtitle(t.complianceStatus);
      
      addBullet(`✓ ${t.sbom}`);
      addBullet(`✓ ${t.thirdParty}`);
      addBullet(`✓ ${t.copyrightHeaders}`);
      addBullet(`✓ ${t.licenseDocs}`);
      addBullet(`✓ ${t.noConflicts}`);

      // ========== RECOMMENDATIONS ==========
      addPage();
      addTitle(t.recommendations, 16);
      yPos += 5;
      
      addSubtitle(t.immediate);
      addBullet(t.rec1);
      addBullet(t.rec2);
      addBullet(t.rec3);

      yPos += 5;
      addSubtitle(t.shortTerm);
      addBullet(t.rec4);
      addBullet(t.rec5);
      addBullet(t.rec6);

      yPos += 5;
      addSubtitle(t.longTerm);
      addBullet(t.rec7);
      addBullet(t.rec8);
      addBullet(t.rec9);

      // ========== CONCLUSION ==========
      yPos += 15;
      addTitle(t.conclusion, 14);
      addText(t.conclusionText);
      
      yPos += 5;
      addSubtitle(t.keyStrengths);
      addBullet(t.strength1);
      addBullet(t.strength2);
      addBullet(t.strength3);
      addBullet(t.strength4);

      // ========== FOOTER ==========
      addPage();
      addTitle(t.documentInfo, 14);
      yPos += 10;
      
      addText(t.preparedBy);
      addText(t.owner);
      addText(t.reviewStatus);
      addText(t.classification);
      addText(t.generated + new Date().toISOString().split('T')[0]);
      
      yPos += 20;
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;
      
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(t.footer1, pageWidth / 2, yPos, { align: "center" });
      yPos += 5;
      doc.text(t.footer2, pageWidth / 2, yPos, { align: "center" });

      // Save the PDF
      const filename = lang === 'pt' 
        ? "AFROLOC_Documentacao_PI.pdf" 
        : "AFROLOC_IP_Documentation.pdf";
      doc.save(filename);
      
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">AFROLOC IP Documentation</h1>
          <p className="text-muted-foreground">
            Download consolidated intellectual property documentation for investors and regulators
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              IP Executive Summary
            </CardTitle>
            <CardDescription>
              Comprehensive intellectual property audit and compliance documentation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                <div className="font-semibold text-green-600">LOW RISK</div>
                <div className="text-xs text-muted-foreground">Overall IP Risk</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                <div className="font-semibold text-green-600">0 GPL</div>
                <div className="text-xs text-muted-foreground">Copyleft Licenses</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <FileText className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                <div className="font-semibold text-blue-600">82</div>
                <div className="text-xs text-muted-foreground">Dependencies</div>
              </div>
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <Shield className="h-8 w-8 mx-auto text-amber-600 mb-2" />
                <div className="font-semibold text-amber-600">8</div>
                <div className="text-xs text-muted-foreground">Trade Secrets</div>
              </div>
            </div>

            {/* Contents */}
            <div className="space-y-3">
              <h3 className="font-semibold">PDF Contents / Conteúdo do PDF:</h3>
              <div className="grid gap-2">
                {[
                  "Executive Summary / Resumo Executivo",
                  "IP Portfolio / Portfólio de PI",
                  "Trade Secrets / Segredos Comerciais",
                  "Dependency Analysis / Análise de Dependências",
                  "Source Code Ownership / Propriedade do Código",
                  "Risk Assessment / Avaliação de Risco",
                  "Compliance Status / Estado de Conformidade",
                  "Recommendations / Recomendações",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                      {idx + 1}
                    </Badge>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Download Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={() => generatePDF('en')} 
                disabled={generating !== null}
                className="w-full"
                size="lg"
              >
                {generating === 'en' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    <Globe className="mr-1 h-4 w-4" />
                    Download English PDF
                  </>
                )}
              </Button>
              
              <Button 
                onClick={() => generatePDF('pt')} 
                disabled={generating !== null}
                className="w-full"
                size="lg"
                variant="secondary"
              >
                {generating === 'pt' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    A gerar...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    <Globe className="mr-1 h-4 w-4" />
                    Descarregar PDF Português
                  </>
                )}
              </Button>
            </div>

            {/* Note */}
            <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <strong>Confidential Document / Documento Confidencial</strong>
                <p className="text-muted-foreground">
                  This document is intended for authorized recipients only, including investors, 
                  legal counsel, and regulatory bodies conducting due diligence.
                </p>
                <p className="text-muted-foreground mt-1">
                  Este documento destina-se apenas a destinatários autorizados, incluindo investidores,
                  assessoria jurídica e entidades reguladoras.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IPDocumentationPDF;
