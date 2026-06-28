import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, Download, Share2 } from "lucide-react";
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
        description: "Erro ao gerar código QR",
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
          link.download = `afroid-${record.code}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          toast({
            title: "Sucesso",
            description: "Código QR baixado com sucesso",
          });
        });
      };
      img.src = qrCodeUrl;
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        title: t("error"),
        description: "Erro ao baixar código QR",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!qrCodeUrl) return;

    try {
      // Converter data URL para blob
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const file = new File([blob], `afroid-${record.code}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `AFROLOC: ${record.code}`,
          text: `Morada AFROLOC: ${record.code}`,
          files: [file],
        });

        toast({
          title: "Sucesso",
          description: "Código QR compartilhado com sucesso",
        });
      } else {
        // Fallback: copiar para clipboard
        await navigator.clipboard.writeText(qrCodeUrl);
        toast({
          title: "Copiado",
          description: "Imagem do QR code copiada para área de transferência",
        });
      }
    } catch (error) {
      console.error("Error sharing QR code:", error);
      toast({
        title: t("error"),
        description: "Erro ao compartilhar código QR",
        variant: "destructive",
      });
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
          <DialogTitle className="text-center">Código QR da Morada</DialogTitle>
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
            <Button onClick={handleDownload} className="flex-1 gap-2" variant="outline">
              <Download className="h-4 w-4" />
              Baixar
            </Button>
            <Button onClick={handleShare} className="flex-1 gap-2">
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
