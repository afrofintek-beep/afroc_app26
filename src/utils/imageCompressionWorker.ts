/**
 * Image Compression - Optimized for mobile reliability
 * Uses async createImageBitmap + chunked processing to prevent UI blocking
 * Handles EXIF orientation for correct image display
 */

import type { CompressionResult } from "./imageCompression";
import exifr from 'exifr';

export interface WorkerCompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
}

export interface WorkerCompressionResult extends CompressionResult {
  compressedBlob: Blob;
  compressedUrl: string;
}

// Yield to browser to prevent UI blocking
function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// Convert base64 to blob without using fetch (more reliable)
function base64ToBlob(base64: string): Blob {
  try {
    const parts = base64.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = parts[1] || base64;
    
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    return new Blob([byteNumbers], { type: mime });
  } catch (error) {
    console.error('[Compression] base64ToBlob error:', error);
    throw new Error('Invalid base64 image data');
  }
}

// Get EXIF orientation from blob
async function getExifOrientation(blob: Blob): Promise<number> {
  try {
    const exif = await exifr.parse(blob, ['Orientation']);
    return exif?.Orientation || 1;
  } catch {
    return 1; // Default orientation
  }
}

// Calculate base64 size
function calculateBase64Size(base64String: string): number {
  const base64Data = base64String.split(',')[1] || base64String;
  const padding = (base64Data.match(/=/g) || []).length;
  return (base64Data.length * 3) / 4 - padding;
}

/**
 * Quick resize for preview - DEPRECATED
 * NOTE: Creating previews from base64 requires decoding (atob) which can freeze the UI.
 * Keep this exported for compatibility, but simply return the original source.
 */
export async function createQuickPreview(imageSource: string): Promise<string> {
  return imageSource;
}

/**
 * Main compression function - uses async APIs to minimize UI blocking
 */
