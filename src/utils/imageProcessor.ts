import exifr from 'exifr';
import { PhotoItem } from '../types';

export interface ProcessedImagePayload {
  bytes: Uint8Array;
  dataUrl: string;
  width: number;
  height: number;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function extractCaptureTimestamp(file: File): Promise<number | null> {
  try {
    const data = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    });
    const candidate = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.ModifyDate;
    if (candidate instanceof Date && !Number.isNaN(candidate.getTime())) {
      return candidate.getTime();
    }
    if (typeof candidate === 'string') {
      const normalized = candidate.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const parsed = Date.parse(normalized);
      if (!Number.isNaN(parsed)) return parsed;
    }
  } catch {
    // Not all images (e.g. PNG/WebP) contain EXIF metadata
  }
  return null;
}

async function loadImageSource(blob: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const url = URL.createObjectURL(blob);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    el.src = url;
  });

  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

function renderRotatedScaledCanvas(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  maxDimension: number,
  rotation: 0 | 90 | 180 | 270
): HTMLCanvasElement {
  const longestSide = Math.max(srcWidth, srcHeight);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const drawW = Math.max(1, Math.round(srcWidth * scale));
  const drawH = Math.max(1, Math.round(srcHeight * scale));

  const swap = rotation === 90 || rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? drawH : drawW;
  canvas.height = swap ? drawW : drawH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo 2D del navegador');
  }

  // White background avoids black transparent areas when exporting PNG/WebP to JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvas;
}

export async function createThumbnailDataUrl(
  blob: Blob,
  rotation: 0 | 90 | 180 | 270 = 0,
  maxDimension = 360
): Promise<{ thumbnailUrl: string; width: number; height: number }> {
  const loaded = await loadImageSource(blob);
  try {
    const canvas = renderRotatedScaledCanvas(
      loaded.source,
      loaded.width,
      loaded.height,
      maxDimension,
      rotation
    );
    return {
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.78),
      width: loaded.width,
      height: loaded.height,
    };
  } finally {
    loaded.cleanup();
  }
}

export async function importImageFile(
  file: File,
  manualOrder: number,
  preset?: {
    rotation?: 0 | 90 | 180 | 270;
    customCaption?: string;
    manualOrder?: number;
  }
): Promise<PhotoItem> {
  const initialRotation = preset?.rotation ?? 0;
  const initialOrder = preset?.manualOrder ?? manualOrder;
  const initialCaption = preset?.customCaption ?? '';

  const [captureDate, thumbInfo] = await Promise.all([
    extractCaptureTimestamp(file),
    createThumbnailDataUrl(file, initialRotation, 380),
  ]);

  const relPath =
    (file as { customRelativePath?: string }).customRelativePath ||
    file.webkitRelativePath ||
    file.name;

  return {
    id: createId(),
    name: file.name,
    size: file.size,
    type: file.type || 'image/jpeg',
    width: thumbInfo.width,
    height: thumbInfo.height,
    captureDate,
    modifiedDate: file.lastModified || Date.now(),
    addedAt: Date.now(),
    manualOrder: initialOrder,
    rotation: initialRotation,
    customCaption: initialCaption,
    thumbnailUrl: thumbInfo.thumbnailUrl,
    blob: file,
    relativePath: relPath,
  };
}

export async function resizePhotoForExport(
  photo: PhotoItem,
  maxDimensionPx: number,
  jpegQuality: number
): Promise<ProcessedImagePayload> {
  const loaded = await loadImageSource(photo.blob);
  try {
    const canvas = renderRotatedScaledCanvas(
      loaded.source,
      loaded.width,
      loaded.height,
      maxDimensionPx,
      photo.rotation
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error(`Error al comprimir ${photo.name}`));
        },
        'image/jpeg',
        jpegQuality
      );
    });

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);

    return {
      bytes,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    loaded.cleanup();
  }
}

export function estimateResizedBytes(
  photo: PhotoItem,
  maxDimensionPx: number,
  jpegQuality: number
): number {
  const longest = Math.max(photo.width || 1000, photo.height || 1000);
  const scale = longest > maxDimensionPx ? maxDimensionPx / longest : 1;
  const w = Math.max(1, Math.round((photo.width || 1000) * scale));
  const h = Math.max(1, Math.round((photo.height || 1000) * scale));
  const pixels = w * h;
  // Realistic empirical JPEG bytes-per-pixel heuristic
  const bpp = 0.08 + Math.pow(jpegQuality, 2.2) * 0.28;
  return Math.min(photo.size, Math.round(pixels * bpp));
}

