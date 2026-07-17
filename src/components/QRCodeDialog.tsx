import { useState, useEffect } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Share2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Database } from "@/integrations/supabase/types";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

interface QRCodeDialogProps {
  record: AfrolocRecord;
  trigger?: React.ReactNode;
}

export function QRCodeDialog({ record, trigger }: QRCodeDialogProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (open) {
      generateQRCode();
    }
  }, [open, record]);

  const generateQRCode = async () => {
    try {
      // Criar dados estruturados do AFROLOC para o QR Code
      const qrData = {
        code: record.code,
        country: record.country,
        address: {
          street_name: record.street_name,
          number: record.number,
          unit: record.unit,
          level1: record.level1_name,
          level2: record.level2_name,
          level3: record.level3_name,
          level4: record.level4_name,
        },
        coordinates: {
          lat: record.geo_lat,
          lon: record.geo_lon,
        },
        property_type: record.property_type,
        status: record.status,
      };

      const url = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      setQrCodeUrl(url);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast({
        title: t("error"),
        description: t("qrdialog_error_generate"),
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    if (!qrCodeUrl) return;

    try {
      // Criar um canvas limpo com apenas o QR code
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Configurar o tamanho do canvas (QR code + margem)
      const qrSize = 400;
      const margin = 40;
      canvas.width = qrSize + (margin * 2);
      canvas.height = qrSize + (margin * 2);

      // Fundo branco
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Carregar e desenhar o QR code
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, margin, margin, qrSize, qrSize);
        
        // Converter canvas para blob e fazer download
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `afroloc-${record.code}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          toast({
            title: t("qrdialog_success"),
            description: t("qrdialog_download_success"),
          });
        });
      };
      img.src = qrCodeUrl;
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        title: t("error"),
        description: t("qrdialog_error_download"),
        variant: "destructive",
      });
    }
  };

  // Monta um cartão A6 (105×148 mm): marca + QR + código AFROLOC + endereço.
  const buildCardPdf = (): jsPDF => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(245, 158, 11); // AFROLOC amber
    doc.text("AFROLOC", pageW / 2, 16, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(t("qrdialog_pdf_subtitle"), pageW / 2, 21, { align: "center" });

    const qrSize = 64;
    doc.addImage(qrCodeUrl, "PNG", (pageW - qrSize) / 2, 27, qrSize, qrSize);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 17, 17);
    doc.text(record.code, pageW / 2, 27 + qrSize + 9, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const addrLines = doc.splitTextToSize(getFullAddress(), pageW - 20);
    doc.text(addrLines, pageW / 2, 27 + qrSize + 16, { align: "center" });

    return doc;
  };

  const handleDownloadPdf = () => {
    if (!qrCodeUrl) return;
    try {
      buildCardPdf().save(`afroloc-${record.code}.pdf`);
      toast({ title: t("qrdialog_success"), description: t("qrdialog_download_success") });
    } catch (error) {
      console.error("Error generating PDF card:", error);
      toast({ title: t("error"), description: t("qrdialog_error_download"), variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!qrCodeUrl) return;

    try {
      const doc = buildCardPdf();
      const fileName = `afroloc-${record.code}.pdf`;
      const file = new File([doc.output("blob")], fileName, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `AFROLOC: ${record.code}`,
          text: `${t("qrdialog_share_text_prefix")} ${record.code}`,
          files: [file],
        });
        toast({ title: t("qrdialog_success"), description: t("qrdialog_share_success") });
      } else {
        // Sem partilha de ficheiros (ex.: desktop) — descarrega o PDF em vez de falhar.
        doc.save(fileName);
        toast({ title: t("qrdialog_success"), description: t("qrdialog_download_success") });
      }
    } catch (error) {
      // Utilizador cancelou a partilha nativa — não é erro.
      if ((error as Error)?.name === "AbortError") return;
      console.error("Error sharing card:", error);
      toast({ title: t("error"), description: t("qrdialog_error_share"), variant: "destructive" });
    }
  };

  const getFullAddress = () => {
    // Formato hierárquico angolano: País, Província, Município, Comuna, Bairro, Rua, Número
    const administrativeParts = [
      record.country?.toUpperCase(),  // País (AO)
      record.level1_name,              // Província (Luanda)
      record.level2_name,              // Município (Talatona)
      record.level3_name,              // Comuna
      record.level4_name,              // Bairro (Talatona Centro)
    ].filter(Boolean);

    const addressParts = [
      record.street_name,
      record.number,
      record.unit,
    ].filter(Boolean);

    // Se há partes de endereço, adicionar separadamente
    if (addressParts.length > 0) {
      return `${administrativeParts.join(", ")} - ${addressParts.join(", ")}`;
    }

    return administrativeParts.join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{t("qrdialog_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* QR Code Display */}
          <div className="flex justify-center p-4 bg-white rounded-lg">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          {/* AFROLOC Info */}
          <div className="space-y-2 text-sm">
            <div className="text-center">
              <p className="font-mono font-bold text-lg">{record.code}</p>
              <p className="text-muted-foreground mt-1">{getFullAddress()}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1 gap-2" variant="outline" size="sm">
              <Download className="h-4 w-4" />
              PNG
            </Button>
            <Button onClick={handleDownloadPdf} className="flex-1 gap-2" variant="outline" size="sm">
              <FileText className="h-4 w-4" />
              PDF
            </Button>
            <Button onClick={handleShare} className="flex-1 gap-2" size="sm">
              <Share2 className="h-4 w-4" />
              {t("qrdialog_share")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
