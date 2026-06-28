import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, Loader2, Camera, RefreshCw, FolderOpen, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCamera } from "@/hooks/useCamera";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useExifExtractor, ExifData } from "@/hooks/useExifExtractor";
import { ImageCompressionPreview } from "./ImageCompressionPreview";
import { CompressionResult } from "@/utils/imageCompression";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGPSHistory } from "@/hooks/useGPSHistory";
import { validateGPSUpdate } from "@/utils/gpsDistance";
import { GPSDistanceValidation } from "./GPSDistanceValidation";

interface PropertyPhotoDisplayProps {
  filePath: string;
  afrolocRecordId?: string;
  className?: string;
  allowRecapture?: boolean;
  onPhotoUpdated?: () => void;
}

interface PreviousPhoto {
  name: string;
  created_at: string;
  url?: string;
}

export const PropertyPhotoDisplay = ({ 
  filePath, 
  afrolocRecordId,
  className = "",
  allowRecapture = true,
  onPhotoUpdated
}: PropertyPhotoDisplayProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showRecaptureDialog, setShowRecaptureDialog] = useState(false);
  const [showPreviousPhotos, setShowPreviousPhotos] = useState(false);
  const [previousPhotos, setPreviousPhotos] = useState<PreviousPhoto[]>([]);
  const [loadingPreviousPhotos, setLoadingPreviousPhotos] = useState(false);
  const [showCompressionPreview, setShowCompressionPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [capturedGPS, setCapturedGPS] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [previousGPS, setPreviousGPS] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsValidation, setGpsValidation] = useState<ReturnType<typeof validateGPSUpdate> | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    photoPreview: string;
    stats: CompressionResult;
    extractedExif: ExifData | null;
  } | null>(null);
  
  const originalPhotoRef = useRef<string>("");
  
  const { t } = useLanguage();
  const { toast } = useToast();
  const { takePicture, selectFromGallery, loading: cameraLoading } = useCamera();
  const { getCurrentPosition, loading: gpsLoading } = useGeolocation();
  const { extractExifData, validateExifGPS } = useExifExtractor();
  const { recordGPSUpdate } = useGPSHistory();

  useEffect(() => {
    // If no filePath, immediately set error state (no photo available)
    if (!filePath) {
      setLoading(false);
      setError(true);
      return;
    }

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const { data, error: signedUrlError } = await supabase.storage
          .from('property-photos')
          .createSignedUrl(filePath, 3600);
        
        if (signedUrlError) {
          console.error('Error creating signed URL:', signedUrlError);
          setError(true);
          return;
        }
        
        setImageUrl(data.signedUrl);
      } catch (err) {
        console.error('Error loading property photo:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [filePath]);

  // Load previous GPS coordinates from the record
  useEffect(() => {
    const loadPreviousGPS = async () => {
      if (!afrolocRecordId) return;
      
      try {
        const { data, error } = await supabase
          .from('afroloc_records')
          .select('geo_lat, geo_lon')
          .eq('id', afrolocRecordId)
          .single();
        
        if (!error && data?.geo_lat && data?.geo_lon) {
          setPreviousGPS({ lat: Number(data.geo_lat), lon: Number(data.geo_lon) });
        }
      } catch (err) {
        console.error('Error loading previous GPS:', err);
      }
    };
    
    loadPreviousGPS();
  }, [afrolocRecordId]);

  const loadPreviousPhotos = async () => {
    if (!afrolocRecordId) return;
    
    setLoadingPreviousPhotos(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) return;

      const userId = session.session.user.id;
      const folderPath = `${userId}/${afrolocRecordId}`;
      
      const { data: files, error } = await supabase.storage
        .from('property-photos')
        .list(folderPath, {
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Error loading previous photos:', error);
        return;
      }

      if (files && files.length > 0) {
        const photosWithUrls = await Promise.all(
          files
            .filter(f => f.name.match(/\.(jpg|jpeg|png|webp)$/i))
            .map(async (file) => {
              const fullPath = `${folderPath}/${file.name}`;
              const { data } = await supabase.storage
                .from('property-photos')
                .createSignedUrl(fullPath, 3600);
              
              return {
                name: file.name,
                created_at: file.created_at || '',
                url: data?.signedUrl
              };
            })
        );
        
        setPreviousPhotos(photosWithUrls);
      }
    } catch (err) {
      console.error('Error loading previous photos:', err);
    } finally {
      setLoadingPreviousPhotos(false);
    }
  };

  const handleTakePhoto = async () => {
    const photoData = await takePicture();
    if (!photoData) return;

    const gps = await getCurrentPosition();
    if (gps) {
      setCapturedGPS({ lat: gps.latitude, lon: gps.longitude, accuracy: gps.accuracy });
    }

    originalPhotoRef.current = photoData;
    setShowRecaptureDialog(false);
    setShowCompressionPreview(true);
  };

  const handleSelectFromGallery = async () => {
    const photoData = await selectFromGallery();
    if (!photoData) return;

    const gps = await getCurrentPosition();
    if (gps) {
      setCapturedGPS({ lat: gps.latitude, lon: gps.longitude, accuracy: gps.accuracy });
    }

    originalPhotoRef.current = photoData;
    setShowRecaptureDialog(false);
    setShowCompressionPreview(true);
  };

  const handleSelectPreviousPhoto = async (photo: PreviousPhoto) => {
    if (!afrolocRecordId || !photo.name) return;
    
    try {
      setUploading(true);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user?.id) {
        throw new Error('User not authenticated');
      }

      const userId = session.session.user.id;
      const fullPath = `${userId}/${afrolocRecordId}/${photo.name}`;
      
      // Update the afroloc record with the selected photo
      const { error: updateError } = await supabase
        .from('afroloc_records')
        .update({
          photo_metadata: { file_path: fullPath },
          updated_at: new Date().toISOString()
        })
        .eq('id', afrolocRecordId);

      if (updateError) throw updateError;

      toast({
        title: t('photo_updated') || 'Foto atualizada',
        description: t('photo_updated_success') || 'A foto de validação GPS foi atualizada com sucesso.'
      });

      setShowPreviousPhotos(false);
      onPhotoUpdated?.();
      
      // Reload the image
      if (photo.url) {
        setImageUrl(photo.url);
      }
    } catch (err: any) {
      console.error('Error selecting previous photo:', err);
      toast({
        title: t('error') || 'Erro',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveCompressedPhoto = async (
    photoPreview: string, 
    stats: CompressionResult, 
    extractedExif: ExifData | null
  ) => {
    console.log('[PropertyPhotoDisplay] handleSaveCompressedPhoto called', {
      hasPhotoPreview: !!photoPreview,
      photoPreviewLength: photoPreview?.length,
      photoPreviewStart: photoPreview?.substring(0, 30),
      afrolocRecordId,
      hasCapturedGPS: !!capturedGPS,
      hasPreviousGPS: !!previousGPS,
    });
    
    if (!afrolocRecordId) {
      console.warn('[PropertyPhotoDisplay] No afrolocRecordId, aborting upload');
      setShowCompressionPreview(false);
      return;
    }

    // Validate GPS distance if we have previous coordinates
    if (capturedGPS && previousGPS) {
      const validation = validateGPSUpdate(previousGPS.lat, previousGPS.lon, capturedGPS.lat, capturedGPS.lon);
      setGpsValidation(validation);
      
      if (!validation.isValid) {
        setPendingUpload({ photoPreview, stats, extractedExif });
        setShowCompressionPreview(false);
        return; // Wait for user confirmation
      }
    }

    await performUpload(photoPreview, stats, extractedExif);
  };

  const handleConfirmDistanceOverride = async () => {
    if (pendingUpload) {
      await performUpload(pendingUpload.photoPreview, pendingUpload.stats, pendingUpload.extractedExif);
      setPendingUpload(null);
      setGpsValidation(null);
    }
  };

  const handleCancelDistanceOverride = () => {
    setPendingUpload(null);
    setGpsValidation(null);
    setCapturedGPS(null);
  };

  const performUpload = async (
    photoPreview: string, 
    stats: CompressionResult, 
    extractedExif: ExifData | null
  ) => {
    console.log('[PropertyPhotoDisplay] performUpload starting', {
      afrolocRecordId,
      hasPhotoPreview: !!photoPreview,
      photoPreviewStart: photoPreview?.substring(0, 30),
    });
    
    if (!afrolocRecordId) return;

    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      console.log('[PropertyPhotoDisplay] Session user:', session?.session?.user?.id);
      if (!session?.session?.user?.id) {
        throw new Error('User not authenticated');
      }

      const userId = session.session.user.id;
      const timestamp = Date.now();
      const fileName = `validation_${timestamp}.jpg`;
      const storagePath = `${userId}/${afrolocRecordId}/${fileName}`;

      // Convert preview (base64 data URL OR blob URL) to Blob for upload.
      const dataUrlToBlob = (dataUrl: string): Blob => {
        const parts = dataUrl.split(',');
        const mimeMatch = parts[0]?.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Data = parts[1] || '';

        const byteCharacters = atob(base64Data);
        const bytes = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          bytes[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([bytes], { type: mime });
      };

      let blob: Blob;
      if (photoPreview.startsWith('data:')) {
        blob = dataUrlToBlob(photoPreview);
      } else {
        const response = await fetch(photoPreview);
        blob = await response.blob();
      }

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(storagePath, blob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('[PropertyPhotoDisplay] Upload error:', uploadError);
        throw uploadError;
      }
      console.log('[PropertyPhotoDisplay] Upload success:', storagePath);

      // Update the afroloc record
      const updateData: any = {
        photo_metadata: { 
          file_path: storagePath,
          compression_stats: stats,
          captured_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      };

      // Add GPS data if available
      if (capturedGPS) {
        updateData.geo_lat = capturedGPS.lat;
        updateData.geo_lon = capturedGPS.lon;
      }

      // Add EXIF data if available
      if (extractedExif) {
        if (extractedExif.latitude && extractedExif.longitude) {
          updateData.photo_exif_gps_lat = extractedExif.latitude;
          updateData.photo_exif_gps_lon = extractedExif.longitude;
        }
        if (extractedExif.deviceMake) {
          updateData.photo_exif_device_make = extractedExif.deviceMake;
        }
        if (extractedExif.deviceModel) {
          updateData.photo_exif_device_model = extractedExif.deviceModel;
        }
        if (extractedExif.timestamp) {
          updateData.photo_exif_timestamp = extractedExif.timestamp;
        }
      }

      const { error: updateError } = await supabase
        .from('afroloc_records')
        .update(updateData)
        .eq('id', afrolocRecordId);

      if (updateError) throw updateError;

      // Record GPS history
      if (capturedGPS) {
        try {
          await recordGPSUpdate({
            afrolocRecordId,
            userId,
            previousLat: previousGPS?.lat || null,
            previousLon: previousGPS?.lon || null,
            newLat: capturedGPS.lat,
            newLon: capturedGPS.lon,
            accuracy: capturedGPS.accuracy,
            updateReason: 'Photo recapture',
            photoPath: storagePath,
          });
        } catch (historyError) {
          console.error('Failed to record GPS history:', historyError);
        }
      }

      toast({
        title: t('photo_captured') || 'Foto capturada',
        description: t('photo_saved_success') || 'A nova foto de validação GPS foi salva com sucesso.'
      });

      setShowCompressionPreview(false);
      originalPhotoRef.current = '';
      setCapturedGPS(null);
      onPhotoUpdated?.();

      // Get signed URL for the new photo
      const { data: signedUrlData } = await supabase.storage
        .from('property-photos')
        .createSignedUrl(storagePath, 3600);

      if (signedUrlData?.signedUrl) {
        setImageUrl(signedUrlData.signedUrl);
      }
    } catch (err: any) {
      console.error('Error saving photo:', err);
      toast({
        title: t('error') || 'Erro',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelCompression = () => {
    originalPhotoRef.current = '';
    setShowCompressionPreview(false);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 bg-muted/30 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canManagePhoto = allowRecapture && !!afrolocRecordId;
  const showPlaceholder = error || !imageUrl;

  return (
    <>
      {showPlaceholder ? (
        <div className={`flex flex-col items-center justify-center p-8 bg-muted/30 ${className}`}>
          <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{t("photo_unavailable") || "Foto não disponível"}</p>
          {canManagePhoto && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => setShowRecaptureDialog(true)}>
                <Camera className="h-4 w-4 mr-2" />
                {t("capture_photo") || "Capturar Foto"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  loadPreviousPhotos();
                  setShowPreviousPhotos(true);
                }}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {t("previous_photos") || "Anteriores"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className={`relative ${className}`}>
          <img
            src={imageUrl}
            alt={t("property_photo") || "Foto da Propriedade"}
            className="w-full h-auto max-h-64 object-contain rounded-lg"
            onError={() => setError(true)}
          />

          {canManagePhoto && (
            <div className="absolute bottom-2 right-2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  loadPreviousPhotos();
                  setShowPreviousPhotos(true);
                }}
                className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{t("previous_photos") || "Anteriores"}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRecaptureDialog(true)}
                className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{t("recapture") || "Recapturar"}</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Recapture Dialog */}
      <Dialog open={showRecaptureDialog} onOpenChange={setShowRecaptureDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {t("recapture_gps_photo") || "Recapturar Foto GPS"}
            </DialogTitle>
            <DialogDescription>
              {t("recapture_description") ||
                "Capture uma nova foto da propriedade para validação GPS ou selecione da galeria."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleTakePhoto} disabled={cameraLoading || gpsLoading} className="w-full">
              <Camera className={`h-4 w-4 mr-2 ${(cameraLoading || gpsLoading) ? "animate-pulse" : ""}`} />
              {gpsLoading
                ? t("capturing_gps") || "Capturando GPS..."
                : cameraLoading
                  ? t("opening") || "Abrindo..."
                  : t("take_photo") || "Tirar Foto"}
            </Button>

            <Button
              variant="outline"
              onClick={handleSelectFromGallery}
              disabled={cameraLoading || gpsLoading}
              className="w-full"
            >
              <ImageIcon
                className={`h-4 w-4 mr-2 ${(cameraLoading || gpsLoading) ? "animate-pulse" : ""}`}
              />
              {gpsLoading
                ? t("capturing_gps") || "Capturando GPS..."
                : cameraLoading
                  ? t("opening") || "Abrindo..."
                  : t("select_from_gallery") || "Selecionar da Galeria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Previous Photos Dialog */}
      <Dialog open={showPreviousPhotos} onOpenChange={setShowPreviousPhotos}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              {t("previous_photos_title") || "Fotos Anteriores"}
            </DialogTitle>
            <DialogDescription>
              {t("previous_photos_description") || "Selecione uma foto anterior para usar como validação GPS."}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] pr-4">
            {loadingPreviousPhotos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previousPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("no_previous_photos") || "Nenhuma foto anterior encontrada"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {previousPhotos.map((photo, index) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                    onClick={() => handleSelectPreviousPhoto(photo)}
                  >
                    {photo.url ? (
                      <img src={photo.url} alt={photo.name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Check className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white truncate">
                        {photo.created_at ? new Date(photo.created_at).toLocaleDateString("pt-BR") : photo.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* GPS Distance Validation Dialog */}
      {gpsValidation && pendingUpload && (
        <Dialog open={true} onOpenChange={() => handleCancelDistanceOverride()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
            <DialogTitle>Verificação de Localização</DialogTitle>
              <DialogDescription>
                A sua localização actual foi comparada com a referência registada para esta propriedade.
              </DialogDescription>
            </DialogHeader>
            <GPSDistanceValidation
              validation={gpsValidation}
              onConfirm={handleConfirmDistanceOverride}
              onCancel={handleCancelDistanceOverride}
              showActions={true}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Compression Preview */}
      {showCompressionPreview && originalPhotoRef.current && (
        <ImageCompressionPreview
          open={showCompressionPreview}
          originalImage={originalPhotoRef.current}
          outputFormat="base64"
          onSave={handleSaveCompressedPhoto}
          onCancel={handleCancelCompression}
        />
      )}
    </>
  );
};
