import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, ImageIcon, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCamera } from '@/hooks/useCamera';
import { useExifExtractor, ExifData } from '@/hooks/useExifExtractor';
import { useGeolocation } from '@/hooks/useGeolocation';
import { CompressionResult } from '@/utils/imageCompression';
import { ImageCompressionPreview } from './ImageCompressionPreview';
import { useToast } from '@/hooks/use-toast';
import { GPSSpoofingAlert } from './GPSSpoofingAlert';
import { SpoofingDetectionResult } from '@/utils/gpsSpoofingDetection';
import { GPSDistanceValidation } from './GPSDistanceValidation';
import { validateGPSUpdate, GPSValidationResult } from '@/utils/gpsDistance';
import { useAuthorizationLevel } from '@/hooks/useAuthorizationLevel';
import { useLanguage } from '@/contexts/LanguageContext';

interface PropertyPhotoCaptureProps {
  onPhotoCapture: (photo: string, exif: ExifData | null, stats: CompressionResult, gps: { lat: number; lon: number } | null) => void;
  currentPhoto?: string;
  onRemovePhoto?: () => void;
  previousGPS?: { lat: number; lon: number } | null;
  onGPSValidation?: (validation: GPSValidationResult) => void;
}

export default function PropertyPhotoCapture({ 
  onPhotoCapture, 
  currentPhoto,
  onRemovePhoto,
  previousGPS,
  onGPSValidation
}: PropertyPhotoCaptureProps) {
  // Store original photo as a ref to avoid re-renders with large data
  const originalPhotoRef = useRef<string>("");
  const [showCompressionPreview, setShowCompressionPreview] = useState(false);
  const [photoStats, setPhotoStats] = useState<CompressionResult | null>(null);
  const [photoExif, setPhotoExif] = useState<ExifData | null>(null);
  const [capturedGPS, setCapturedGPS] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [spoofingResult, setSpoofingResult] = useState<SpoofingDetectionResult | null>(null);
  const [gpsValidation, setGpsValidation] = useState<GPSValidationResult | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ photo: string; exif: ExifData | null; stats: CompressionResult } | null>(null);

  const { takePicture, selectFromGallery, loading: cameraLoading } = useCamera();
  const { extractExifData, validateExifGPS, extracting: exifExtracting } = useExifExtractor();
  const { getCurrentPosition, loading: gpsLoading } = useGeolocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: authLevel } = useAuthorizationLevel();
  
  // Only show technical GPS details to high-level admins (level 4+) for auditing
  const userLevel = authLevel?.current_level || 1;
  const canViewAuditDetails = userLevel >= 4;

  const handleSpoofingRiskAssessed = useCallback((result: SpoofingDetectionResult) => {
    setSpoofingResult(result);
    
    if (result.riskLevel === 'critical' || result.riskLevel === 'high') {
      setGpsWarning(result.recommendation);
    } else {
      setGpsWarning(null);
    }
  }, []);

  const handleTakePhoto = async () => {
    const photoData = await takePicture();
    if (!photoData) return;

    const gps = await getCurrentPosition();
    if (gps) {
      setCapturedGPS({ lat: gps.latitude, lon: gps.longitude, accuracy: gps.accuracy });
    }

    // Store in ref instead of state to avoid re-render with large data
    originalPhotoRef.current = photoData;
    setShowCompressionPreview(true);
  };

  const handleSelectPhoto = async () => {
    const photoData = await selectFromGallery();
    if (!photoData) return;

    const gps = await getCurrentPosition();
    if (gps) {
      setCapturedGPS({ lat: gps.latitude, lon: gps.longitude, accuracy: gps.accuracy });
    }

    // Store in ref instead of state to avoid re-render with large data
    originalPhotoRef.current = photoData;
    setShowCompressionPreview(true);
  };

  const handleSaveCompressedPhoto = async (photoPreview: string, stats: CompressionResult, extractedExif: ExifData | null) => {
    // Close preview immediately for responsive UI
    setShowCompressionPreview(false);
    setPhotoStats(stats);

    // Free memory from the original ASAP
    originalPhotoRef.current = '';

    // Use EXIF data extracted in ImageCompressionPreview (before compression)
    if (extractedExif) {
      setPhotoExif(extractedExif);

      if (capturedGPS) {
        const isValid = validateExifGPS(extractedExif, capturedGPS);

        if (!isValid) {
          setGpsWarning(t('photocapture_gps_discrepancy_warning'));
          toast({
            title: t('photocapture_gps_validation_failed_title'),
            description: t('photocapture_gps_validation_failed_desc'),
            variant: 'destructive',
          });
        } else {
          setGpsWarning(null);
          toast({
            title: t('photocapture_gps_validation_confirmed_title'),
            description: t('photocapture_gps_validation_confirmed_desc'),
          });
        }
      }
    }

    // Validate distance from previous GPS if available
    if (capturedGPS && previousGPS) {
      const validation = validateGPSUpdate(previousGPS.lat, previousGPS.lon, capturedGPS.lat, capturedGPS.lon);
      setGpsValidation(validation);
      onGPSValidation?.(validation);

      // If distance is too far, show warning and require confirmation
      if (!validation.isValid) {
        setPendingPhoto({ photo: photoPreview, exif: extractedExif, stats });
        return; // Don't save yet, wait for user confirmation
      }
    }

    // Pass everything to parent
    onPhotoCapture(photoPreview, extractedExif, stats, capturedGPS);
  };

  const handleConfirmDistanceOverride = () => {
    if (pendingPhoto) {
      onPhotoCapture(pendingPhoto.photo, pendingPhoto.exif, pendingPhoto.stats, capturedGPS);
      setPendingPhoto(null);
      setGpsValidation(null);
      toast({
        title: t('photocapture_photo_saved_title'),
        description: t('photocapture_photo_saved_desc'),
      });
    }
  };

  const handleCancelDistanceOverride = () => {
    setPendingPhoto(null);
    setGpsValidation(null);
    setCapturedGPS(null);
    toast({
      title: t('photocapture_cancelled_title'),
      description: t('photocapture_cancelled_desc'),
    });
  };



  const handleCancelCompression = () => {
    originalPhotoRef.current = "";
    setShowCompressionPreview(false);
  };

  const handleRemove = () => {
    originalPhotoRef.current = "";
    setPhotoStats(null);
    setPhotoExif(null);
    setCapturedGPS(null);
    setGpsWarning(null);
    onRemovePhoto?.();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {t('photocapture_card_title')}
          </CardTitle>
          <CardDescription>
            {t('photocapture_card_description')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* GPS Validation Status - Public view for regular users, detailed for auditors */}
          {(capturedGPS || photoExif) && (
            <GPSSpoofingAlert
              deviceGPS={capturedGPS ? {
                latitude: capturedGPS.lat,
                longitude: capturedGPS.lon,
                accuracy: capturedGPS.accuracy
              } : null}
              exifGPS={photoExif?.latitude && photoExif?.longitude ? {
                latitude: photoExif.latitude,
                longitude: photoExif.longitude
              } : null}
              exifTimestamp={photoExif?.timestamp}
              onRiskAssessed={handleSpoofingRiskAssessed}
              showDetails={canViewAuditDetails}
              publicView={!canViewAuditDetails}
              contactInfo="+244 923 456 789"
            />
          )}

          {/* GPS Distance Validation Alert */}
          {gpsValidation && !gpsValidation.isValid && (
            <GPSDistanceValidation
              validation={gpsValidation}
              onConfirm={handleConfirmDistanceOverride}
              onCancel={handleCancelDistanceOverride}
              showActions={pendingPhoto !== null}
            />
          )}
          
          {photoExif && !spoofingResult?.isSuspicious && (
            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-1">
                <div><strong>{t('photocapture_exif_extracted_label')}</strong></div>
                {photoExif.deviceMake && photoExif.deviceModel && (
                  <div>📱 {t('photocapture_exif_device_label')} {photoExif.deviceMake} {photoExif.deviceModel}</div>
                )}
                {photoExif.latitude && photoExif.longitude && (
                  <div>📍 GPS EXIF: {photoExif.latitude.toFixed(6)}, {photoExif.longitude.toFixed(6)}</div>
                )}
                {capturedGPS && (
                  <div>📍 {t('photocapture_exif_device_gps_label')} {capturedGPS.lat.toFixed(6)}, {capturedGPS.lon.toFixed(6)}</div>
                )}
                {photoExif.timestamp && (
                  <div>🕒 {t('photocapture_exif_captured_at_label')} {new Date(photoExif.timestamp).toLocaleString('pt-BR')}</div>
                )}
                {photoExif.imageWidth && photoExif.imageHeight && (
                  <div>📐 {t('photocapture_exif_dimensions_label')} {photoExif.imageWidth}×{photoExif.imageHeight}px</div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {currentPhoto ? (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden border-2 border-primary/20">
                <img 
                  src={currentPhoto} 
                  alt="Property Door" 
                  className="w-full h-auto max-h-96 object-contain bg-muted"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemove}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {photoStats && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('photocapture_file_size_label')}</span>
                    <Badge variant="secondary">
                      {(photoStats.compressedSize / 1024).toFixed(0)}KB
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({photoStats.compressionRatio.toFixed(0)}% {t('photocapture_saved_suffix')})
                      </span>
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-muted-foreground">{t('photocapture_dimensions_label')}</span>
                    <span className="font-mono text-xs">
                      {photoStats.width}×{photoStats.height}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Camera className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-4">
                  {t('photocapture_capture_door_prompt')}
                </p>
                
                <div className="flex gap-3">
                  <Button
                    onClick={handleTakePhoto}
                    disabled={cameraLoading || exifExtracting || gpsLoading}
                    variant="default"
                    className="flex-1"
                  >
                    <Camera className={`h-4 w-4 mr-2 ${(cameraLoading || gpsLoading) ? 'animate-pulse' : ''}`} />
                    {gpsLoading ? t('photocapture_capturing_gps') : cameraLoading ? t('photocapture_opening') : t('photocapture_take_photo')}
                  </Button>
                  
                  <Button
                    onClick={handleSelectPhoto}
                    disabled={cameraLoading || exifExtracting || gpsLoading}
                    variant="outline"
                    className="flex-1"
                  >
                    <ImageIcon className={`h-4 w-4 mr-2 ${(cameraLoading || gpsLoading) ? 'animate-pulse' : ''}`} />
                    {gpsLoading ? t('photocapture_capturing_gps') : cameraLoading ? t('photocapture_opening') : t('photocapture_gallery')}
                  </Button>
                </div>
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>{t('photocapture_tips_title')}</strong>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>• {t('photocapture_tip_lighting')}</li>
                    <li>• {t('photocapture_tip_full_door')}</li>
                    <li>• {t('photocapture_tip_steady')}</li>
                    <li>• {t('photocapture_tip_shadows')}</li>
                    <li>• {t('photocapture_tip_metadata')}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {showCompressionPreview && originalPhotoRef.current && (
        <ImageCompressionPreview
          open={showCompressionPreview}
          originalImage={originalPhotoRef.current}
          outputFormat="blobUrl"
          onSave={handleSaveCompressedPhoto}
          onCancel={handleCancelCompression}
        />
      )}
    </>
  );
}
