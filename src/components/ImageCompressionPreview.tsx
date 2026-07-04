import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Check, X, Zap, Image } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { CompressionResult } from '@/utils/imageCompression';
import { compressImageInWorker, type WorkerCompressionResult } from '@/utils/imageCompressionWorker';
import { ImageCompressionStats } from './ImageCompressionStats';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useExifExtractor, ExifData } from '@/hooks/useExifExtractor';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  open: boolean;
  originalImage: string;
  onSave: (compressedImage: string, stats: CompressionResult, exifData: ExifData | null) => void;
  onCancel: () => void;
  /**
   * 'blobUrl' is best for UI responsiveness (default).
   * 'base64' is useful when you need to persist the image offline.
   */
  outputFormat?: 'blobUrl' | 'base64';
}

type ResolutionMode = 'fast' | 'high';

export function ImageCompressionPreview({ open, originalImage, onSave, onCancel, outputFormat = 'blobUrl' }: Props) {
  const { t } = useLanguage();
  const [quality, setQuality] = useState(85);
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('fast');
  const [compressing, setCompressing] = useState(false);
  const [compressionResult, setCompressionResult] = useState<WorkerCompressionResult | null>(null);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [exifExtracted, setExifExtracted] = useState(false);
  const abortRef = useRef(false);
  const initializedRef = useRef(false);

  const { extractExifData } = useExifExtractor();

  const maxResolution = resolutionMode === 'high' ? 1920 : 1280;

  // Extract EXIF data from original image BEFORE compression
  useEffect(() => {
    if (!open || !originalImage || exifExtracted) return;
    
    // Extract EXIF from original image (before any compression)
    const extractExif = async () => {
      try {
        console.log('[EXIF] Starting extraction from original image...');
        console.log('[EXIF] Image data length:', originalImage.length);
        console.log('[EXIF] Image starts with:', originalImage.substring(0, 50));
        
        const exif = await extractExifData(originalImage);
        setExifData(exif);
        setExifExtracted(true);
        
        if (exif) {
          console.log('[EXIF] Extraction successful:', {
            hasGPS: !!(exif.latitude && exif.longitude),
            lat: exif.latitude,
            lon: exif.longitude,
            device: exif.deviceMake,
            model: exif.deviceModel,
            timestamp: exif.timestamp
          });
        } else {
          console.log('[EXIF] No EXIF data found in image');
        }
      } catch (error) {
        console.error('[EXIF] Extraction failed:', error);
        setExifExtracted(true); // Mark as done even on failure
      }
    };
    
    extractExif();
  }, [open, originalImage, exifExtracted, extractExifData]);

  // IMPORTANT: do NOT generate a "quick preview" from base64 here.
  // Base64 decoding (atob) on large images can freeze the browser.
  // We'll simply display the original image until compression finishes.
  useEffect(() => {
    if (!open) return;
    abortRef.current = false;
    return () => {
      abortRef.current = true;
    };
  }, [open]);

  // Revoke previous blob URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewImage?.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      abortRef.current = false;
      if (previewImage?.startsWith('blob:')) {
        URL.revokeObjectURL(previewImage);
      }
      setPreviewImage('');
      setCompressionResult(null);
      setProgress(0);
      setExifData(null);
      setExifExtracted(false);
    }
  }, [open, previewImage]);

  const performCompression = useCallback(async (qualityValue: number, maxSize: number) => {
    if (!originalImage) return;

    abortRef.current = false;
    setCompressing(true);
    setProgress(10);

    // Use requestAnimationFrame for smooth progress updates
    let animationId: number;
    let currentProgress = 10;

    const animateProgress = () => {
      if (abortRef.current) return;
      if (currentProgress < 85) {
        currentProgress += 2;
        setProgress(currentProgress);
        animationId = requestAnimationFrame(animateProgress);
      }
    };

    // Start progress animation after a small delay to let UI render
    const animationTimeout = setTimeout(() => {
      animationId = requestAnimationFrame(animateProgress);
    }, 50);

    try {
      // Defer compression to next tick to allow UI to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (abortRef.current) return;

      const result = await compressImageInWorker(
        originalImage,
        {
          maxWidth: maxSize,
          maxHeight: maxSize,
          quality: qualityValue / 100,
          format: 'jpeg',
        },
        {
          // Avoid heavy base64 conversion unless explicitly needed
          returnBase64: outputFormat === 'base64',
        }
      );

      cancelAnimationFrame(animationId);
      clearTimeout(animationTimeout);

      if (abortRef.current) return;

      setProgress(100);
      setCompressionResult(result);

      // Use the object URL for UI preview (very cheap for the browser to render)
      setPreviewImage(result.compressedUrl);
    } catch (error) {
      console.error('Compression failed:', error);
      cancelAnimationFrame(animationId);
      clearTimeout(animationTimeout);
      setProgress(0);
    } finally {
      if (!abortRef.current) {
        setCompressing(false);
      }
    }
  }, [originalImage, outputFormat]);

  // Initial compression when dialog opens and debounced on quality/resolution change
  useEffect(() => {
    if (!open || !originalImage) {
      abortRef.current = true;
      return;
    }
    
    const timeoutId = setTimeout(() => {
      performCompression(quality, maxResolution);
    }, 300); // 300ms debounce
    
    return () => {
      clearTimeout(timeoutId);
      abortRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, maxResolution, open, originalImage]);

  const handleSave = () => {
    if (!compressionResult) return;

    const imageToSend = outputFormat === 'base64'
      ? compressionResult.compressedImage
      : compressionResult.compressedUrl;

    if (!imageToSend) return;

    // Pass EXIF data extracted from original image (before compression)
    onSave(imageToSend, compressionResult, exifData);
    onCancel();
  };


  const handleQualityChange = (values: number[]) => {
    setQuality(values[0]);
  };

  const handleResolutionChange = (value: string) => {
    if (value) {
      setResolutionMode(value as ResolutionMode);
    }
  };

  // Determine which image to show
  const displayImage = previewImage || originalImage;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('imgcompress_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preview Image */}
          <div className="relative rounded-lg overflow-hidden border bg-muted/30">
            {compressing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3 px-8 w-full max-w-xs">
                  <p className="text-sm font-medium">{t('imgcompress_optimizing')}</p>
                  <Progress value={progress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground">{progress}%</p>
                </div>
              </div>
            )}
            {displayImage ? (
              <img
                src={displayImage}
                alt={t('imgcompress_preview_alt')}
                className="w-full h-auto max-h-[300px] object-contain"
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">{t('imgcompress_loading_preview')}</p>
              </div>
            )}
          </div>

          {/* Resolution Mode Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('imgcompress_resolution_mode')}</Label>
            <ToggleGroup 
              type="single" 
              value={resolutionMode} 
              onValueChange={handleResolutionChange}
              className="justify-start"
              disabled={compressing}
            >
              <ToggleGroupItem value="fast" aria-label={t('imgcompress_fast_mode_aria')} className="gap-2">
                <Zap className="h-4 w-4" />
                <span>{t('imgcompress_fast_mode')}</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="high" aria-label={t('imgcompress_high_quality_aria')} className="gap-2">
                <Image className="h-4 w-4" />
                <span>{t('imgcompress_high_quality')}</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {resolutionMode === 'fast'
                ? t('imgcompress_fast_hint')
                : t('imgcompress_high_hint')}
            </p>
          </div>

          {/* Quality Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="quality-slider" className="text-sm font-medium">
                {t('imgcompress_quality_label')}: {quality}%
              </Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t('imgcompress_quality_tradeoff')}</span>
              </div>
            </div>
            <Slider
              id="quality-slider"
              value={[quality]}
              onValueChange={handleQualityChange}
              min={60}
              max={100}
              step={5}
              className="w-full"
              disabled={compressing}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>60% ({t('imgcompress_scale_lower')})</span>
              <span>85% ({t('imgcompress_scale_recommended')})</span>
              <span>100% ({t('imgcompress_scale_best')})</span>
            </div>
          </div>

          {/* Compression Stats */}
          {compressionResult && (
            <ImageCompressionStats
              originalSize={compressionResult.originalSize}
              compressedSize={compressionResult.compressedSize}
              width={compressionResult.width}
              height={compressionResult.height}
              compressionRatio={compressionResult.compressionRatio}
            />
          )}

          {/* Quality Recommendations */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">{t('imgcompress_quality_guide')}</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• <strong>85-100%</strong>: {t('imgcompress_guide_high')}</li>
              <li>• <strong>75-85%</strong>: {t('imgcompress_guide_balance')}</li>
              <li>• <strong>60-75%</strong>: {t('imgcompress_guide_low')}</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={compressing}
          >
            <X className="h-4 w-4 mr-2" />
            {t('imgcompress_cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={compressing || !compressionResult}
          >
            <Check className="h-4 w-4 mr-2" />
            {t('imgcompress_save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
