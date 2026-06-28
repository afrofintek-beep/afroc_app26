import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  photo: string;
  witnessName?: string;
  witnessAfroId: string;
}

export function WitnessPhotoViewer({ open, onClose, photo, witnessName, witnessAfroId }: Props) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo;
    link.download = `witness-${witnessAfroId}-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Witness ID Photo</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Witness AFROLOC:</p>
            <code className="text-sm font-mono">{witnessAfroId}</code>
          </div>
          
          {witnessName && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Name:</p>
              <p className="text-sm">{witnessName}</p>
            </div>
          )}
          
          <div className="border rounded-md overflow-hidden bg-muted">
            <img 
              src={photo} 
              alt="Witness ID Document" 
              className="w-full h-auto max-h-[500px] object-contain"
            />
          </div>
          
          <Button onClick={handleDownload} variant="outline" className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download Photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
