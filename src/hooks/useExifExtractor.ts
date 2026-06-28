import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import exifr from 'exifr';

export interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  deviceMake?: string;
  deviceModel?: string;
  orientation?: number;
  imageWidth?: number;
  imageHeight?: number;
  software?: string;
  exposureTime?: string;
  fNumber?: number;
  iso?: number;
  flash?: string;
}

export function useExifExtractor() {
  const [extracting, setExtracting] = useState(false);
  const { toast } = useToast();

  const base64ToBlob = (base64: string): Blob => {
    console.log('[EXIF] Converting base64 to blob...');
    const parts = base64.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = parts[1] || base64;

    console.log('[EXIF] MIME type:', mime, 'Base64 data length:', base64Data.length);

    const byteCharacters = atob(base64Data);
    const bytes = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      bytes[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    console.log('[EXIF] Blob created, size:', blob.size);
    return blob;
  };

  const yieldToBrowser = (): Promise<void> =>
    new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      } else {
        setTimeout(resolve, 0);
      }
    });

  const extractExifData = async (imageDataUrl: string): Promise<ExifData | null> => {
    setExtracting(true);
    try {
      console.log('[EXIF] extractExifData called');
      
      // Avoid fetch(dataUrl) on mobile (can be very expensive / freeze)
      const blob = base64ToBlob(imageDataUrl);

      // Yield so UI can render before parsing
      await yieldToBrowser();

      // Fast path: read GPS only (much lighter)
      let gps: { latitude?: number; longitude?: number } | null = null;
      try {
        console.log('[EXIF] Attempting GPS extraction...');
        gps = await exifr.gps(blob);
        console.log('[EXIF] GPS result:', gps);
      } catch (gpsErr) {
        console.log('[EXIF] GPS extraction failed:', gpsErr);
        gps = null;
      }

      await yieldToBrowser();

      // Read only the tags we actually need (avoid full parse)
      console.log('[EXIF] Parsing additional tags...');
      let tags: any = null;
      try {
        tags = await exifr.parse(blob, [
          'DateTimeOriginal',
          'DateTime',
          'Make',
          'Model',
          'Orientation',
          'ImageWidth',
          'ImageHeight',
          'ExifImageWidth',
          'ExifImageHeight',
          'Software',
          'ExposureTime',
          'FNumber',
          'ISO',
          'Flash',
        ]);
        console.log('[EXIF] Tags result:', tags);
      } catch (tagErr) {
        console.log('[EXIF] Tags extraction failed:', tagErr);
        tags = null;
      }

      if (!gps && !tags) {
        console.log('[EXIF] No EXIF data found in image');
        return null;
      }

      const mappedData: ExifData = {
        latitude: gps?.latitude,
        longitude: gps?.longitude,
        timestamp: tags?.DateTimeOriginal
          ? new Date(tags.DateTimeOriginal).toISOString()
          : tags?.DateTime
          ? new Date(tags.DateTime).toISOString()
          : undefined,
        deviceMake: tags?.Make,
        deviceModel: tags?.Model,
        orientation: tags?.Orientation,
        imageWidth: tags?.ImageWidth || tags?.ExifImageWidth,
        imageHeight: tags?.ImageHeight || tags?.ExifImageHeight,
        software: tags?.Software,
        exposureTime: tags?.ExposureTime?.toString(),
        fNumber: tags?.FNumber,
        iso: tags?.ISO,
        flash: tags?.Flash?.toString(),
      };

      // Show success toast with key info
      const hasGPS = mappedData.latitude && mappedData.longitude;
      toast({
        title: 'Metadados EXIF Extraídos',
        description: hasGPS
          ? `GPS: ${mappedData.latitude?.toFixed(6)}, ${mappedData.longitude?.toFixed(6)}`
          : 'Dados do dispositivo capturados',
      });

      return mappedData;
    } catch (error: any) {
      console.error('EXIF extraction error:', error);
      // Don't show error toast - many photos don't have EXIF data
      console.log('No EXIF data available or extraction failed');
      return null;
    } finally {
      setExtracting(false);
    }
  };

  const validateExifGPS = (exifData: ExifData | null, capturedGPS: { lat: number; lon: number }): boolean => {
    if (!exifData?.latitude || !exifData?.longitude) {
      // No EXIF GPS - this is normal for many phones
      return true;
    }

    // Compare EXIF GPS with captured GPS (tolerance of ~100m = 0.001 degrees)
    const latDiff = Math.abs(exifData.latitude - capturedGPS.lat);
    const lonDiff = Math.abs(exifData.longitude - capturedGPS.lon);
    
    const threshold = 0.01; // ~1km tolerance
    const isValid = latDiff < threshold && lonDiff < threshold;

    if (!isValid) {
      console.warn('EXIF GPS mismatch:', {
        exif: { lat: exifData.latitude, lon: exifData.longitude },
        captured: capturedGPS,
        diff: { lat: latDiff, lon: lonDiff }
      });
    }

    return isValid;
  };

  return {
    extracting,
    extractExifData,
    validateExifGPS,
  };
}