export async function compressImageInWorker(
  imageSource: string,
  options: WorkerCompressionOptions,
  extra?: { returnBase64?: boolean }
): Promise<WorkerCompressionResult> {
  const { maxWidth, maxHeight, quality, format } = options;
  
  console.log('[Compression] Starting with options:', { maxWidth, maxHeight, quality, format });
  
  const originalSize = calculateBase64Size(imageSource);
  console.log('[Compression] Original size:', Math.round(originalSize / 1024), 'KB');
  
  await yieldToBrowser();
  
  // Convert base64 to blob
  let blob: Blob;
  try {
    blob = base64ToBlob(imageSource);
    console.log('[Compression] Blob created:', blob.size, 'bytes');
  } catch (error) {
    console.error('[Compression] Failed to create blob:', error);
    throw new Error('Failed to create blob from image');
  }
  
  await yieldToBrowser();

  // Get EXIF orientation BEFORE creating ImageBitmap (which may auto-orient on some browsers)
  const orientation = await getExifOrientation(blob);
  console.log('[Compression] EXIF Orientation:', orientation);
  
  await yieldToBrowser();
  
  // Use createImageBitmap - this is async and doesn't block the UI
  let imageBitmap: ImageBitmap;
  try {
    imageBitmap = await createImageBitmap(blob);
    console.log('[Compression] ImageBitmap created:', imageBitmap.width, 'x', imageBitmap.height);
  } catch (error) {
    console.error('[Compression] createImageBitmap failed:', error);
    throw new Error('Failed to create image bitmap');
  }
  
  await yieldToBrowser();
  
  // Get source dimensions
  let srcWidth = imageBitmap.width;
  let srcHeight = imageBitmap.height;
  
  // Check if orientation requires swapping dimensions (5, 6, 7, 8 = rotated 90° or 270°)
  const needsSwap = orientation >= 5 && orientation <= 8;
  if (needsSwap) {
    [srcWidth, srcHeight] = [srcHeight, srcWidth];
  }
  
  // Calculate new dimensions based on potentially swapped source dimensions
  let width = srcWidth;
  let height = srcHeight;

  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;
    if (width > height) {
      width = maxWidth;
      height = Math.round(maxWidth / aspectRatio);
    } else {
      height = maxHeight;
      width = Math.round(maxHeight * aspectRatio);
    }
  }
  
  console.log('[Compression] Output dimensions:', width, 'x', height);
  
  await yieldToBrowser();
  
  // Create canvas and draw with orientation correction
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d', { 
    alpha: format === 'png',
    willReadFrequently: false 
  });
  
  if (!ctx) {
    imageBitmap.close();
    throw new Error('Failed to get canvas context');
  }
  
  // Fill background for JPEG
  if (format === 'jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }
  
  await yieldToBrowser();
  
  // Apply orientation transform
  // EXIF Orientation values:
  // 1 = Normal
  // 2 = Flipped horizontally
  // 3 = Rotated 180°
  // 4 = Flipped vertically
  // 5 = Rotated 90° CCW and flipped vertically
  // 6 = Rotated 90° CW
  // 7 = Rotated 90° CW and flipped vertically
  // 8 = Rotated 90° CCW
  ctx.save();
  
  switch (orientation) {
    case 2: // Flip horizontal
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;
    case 3: // Rotate 180°
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;
    case 4: // Flip vertical
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;
    case 5: // Rotate 90° CCW + flip vertical
      ctx.translate(width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
      break;
    case 6: // Rotate 90° CW
      ctx.translate(width, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 7: // Rotate 90° CW + flip vertical
      ctx.translate(0, height);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(1, -1);
      break;
    case 8: // Rotate 90° CCW
      ctx.translate(0, height);
      ctx.rotate(-Math.PI / 2);
      break;
    default:
      // No transform needed for orientation 1
      break;
  }
  
  // Calculate draw dimensions based on orientation
  const drawWidth = needsSwap ? height : width;
  const drawHeight = needsSwap ? width : height;
  
  // Draw image - this is the main CPU-intensive operation
  ctx.drawImage(imageBitmap, 0, 0, drawWidth, drawHeight);
  ctx.restore();
  imageBitmap.close(); // Free memory
  
  console.log('[Compression] Image drawn to canvas with orientation correction');
  
  await yieldToBrowser();
  
  // Convert to blob using async toBlob
  const toBlobStartedAt = performance.now();
  const resultBlob = await new Promise<Blob>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.error('[Compression] Canvas toBlob timeout after 30s');
      reject(new Error('Canvas toBlob timeout'));
    }, 30000);

    canvas.toBlob(
      (b) => {
        clearTimeout(timeoutId);
        if (!b) {
          reject(new Error('Failed to create compressed blob'));
          return;
        }
        resolve(b);
      },
      `image/${format}`,
      quality
    );
  });

  console.log('[Compression] toBlob done ms=', Math.round(performance.now() - toBlobStartedAt));
  console.log('[Compression] Compressed blob size:', resultBlob.size, 'bytes');

  // Create a lightweight preview URL for UI (avoid base64 decoding/encoding work)
  const compressedUrl = URL.createObjectURL(resultBlob);

  const returnBase64 = extra?.returnBase64 ?? false;

  // Convert to base64 ONLY when explicitly needed (can be expensive on some devices)
  const compressedImage = returnBase64
    ? await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('FileReader did not return string'));
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(resultBlob);
      })
    : '';

  const compressedSize = returnBase64 ? calculateBase64Size(compressedImage) : resultBlob.size;
  const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

  console.log('[Compression] Complete:', {
    originalKB: Math.round(originalSize / 1024),
    compressedKB: Math.round(compressedSize / 1024),
    ratio: compressionRatio.toFixed(1) + '%',
    base64: returnBase64,
  });
  
  // Clean up canvas
  canvas.width = 0;
  canvas.height = 0;
  
  return {
    compressedImage,
    compressedBlob: resultBlob,
    compressedUrl,
    originalSize,
    compressedSize,
    compressionRatio,
    width,
    height,
    format,
  };
}
