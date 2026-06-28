import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileImage, TrendingDown, Maximize2 } from "lucide-react";

interface Props {
  originalSize: number; // bytes
  compressedSize: number; // bytes
  width: number;
  height: number;
  compressionRatio: number; // percentage
}

export function ImageCompressionStats({ 
  originalSize, 
  compressedSize, 
  width, 
  height, 
  compressionRatio 
}: Props) {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Card className="border-dashed bg-muted/30">
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <FileImage className="h-3 w-3" />
              <p className="text-xs font-medium">Size</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground line-through">
                {formatSize(originalSize)}
              </p>
              <Badge variant="secondary" className="text-xs font-mono">
                {formatSize(compressedSize)}
              </Badge>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <TrendingDown className="h-3 w-3" />
              <p className="text-xs font-medium">Saved</p>
            </div>
            <Badge variant="default" className="text-xs">
              {compressionRatio.toFixed(0)}%
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Maximize2 className="h-3 w-3" />
              <p className="text-xs font-medium">Size</p>
            </div>
            <p className="text-xs font-mono font-medium">
              {width}×{height}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Optimization:</span>
            <Badge variant="outline" className="text-xs">
              {compressionRatio > 60 ? '🟢 Excellent' : compressionRatio > 40 ? '🟡 Good' : '🔴 Minimal'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
