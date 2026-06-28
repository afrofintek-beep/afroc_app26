import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Download, Check, X, Loader2,
  Shield, Users, Zap, Globe
} from "lucide-react";
import afrolocSymbol from "@/assets/afroloc-symbol.png";
import afrolocSymbolGold from "@/assets/afroloc-symbol-gold.png";
import afrolocSymbolTransparent from "@/assets/afroloc-symbol-transparent.png";

import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

export default function BrandGuidelines() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Primary Colors (from v2.0 PDF)
  const primaryColors = [
    { name: "Primary Gold", hex: "#D4A853", hsl: "38 85% 45%", usage: "Main brand color, primary buttons, highlights" },
    { name: "Primary Glow", hex: "#E8C97A", hsl: "38 90% 55%", usage: "Gradients, glow effects, hover states" },
    { name: "Amber Accent", hex: "#F59E0B", hsl: "25 85% 55%", usage: "Alerts, badges, indicators, secondary CTAs" },
  ];

  // Neutral Colors (from v2.0 PDF)
  const neutralColors = [
    { name: "Background Dark", hex: "#1A1814", hsl: "30 15% 6%", usage: "Main background (dark mode)" },
    { name: "Background Light", hex: "#F8F5F0", hsl: "40 30% 96%", usage: "Main background (light mode)" },
    { name: "Foreground Light", hex: "#F5F0E8", hsl: "40 30% 94%", usage: "Main text (dark mode)" },
    { name: "Foreground Dark", hex: "#2D2519", hsl: "30 25% 15%", usage: "Main text (light mode)" },
  ];

  // Brand Values (from v2.0 PDF)
  const brandValues = [
    { 
      icon: Shield, 
      title: "Security", 
      description: "Data and digital identity protection with the highest standards."
    },
    { 
      icon: Users, 
      title: "Inclusion", 
      description: "Accessible addressing for over 1 billion Africans."
    },
    { 
      icon: Zap, 
      title: "Innovation", 
      description: "Cutting-edge technology adapted to local realities."
    },
    { 
      icon: Globe, 
      title: "Sovereignty", 
      description: "African solutions for African challenges."
    },
  ];

  // Typography Scale (from v2.0 PDF)
  const typeScale = [
    { level: "H1", example: "Main Page Titles", size: "48px / 56px" },
    { level: "H2", example: "Section Titles", size: "36px" },
    { level: "H3", example: "Subtitles", size: "24px" },
    { level: "H4", example: "Card Titles", size: "18px" },
    { level: "Body", example: "Paragraph text for content and descriptions.", size: "16px" },
    { level: "Caption", example: "Captions and auxiliary text", size: "14px" },
    { level: "Small", example: "Notes and metadata", size: "12px" },
  ];

  // Tone of Voice (from v2.0 PDF)
  const toneOfVoice = [
    { 
      title: "Professional", 
      description: "Clear, confident and results-oriented communication.",
      example: "AFROLOC offers the definitive solution for digital addressing in Africa."
    },
    { 
      title: "Accessible", 
      description: "Simple language everyone can understand, without unnecessary jargon.",
      example: "Create your unique address in seconds, directly from your phone."
    },
    { 
      title: "Inspiring", 
      description: "Communicate the vision of positive impact and transformation.",
      example: "Together, we are building the future of African digital infrastructure."
    },
    { 
      title: "Empathetic", 
      description: "Demonstrate understanding of user needs and challenges.",
      example: "We know an address can change everything. That is why we simplified the process."
    },
  ];

  // Gradients (from v2.0 PDF)
  const gradients = [
    { name: "Primary Gradient", css: "linear-gradient(135deg, #D4A853, #E07B2C)", usage: "Primary buttons, headers, CTAs" },
    { name: "Gold Glow", css: "linear-gradient(135deg, #D4A853, #E8C97A)", usage: "Highlight effects, premium elements" },
    { name: "Warm Gradient", css: "linear-gradient(135deg, #D4A853, #F59E0B)", usage: "Energy elements, innovation" },
    { name: "Hero Gradient", css: "linear-gradient(135deg, #1A1814 0%, #2A2520 50%, rgba(212, 168, 83, 0.1) 100%)", usage: "Hero sections, special backgrounds" },
  ];

  // Usage Guidelines (from v2.0 PDF)
  const dosItems = [
    "Symbol with text on the right (horizontal version)",
    "Symbol alone with adequate protection space",
    "Adequate contrast on light or dark backgrounds",
    "Original proportions maintained in all applications",
    "Official colors from the brand palette",
    "Application on high-quality materials"
  ];

  const dontsItems = [
    "Do not rotate the symbol",
    "Do not alter brand colors",
    "Do not distort proportions (stretch, compress)",
    "Do not apply unauthorized effects (shadows, outlines)",
    "Do not use on low contrast backgrounds",
    "Do not add elements to the logo",
    "Do not use low resolution versions"
  ];

  // Digital Applications (from v2.0 PDF)
  const digitalApplications = [
    { name: "App Icon", spec: "Symbol with golden gradient background (iOS: 1024px, Android: 512px)" },
    { name: "Favicon", spec: "Simplified version 32x32px and 16x16px" },
    { name: "Header/Navigation", spec: "Symbol + text 'AFROLOC' (max height: 40px)" },
    { name: "Auth Cards", spec: "Centered symbol with elegant shadow" },
    { name: "Social Media", spec: "Square avatar 400x400px with dark background" },
    { name: "Email Signature", spec: "Symbol 40px + inline text" },
    { name: "Loading States", spec: "Symbol with pulse-glow animation" },
  ];

  const loadImageAsBase64 = (src: string): Promise<{ base64: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Use higher resolution for better quality
        const scale = 4;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, img.width, img.height);
          resolve({
            base64: canvas.toDataURL("image/png", 1.0),
            width: img.width,
            height: img.height
          });
        } else {
          reject(new Error("Could not get canvas context"));
        }
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      // Load logo as high-quality base64 with original dimensions
      let logoData: { base64: string; width: number; height: number } | null = null;
      try {
        logoData = await loadImageAsBase64(afrolocSymbolGold);
      } catch (e) {
        console.warn("Could not load logo:", e);
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: false // Disable compression for better quality
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };

      // Helper to calculate proportional dimensions
      const getProportionalSize = (originalWidth: number, originalHeight: number, maxSize: number) => {
        const aspectRatio = originalWidth / originalHeight;
        if (aspectRatio >= 1) {
          return { width: maxSize, height: maxSize / aspectRatio };
        } else {
          return { width: maxSize * aspectRatio, height: maxSize };
        }
      };

      // Page 1 - Cover
      doc.setFillColor(26, 24, 20); // #1A1814
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      if (logoData) {
        const { width: logoWidth, height: logoHeight } = getProportionalSize(logoData.width, logoData.height, 50);
        doc.addImage(logoData.base64, 'PNG', (pageWidth - logoWidth) / 2, 50, logoWidth, logoHeight, undefined, 'FAST');
      }
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(42);
      doc.setFont("helvetica", "bold");
      doc.text("AFROLOC", pageWidth / 2, 125, { align: "center" });
      
      doc.setFontSize(24);
      doc.setFont("helvetica", "normal");
      doc.text("BRAND BOOK", pageWidth / 2, 140, { align: "center" });
      
      doc.setFontSize(14);
      doc.text("Visual Identity Manual", pageWidth / 2, 160, { align: "center" });
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(11);
      doc.text("Version 2.0 - Official", pageWidth / 2, 180, { align: "center" });
      
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      doc.setFontSize(10);
      doc.text(`Generated on: ${today}`, pageWidth / 2, 195, { align: "center" });

      // Page 2 - Table of Contents
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text("Table of Contents", margin, 40);
      
      const tocItems = [
        { num: "1", title: "Introduction and Mission", page: "3" },
        { num: "2", title: "Brand Values", page: "4" },
        { num: "3", title: "Logo and Symbol", page: "5" },
        { num: "4", title: "Color Palette", page: "6" },
        { num: "5", title: "Typography", page: "7" },
        { num: "6", title: "Tone of Voice", page: "8" },
        { num: "7", title: "Gradients", page: "9" },
        { num: "8", title: "Correct and Incorrect Uses", page: "10" },
        { num: "9", title: "Digital Applications", page: "11" },
      ];
      
      yPos = 70;
      tocItems.forEach((item) => {
        doc.setTextColor(212, 168, 83);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`${item.num}. ${item.title}`, margin, yPos);
        doc.text(item.page, pageWidth - margin, yPos, { align: "right" });
        yPos += 15;
      });

      // Page 3 - Introduction and Mission
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("1. Introduction and Mission", margin, 35);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const introText = "This Brand Book establishes the official guidelines for the correct use of the AFROLOC visual identity. Compliance with these standards is essential to ensure consistency and brand recognition in all applications.";
      const introLines = doc.splitTextToSize(introText, pageWidth - 2 * margin);
      doc.text(introLines, margin, 50);
      
      // Mission section
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Mission", margin, 85);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const missionText = "Democratizing access to secure and verifiable digital addresses for every African citizen, promoting financial, social and economic inclusion through innovative technology.";
      const missionLines = doc.splitTextToSize(missionText, pageWidth - 2 * margin);
      doc.text(missionLines, margin, 100);
      
      // Vision section
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Vision", margin, 135);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const visionText = "To be the leading digital addressing platform for the African continent, connecting over 1 billion people to opportunities through secure and verifiable location identities.";
      const visionLines = doc.splitTextToSize(visionText, pageWidth - 2 * margin);
      doc.text(visionLines, margin, 150);

      // Page 4 - Brand Values
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("2. Brand Values", margin, 35);
      
      yPos = 55;
      brandValues.forEach((value) => {
        doc.setTextColor(212, 168, 83);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(value.title, margin, yPos);
        
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(value.description, margin, yPos + 12);
        yPos += 40;
      });

      // Page 5 - Logo and Symbol
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("3. Logo and Symbol", margin, 35);
      
      // 3.1 Main Version
      doc.setFontSize(14);
      doc.text("3.1 Main Version (Horizontal)", margin, 55);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Preferred version: symbol on the left + 'AFROLOC' text on the right", margin, 68);
      
      if (logoData) {
        const { width: smallLogoW, height: smallLogoH } = getProportionalSize(logoData.width, logoData.height, 30);
        doc.addImage(logoData.base64, 'PNG', margin, 78, smallLogoW, smallLogoH, undefined, 'FAST');
      }
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("AFROLOC", margin + 40, 98);
      
      // 3.2 Protection Area
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(14);
      doc.text("3.2 Protection Area", margin, 130);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Minimum protection area: X = 1/4 of the symbol height", margin, 143);
      
      // 3.3 Minimum Sizes
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("3.3 Minimum Sizes", margin, 165);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("• Digital: 64px (recommended)", margin, 180);
      doc.text("• App: 48px", margin, 192);
      doc.text("• Minimum digital: 32px", margin, 204);
      doc.text("• Favicon: 24px", margin, 216);

      // Page 6 - Color Palette
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("4. Color Palette", margin, 35);
      
      // 4.1 Primary Colors
      doc.setFontSize(14);
      doc.text("4.1 Primary Colors", margin, 55);
      
      yPos = 65;
      primaryColors.forEach((color) => {
        const rgb = hexToRgb(color.hex);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.roundedRect(margin, yPos, 30, 20, 2, 2, 'F');
        
        doc.setTextColor(212, 168, 83);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(color.name, margin + 38, yPos + 8);
        
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`HEX: ${color.hex} | HSL: ${color.hsl}`, margin + 38, yPos + 16);
        yPos += 28;
      });
      
      // 4.2 Neutral Colors
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("4.2 Neutral Colors", margin, yPos + 10);
      
      yPos += 20;
      neutralColors.forEach((color) => {
        const rgb = hexToRgb(color.hex);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.setDrawColor(80, 80, 80);
        doc.roundedRect(margin, yPos, 30, 20, 2, 2, 'FD');
        
        doc.setTextColor(212, 168, 83);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(color.name, margin + 38, yPos + 8);
        
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`HEX: ${color.hex} | ${color.usage}`, margin + 38, yPos + 16);
        yPos += 28;
      });

      // Page 7 - Typography
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("5. Typography", margin, 35);
      
      // 5.1 Display Font
      doc.setFontSize(14);
      doc.text("5.1 Display Font", margin, 55);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Playfair Display - Used for titles, headlines and prominent elements.", margin, 68);
      doc.text("• Bold (700) - Main titles", margin, 82);
      doc.text("• Semibold (600) - Subtitles", margin, 94);
      doc.text("• Regular (400) - Decorative text", margin, 106);
      
      // 5.2 Body Font
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("5.2 Body Font", margin, 128);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Inter - Used for body text, paragraphs and interface.", margin, 141);
      doc.text("• Bold (700) - Strong emphasis, important labels", margin, 155);
      doc.text("• Semibold (600) - Labels, buttons", margin, 167);
      doc.text("• Medium (500) - Highlighted text", margin, 179);
      doc.text("• Regular (400) - Body text", margin, 191);
      
      // 5.3 Type Hierarchy
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("5.3 Typographic Hierarchy", margin, 213);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      typeScale.forEach((item, i) => {
        doc.text(`• ${item.level} - ${item.size} - ${item.example}`, margin, 226 + i * 10);
      });

      // Page 8 - Tone of Voice
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("6. Tone of Voice", margin, 35);
      
      yPos = 55;
      toneOfVoice.forEach((item) => {
        doc.setTextColor(212, 168, 83);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(item.title, margin, yPos);
        
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(item.description, margin, yPos + 12);
        
        doc.setTextColor(212, 168, 83);
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        const exampleLines = doc.splitTextToSize(`"${item.example}"`, pageWidth - 2 * margin);
        doc.text(exampleLines, margin, yPos + 24);
        yPos += 50;
      });

      // Page 9 - Gradients
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("7. Gradients", margin, 35);
      
      yPos = 55;
      gradients.forEach((gradient) => {
        doc.setTextColor(212, 168, 83);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(gradient.name, margin, yPos);
        
        // Draw gradient rectangle (solid color approximation)
        doc.setFillColor(212, 168, 83);
        doc.roundedRect(margin, yPos + 5, pageWidth - 2 * margin, 20, 2, 2, 'F');
        
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`CSS: ${gradient.css}`, margin, yPos + 33);
        doc.text(`Usage: ${gradient.usage}`, margin, yPos + 43);
        yPos += 58;
      });

      // Page 10 - Correct and Incorrect Uses
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("8. Correct and Incorrect Uses", margin, 35);
      
      // Correct Uses
      doc.setFillColor(34, 197, 94);
      doc.circle(margin + 5, 55, 4, 'F');
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Correct Uses", margin + 15, 58);
      
      yPos = 72;
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      dosItems.forEach((item) => {
        doc.text(`• ${item}`, margin, yPos);
        yPos += 12;
      });
      
      // Incorrect Uses
      doc.setFillColor(239, 68, 68);
      doc.circle(margin + 5, yPos + 15, 4, 'F');
      doc.setTextColor(239, 68, 68);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Incorrect Uses", margin + 15, yPos + 18);
      
      yPos += 32;
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      dontsItems.forEach((item) => {
        doc.text(`• ${item}`, margin, yPos);
        yPos += 12;
      });

      // Page 11 - Digital Applications
      doc.addPage();
      doc.setFillColor(26, 24, 20);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("9. Digital Applications", margin, 35);
      
      yPos = 55;
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      digitalApplications.forEach((app) => {
        doc.setTextColor(212, 168, 83);
        doc.setFont("helvetica", "bold");
        doc.text(`• ${app.name}`, margin, yPos);
        doc.setTextColor(150, 150, 150);
        doc.setFont("helvetica", "normal");
        doc.text(` - ${app.spec}`, margin + 35, yPos);
        yPos += 14;
      });
      
      // Email Signature
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Email Signature", margin, yPos + 20);
      
      doc.setDrawColor(212, 168, 83);
      doc.roundedRect(margin, yPos + 28, pageWidth - 2 * margin, 50, 3, 3, 'S');
      
      doc.setTextColor(212, 168, 83);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Full Name | Title", margin + 10, yPos + 42);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("AFROLOC - Digital Addressing System of Africa", margin + 10, yPos + 54);
      doc.text("email@afroloc.app | www.afroloc.app", margin + 10, yPos + 66);
      
      // Footer
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(9);
      doc.text("© 2025 AFROLOC. All rights reserved.", pageWidth / 2, pageHeight - 15, { align: "center" });

      doc.save("AFROLOC-Brand-Book-v2.0-EN.pdf");

      toast({
        title: "PDF Generated",
        description: "The Brand Book was downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Could not generate the PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09101A]" ref={contentRef}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-[#09101A]/95 backdrop-blur supports-[backdrop-filter]:bg-[#09101A]/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-primary hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">AFROLOC</span>
          </Button>

          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Button
              onClick={generatePDF}
              disabled={isGenerating}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
            {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Page 1: Cover */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <Badge variant="outline" className="mb-10 border-primary/30 text-muted-foreground text-sm px-4 py-1">
          Version 2.0 • Official
        </Badge>
        
        <img 
          src={afrolocSymbol} 
          alt="Afroloc" 
          className="h-32 w-32 md:h-40 md:w-40 object-cover rounded-lg shadow-md ring-1 ring-primary/20 mb-12" 
        />
        
        <h1 className="text-7xl md:text-9xl lg:text-[10rem] font-bold text-primary mb-6 tracking-tight drop-shadow-lg">
          AFROLOC
        </h1>
        
        <h2 className="text-3xl md:text-4xl lg:text-5xl text-primary/80 mb-3 font-light">Brand Guidelines</h2>
        
        <p className="text-muted-foreground text-base md:text-lg tracking-[0.4em] mb-16">VERSION 2.0</p>
        
        <div className="h-1 w-32 bg-gradient-to-r from-transparent via-primary to-transparent mb-10" />
        
        <p className="text-primary/90 text-center max-w-2xl mb-3 text-xl md:text-2xl font-light leading-relaxed">
          Pioneering the future of African addressing through innovative digital solutions.
        </p>
        <p className="text-muted-foreground text-center max-w-2xl text-lg md:text-xl">
          Building bridges between traditional methods and digital transformation.
        </p>
      </section>

      {/* Page 2: Introduction & Mission */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Introduction & Mission</h2>
          <p className="text-muted-foreground mb-12">This Brand Book establishes the official guidelines for the correct use of the AFROLOC visual identity.</p>
          
          <div className="border border-primary/30 rounded-xl p-8 md:p-12 mb-8">
            <h3 className="text-xl font-bold text-primary mb-4">Mission</h3>
            <p className="text-lg text-primary/90 leading-relaxed mb-6">
              Democratizing access to secure and verifiable digital addresses for every African citizen, 
              promoting financial, social and economic inclusion through innovative technology.
            </p>
          </div>
          
          <div className="border border-primary/30 rounded-xl p-8 md:p-12">
            <h3 className="text-xl font-bold text-primary mb-4">Vision</h3>
            <p className="text-lg text-primary/90 leading-relaxed">
              To be the leading digital addressing platform for the African continent, connecting over 1 billion people 
              to opportunities through secure and verifiable location identities.
            </p>
          </div>
        </div>
      </section>

      {/* Page 3: Brand Values */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Brand Values</h2>
          <p className="text-muted-foreground mb-12">The principles that guide everything we do</p>
          
          <div className="grid md:grid-cols-2 gap-6">
            {brandValues.map((value, index) => (
              <div key={index} className="border border-primary/30 rounded-xl p-6 hover:border-primary/60 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-primary mb-2">{value.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Page 4: Logo */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-4xl md:text-6xl font-bold text-primary mb-4">Logo</h2>
          <p className="text-muted-foreground text-lg mb-16">The Afroloc emblem represents location, security and African connection</p>
          
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* Primary Logo */}
            <div className="border border-primary/30 rounded-2xl p-10 flex flex-col items-center bg-[#0F1620]">
              <img 
                src={afrolocSymbol} 
                alt="Afroloc" 
                className="h-24 w-24 md:h-32 md:w-32 object-cover rounded-lg shadow-md ring-1 ring-primary/20 mb-8" 
              />
              <h3 className="text-3xl md:text-4xl font-bold text-primary mb-8 tracking-wide">AFROLOC</h3>
              <p className="text-muted-foreground">Primary Logo - Dark Background</p>
            </div>
            
            {/* Clear Space */}
            <div className="border border-primary/30 rounded-2xl p-10 flex flex-col items-center bg-[#0F1620]">
              <div className="border-2 border-dashed border-primary/40 p-8 rounded-xl mb-8">
                <img 
                  src={afrolocSymbolGold} 
                  alt="Afroloc" 
                  className="h-20 w-20 md:h-24 md:w-24 object-cover rounded-lg opacity-80" 
                />
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold text-primary/60 mb-8 tracking-wide">AFROLOC</h3>
              <p className="text-muted-foreground">Minimum Clear Space</p>
            </div>
          </div>
          
          {/* Logo Variations */}
          <div className="border border-primary/30 rounded-2xl p-8 bg-[#0F1620]">
            <h3 className="text-xl font-bold text-primary mb-8">Logo Variations</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {["Full Color", "Monochrome", "Reversed", "On Gradient"].map((variation, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className={`w-full aspect-square rounded-xl flex items-center justify-center mb-4 ${
                    index === 2 ? "bg-primary shadow-xl shadow-primary/30" : index === 3 ? "bg-gradient-to-br from-primary to-amber-600 shadow-xl shadow-primary/30" : "bg-[#181E27] border border-primary/20"
                  }`}>
                    <div className="text-center p-4">
                      <img 
                        src={index === 2 ? afrolocSymbol : afrolocSymbolGold} 
                        alt="" 
                        className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-3 object-cover rounded-lg shadow-md ring-1 ring-primary/20" 
                      />
                      <span className={`text-sm md:text-base font-bold ${index === 2 ? "text-[#0F1620]" : "text-primary"}`}>AFROLOC</span>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">{variation}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Page 5: Color Palette */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Color Palette</h2>
          <p className="text-muted-foreground mb-12">A sophisticated palette combining deep navy with rich golden accents</p>
          
          {/* Primary Colors */}
          <div className="mb-10">
            <h3 className="text-lg font-bold text-primary mb-4">Primary Colors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {primaryColors.map((color, index) => (
                <div key={index}>
                  <div 
                    className="aspect-[4/3] rounded-xl mb-3 shadow-lg"
                    style={{ backgroundColor: color.hex }}
                  />
                  <p className="text-sm font-semibold text-primary">{color.name}</p>
                  <p className="text-xs text-muted-foreground mb-1">{color.hex} • HSL: {color.hsl}</p>
                  <p className="text-xs text-muted-foreground">{color.usage}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Neutral Colors */}
          <div className="mb-10">
            <h3 className="text-lg font-bold text-primary mb-4">Neutral Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {neutralColors.map((color, index) => (
                <div key={index}>
                  <div 
                    className="aspect-[4/3] rounded-xl mb-3 border border-primary/20"
                    style={{ backgroundColor: color.hex }}
                  />
                  <p className="text-sm font-semibold text-primary">{color.name}</p>
                  <p className="text-xs text-muted-foreground">{color.hex}</p>
                  <p className="text-xs text-muted-foreground">{color.usage}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Brand Gradients */}
          <div>
            <h3 className="text-lg font-bold text-primary mb-4">Brand Gradients</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {gradients.slice(0, 2).map((gradient, index) => (
                <div key={index}>
                  <div 
                    className="h-24 rounded-xl mb-3 shadow-lg"
                    style={{ background: gradient.css }}
                  />
                  <p className="text-sm font-semibold text-primary">{gradient.name}</p>
                  <p className="text-xs text-muted-foreground">{gradient.usage}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Page 6: Typography */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Typography</h2>
          <p className="text-muted-foreground mb-12">A modern typographic system that balances authority with accessibility</p>
          
          {/* Display Font */}
          <div className="border border-primary/30 rounded-xl p-8 mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider mb-2">DISPLAY FONT</p>
                <h3 className="text-2xl font-bold text-primary">Space Grotesk</h3>
              </div>
              <span className="text-sm text-primary/60">Headlines & Titles</span>
            </div>
            
            <p className="text-6xl font-bold text-primary mb-6">Aa</p>
            <p className="text-primary mb-2 tracking-wide">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            <p className="text-primary/80 mb-4">abcdefghijklmnopqrstuvwxyz</p>
            <p className="text-primary/60">0123456789</p>
            
            <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-primary/20">
              {["Regular", "Medium", "SemiBold", "Bold"].map((weight, i) => (
                <div key={weight} className="text-center">
                  <p className="text-primary text-sm" style={{ fontWeight: [400, 500, 600, 700][i] }}>{weight}</p>
                  <p className="text-xs text-muted-foreground">{[400, 500, 600, 700][i]}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Type Scale */}
          <div className="border border-primary/30 rounded-xl p-8">
            <h3 className="text-lg font-bold text-primary mb-6">Type Scale</h3>
            <div className="space-y-6">
              {typeScale.map((item, index) => (
                <div key={index} className="flex items-baseline gap-6 border-b border-primary/10 pb-4 last:border-0">
                  <span className="text-xs text-muted-foreground w-16">{item.level}</span>
                  <span className={`text-primary flex-1 ${
                    item.level === "Display" ? "text-3xl font-bold" :
                    item.level === "H1" ? "text-2xl font-bold" :
                    item.level === "H2" ? "text-xl font-semibold" :
                    item.level === "H3" ? "text-lg font-semibold" :
                    item.level === "Body" ? "text-sm" : "text-xs text-muted-foreground"
                  }`}>
                    {item.example}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Page 7: Tone of Voice */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Tone of Voice</h2>
          <p className="text-muted-foreground mb-12">How we communicate with our audience</p>
          
          <div className="grid md:grid-cols-2 gap-6">
            {toneOfVoice.map((item, index) => (
              <div key={index} className="border border-primary/30 rounded-xl p-6 hover:border-primary/60 transition-colors">
                <h3 className="text-lg font-bold text-primary mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{item.description}</p>
                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="text-primary/90 text-sm italic">"{item.example}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Page 8: Usage Guidelines */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Usage Guidelines</h2>
          <p className="text-muted-foreground mb-12">Correct and incorrect uses of the brand</p>
          
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Do's */}
            <div className="border border-primary/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-green-500">Correct Uses</h3>
              </div>
              <ul className="space-y-3">
                {dosItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-muted-foreground text-sm">
                    <span className="text-green-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Don'ts */}
            <div className="border border-primary/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <X className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-red-500">Incorrect Uses</h3>
              </div>
              <ul className="space-y-3">
                {dontsItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-muted-foreground text-sm">
                    <span className="text-red-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Page 9: Digital Applications */}
      <section className="min-h-screen px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4">Digital Applications</h2>
          <p className="text-muted-foreground mb-12">How to apply the brand across digital touchpoints</p>
          
          <div className="grid md:grid-cols-2 gap-4 mb-12">
            {digitalApplications.map((app, index) => (
              <div key={index} className="border border-primary/30 rounded-xl p-5 hover:border-primary/60 transition-colors">
                <h3 className="text-base font-bold text-primary mb-2">{app.name}</h3>
                <p className="text-muted-foreground text-sm">{app.spec}</p>
              </div>
            ))}
          </div>
          
          {/* Email Signature */}
          <div className="border border-primary/30 rounded-xl p-8 bg-[#0F1620]">
            <h3 className="text-lg font-bold text-primary mb-6">Email Signature</h3>
            <div className="bg-[#1A1814] rounded-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <img 
                  src={afrolocSymbol} 
                  alt="Afroloc" 
                  className="h-10 w-10 object-cover rounded-lg shadow-md ring-1 ring-primary/20" 
                />
                <div>
                  <p className="text-primary font-semibold">Full Name | Title</p>
                  <p className="text-muted-foreground text-sm">AFROLOC - Digital Addressing System of Africa</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">email@afroloc.app | www.afroloc.app</p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="text-center pt-16 mt-12 border-t border-primary/20">
            <p className="text-primary font-semibold mb-2">© 2025 AFROLOC. All rights reserved.</p>
            <p className="text-muted-foreground text-sm">Brand Guidelines v2.0 • For internal use and approved partners</p>
          </div>
        </div>
      </section>
    </div>
  );
}
