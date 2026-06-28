/**
 * Image Compression Utility
 * Optimizes images for storage while maintaining quality for ID verification
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
}

export interface CompressionResult {
  compressedImage: string; // Base64 data URI
  originalSize: number; // In bytes
  compressedSize: number; // In bytes
  compressionRatio: number; // Percentage
  width: number;
  height: number;
  format: string;
}

/**
 * Calculate file size from base64 string
 */
function calculateBase64Size(base64String: string): number {
  // Remove data URI prefix if present
  const base64Data = base64String.split(',')[1] || base64String;
  
  // Calculate size: (base64 length * 3/4) - padding
  const padding = (base64Data.match(/=/g) || []).length;
  return (base64Data.length * 3) / 4 - padding;
}

/**
 * Load image from base64 or URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  maintainAspectRatio: boolean = true
): { width: number; height: number } {
  if (!maintainAspectRatio) {
    return { width: maxWidth, height: maxHeight };
  }

  let width = originalWidth;
  let height = originalHeight;

  // Only resize if image exceeds maximum dimensions
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

  return { width, height };
}

/**
 * Adjust brightness of the image
 */
function adjustBrightness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number = 1.1
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = Math.min(255, pixels[i] * amount);     // R
    pixels[i + 1] = Math.min(255, pixels[i + 1] * amount); // G
    pixels[i + 2] = Math.min(255, pixels[i + 2] * amount); // B
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Adjust contrast of the image
 */
function adjustContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number = 1.2
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const factor = (259 * (amount * 255 + 255)) / (255 * (259 - amount * 255));

  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = Math.max(0, Math.min(255, factor * (pixels[i] - 128) + 128));         // R
    pixels[i + 1] = Math.max(0, Math.min(255, factor * (pixels[i + 1] - 128) + 128)); // G
    pixels[i + 2] = Math.max(0, Math.min(255, factor * (pixels[i + 2] - 128) + 128)); // B
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply sharpening filter to improve clarity
 */
function applySharpeningFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number = 0.5
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const tempPixels = new Uint8ClampedArray(pixels);

  // Sharpening kernel
  const sharpenKernel = [
    0, -1, 0,
    -1, 5 + amount, -1,
    0, -1, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            sum += tempPixels[pixelIndex] * sharpenKernel[kernelIndex];
          }
        }
        const currentIndex = (y * width + x) * 4 + c;
        pixels[currentIndex] = Math.max(0, Math.min(255, sum));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Calculate average brightness of the image to determine if enhancement is needed
 */
function calculateAverageBrightness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): number {
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  let totalBrightness = 0;
  
  for (let i = 0; i < pixels.length; i += 4) {
    // Calculate perceived brightness using luminance formula
    const brightness = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    totalBrightness += brightness;
  }
  
  return totalBrightness / (width * height);
}

/**
 * Auto-enhance image for better ID document legibility
 */
function autoEnhanceImage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  // Calculate current brightness
  const avgBrightness = calculateAverageBrightness(ctx, width, height);
  
  console.log('Image enhancement - Average brightness:', avgBrightness.toFixed(2));
  
  // Apply brightness adjustment if image is too dark or too bright
  if (avgBrightness < 100) {
    // Image is dark, increase brightness
    const brightnessAmount = 1 + (100 - avgBrightness) / 200;
    console.log('Applying brightness boost:', brightnessAmount.toFixed(2));
    adjustBrightness(ctx, width, height, brightnessAmount);
  } else if (avgBrightness > 200) {
    // Image is too bright, reduce slightly
    const brightnessAmount = 1 - (avgBrightness - 200) / 400;
    console.log('Reducing brightness:', brightnessAmount.toFixed(2));
    adjustBrightness(ctx, width, height, brightnessAmount);
  }
  
  // Apply moderate contrast enhancement for better text/detail visibility
  console.log('Applying contrast enhancement');
  adjustContrast(ctx, width, height, 1.15);
  
  // Apply sharpening for clarity
  console.log('Applying sharpening filter');
  applySharpeningFilter(ctx, width, height, 0.4);
}

/**
 * Compress image with quality optimization for ID documents
 */
export async function compressImage(
  imageSource: string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85, // Higher quality for ID verification
    format = 'jpeg',
    maintainAspectRatio = true,
  } = options;

  try {
    // Load the image
    const img = await loadImage(imageSource);
    const originalSize = calculateBase64Size(imageSource);

    // Calculate optimal dimensions
    const { width, height } = calculateDimensions(
      img.naturalWidth,
      img.naturalHeight,
      maxWidth,
      maxHeight,
      maintainAspectRatio
    );

    // Create canvas for compression
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', {
      alpha: format === 'png',
      willReadFrequently: true
    });

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Use high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw image with white background for JPEG (no transparency)
    if (format === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    // Removed slow pixel-by-pixel enhancement for mobile performance

    // Convert to compressed format
    const mimeType = `image/${format}`;
    const compressedImage = canvas.toDataURL(mimeType, quality);
    const compressedSize = calculateBase64Size(compressedImage);

    // Calculate compression ratio
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    console.log('Image compression complete:', {
      originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
      compressedSize: `${(compressedSize / 1024).toFixed(2)} KB`,
      compressionRatio: `${compressionRatio.toFixed(2)}%`,
      dimensions: `${width}x${height}`,
      format,
    });

    return {
      compressedImage,
      originalSize,
      compressedSize,
      compressionRatio,
      width,
      height,
      format,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Compress image with automatic quality adjustment
 * Tries to achieve target file size while maintaining minimum quality
 */
export async function compressImageToTargetSize(
  imageSource: string,
  targetSizeKB: number = 500,
  options: Omit<CompressionOptions, 'quality'> = {}
): Promise<CompressionResult> {
  let quality = 0.9;
  let result: CompressionResult;
  let attempts = 0;
  const maxAttempts = 5;
  const minQuality = 0.6; // Minimum quality for ID verification

  do {
    result = await compressImage(imageSource, { ...options, quality });
    const currentSizeKB = result.compressedSize / 1024;

    console.log(`Compression attempt ${attempts + 1}:`, {
      quality: quality.toFixed(2),
      sizeKB: currentSizeKB.toFixed(2),
      targetKB: targetSizeKB,
    });

    if (currentSizeKB <= targetSizeKB || quality <= minQuality) {
      break;
    }

    // Adjust quality for next attempt
    quality = Math.max(minQuality, quality - 0.1);
    attempts++;
  } while (attempts < maxAttempts);

  return result;
}

/**
 * Get estimated file size before compression
 */
export function estimateImageSize(base64Image: string): {
  sizeBytes: number;
  sizeKB: number;
  sizeMB: number;
} {
  const sizeBytes = calculateBase64Size(base64Image);
  return {
    sizeBytes,
    sizeKB: sizeBytes / 1024,
    sizeMB: sizeBytes / (1024 * 1024),
  };
}

/**
 * Batch compress multiple images
 */
export async function compressImageBatch(
  images: string[],
  options: CompressionOptions = {}
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];

  for (let i = 0; i < images.length; i++) {
    console.log(`Compressing image ${i + 1}/${images.length}...`);
    try {
      const result = await compressImage(images[i], options);
      results.push(result);
    } catch (error) {
      console.error(`Failed to compress image ${i + 1}:`, error);
      throw error;
    }
  }

  return results;
}
