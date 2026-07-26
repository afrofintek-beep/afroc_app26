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
        // PRIVACIDADE DO QR: o QR/cartão contém de propósito o endereço humano
        // legível (província/município/comuna/rua/número) para apps parceiras
        // como a Yamioo, mas NUNCA coordenadas GPS (lat/lon). As coordenadas
        // são excluídas por política. [[afroloc-copy-no-coordinates]]
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

  // Desenha o cartão A6 inteiro (marca + QR + código + endereço) num <canvas>.
  //
  // Rota escolhida: imagem-de-canvas em vez da fonte Helvetica embutida do jsPDF.
  // O texto do browser (canvas) é Unicode-safe, por isso nomes de lugares com
  // acentos — "São Tomé", "Ingombota", "Água Grande" — são desenhados
  // corretamente sem embutir qualquer binário de fonte TTF no bundle.
  //
  // PRIVACIDADE (QR + cartão): tanto o QR como o cartão contêm de propósito o
  // endereço humano legível (país/província/município/comuna/bairro/rua/nº) —
  // é isso que apps parceiras como a Yamioo precisam de ler. Mas NUNCA incluem
  // coordenadas GPS (lat/lon). As coordenadas são excluídas por política.
  // [[afroloc-copy-no-coordinates]]
  const renderCardCanvas = (): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      // A6 = 105 × 148 mm. Renderiza a 8 px/mm para ficar nítido no PDF.
      const pxPerMm = 8;
      const mmW = 105;
      const mmH = 148;
      const canvas = document.createElement("canvas");
      canvas.width = mmW * pxPerMm; // 840
      canvas.height = mmH * pxPerMm; // 1184
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      const cx = canvas.width / 2;

      // Fundo branco.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      // Marca AFROLOC.
      ctx.fillStyle = "#f59e0b"; // AFROLOC amber
      ctx.font = "bold 56px Helvetica, Arial, sans-serif";
      ctx.fillText("AFROLOC", cx, 130);

      // Subtítulo.
      ctx.fillStyle = "#787878";
      ctx.font = "22px Helvetica, Arial, sans-serif";
      ctx.fillText(t("qrdialog_pdf_subtitle"), cx, 168);

      const drawRest = (qrImg?: HTMLImageElement) => {
        // QR (opcional — se falhar a carregar, o cartão continua utilizável).
        const qrPx = 512;
        const qrY = 200;
        if (qrImg) {
          ctx.drawImage(qrImg, cx - qrPx / 2, qrY, qrPx, qrPx);
        }

        // Código AFROLOC.
        let y = qrY + qrPx + 70;
        ctx.fillStyle = "#111111";
        ctx.font = "bold 40px Helvetica, Arial, sans-serif";
        ctx.fillText(record.code, cx, y);

        // Endereço legível: quebra por palavras, limita nº de linhas e usa
        // reticências para nunca transbordar a página A6 nem tocar no QR/código.
        y += 46;
        const maxWidth = canvas.width - 120; // margens de ~7.5 mm de cada lado
        const lineHeight = 34;
        const bottomLimit = canvas.height - 40; // não ultrapassar o fundo
        const maxLines = Math.max(1, Math.floor((bottomLimit - y) / lineHeight));

        ctx.fillStyle = "#505050";
        ctx.font = "26px Helvetica, Arial, sans-serif";

        const words = getFullAddress().split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = "";
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);

        // Clampa ao nº de linhas que cabem e ellipsiza a última.
        if (lines.length > maxLines) {
          lines.length = maxLines;
          let last = lines[maxLines - 1];
          while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
            last = last.slice(0, -1);
          }
          lines[maxLines - 1] = `${last}…`;
        }

        lines.forEach((line, i) => {
          ctx.fillText(line, cx, y + i * lineHeight);
        });

        resolve(canvas);
      };

      if (!qrCodeUrl) {
        drawRest();
        return;
      }
      const qrImg = new Image();
      qrImg.onload = () => drawRest(qrImg);
      qrImg.onerror = () => drawRest(); // desenha o cartão sem QR em vez de falhar
      qrImg.src = qrCodeUrl;
    });
  };

  // Monta um cartão A6 (105×148 mm) colocando a imagem do canvas na página PDF.
  const buildCardPdf = async (): Promise<jsPDF> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const canvas = await renderCardCanvas();
    // Texto desenhado no canvas (Unicode-safe) → imagem → página A6 completa.
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageW, pageH);
    return doc;
  };

  const handleDownloadPdf = async () => {
    if (!qrCodeUrl) return;
    try {
      const doc = await buildCardPdf();
      doc.save(`afroloc-${record.code}.pdf`);
      toast({ title: t("qrdialog_success"), description: t("qrdialog_download_success") });
    } catch (error) {
      console.error("Error generating PDF card:", error);
      toast({ title: t("error"), description: t("qrdialog_error_download"), variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!qrCodeUrl) return;

    try {
      const doc = await buildCardPdf();
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
