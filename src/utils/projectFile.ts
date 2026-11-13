import { DEFAULT_SETTINGS, DocumentSettings, FotProjectFile, PhotoConfigItem, PhotoItem } from '../types';

function sanitizeFilename(raw: string): string {
  const cleaned = raw.trim().replace(/[\\/:*?"<>|]/g, '_');
  return cleaned.length > 0 ? cleaned : 'montaje';
}

export function detectRootFolderHint(
  photos: Array<{ relativePath?: string }>
): string | undefined {
  const paths = photos
    .map((p) => (p.relativePath || '').replace(/\\/g, '/'))
    .filter((p) => p.includes('/'));

  if (paths.length === 0) return undefined;

  const splitPaths = paths.map((p) => p.split('/').filter(Boolean));
  const first = splitPaths[0];
  const commonSegments: string[] = [];

  for (let i = 0; i < first.length - 1; i++) {
    const seg = first[i];
    if (splitPaths.every((sp) => sp[i] === seg)) {
      commonSegments.push(seg);
    } else {
      break;
    }
  }

  if (commonSegments.length > 0) {
    return commonSegments.join('/');
  }

  return first[0];
}

export function exportProjectToFot(
  settings: DocumentSettings,
  photos: PhotoItem[]
): { fileName: string; byteCount: number } {
  const rootFolderHint = detectRootFolderHint(photos);

  const projectData: FotProjectFile = {
    format: 'fotoprint',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rootFolderHint,
    settings,
    photos: photos.map<PhotoConfigItem>((p) => ({
      name: p.name,
      relativePath: p.relativePath,
      size: p.size,
      manualOrder: p.manualOrder,
      rotation: p.rotation,
      customCaption: p.customCaption,
      captureDate: p.captureDate,
      modifiedDate: p.modifiedDate,
    })),
  };

  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const fileName = `${sanitizeFilename(settings.title)}.fot`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { fileName, byteCount: blob.size };
}

export async function readFotFile(file: File): Promise<FotProjectFile> {
  const text =
    typeof file.text === 'function'
      ? await file.text()
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => reject(reader.error ?? new Error('Error al leer archivo'));
          reader.readAsText(file);
        });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo seleccionado no tiene un formato válido (.fot / JSON).');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Estructura de archivo de proyecto no válida.');
  }

  const raw = parsed as Partial<FotProjectFile>;

  // Normalize settings with defaults in case of missing keys
  const mergedSettings: DocumentSettings = {
    ...DEFAULT_SETTINGS,
    ...(raw.settings || {}),
  };

  const photoList: PhotoConfigItem[] = Array.isArray(raw.photos)
    ? raw.photos
        .filter((item): item is PhotoConfigItem => Boolean(item && typeof item.name === 'string'))
        .map((item) => ({
          name: item.name,
          relativePath: typeof item.relativePath === 'string' ? item.relativePath : undefined,
          size: typeof item.size === 'number' ? item.size : undefined,
          manualOrder: typeof item.manualOrder === 'number' ? item.manualOrder : 0,
          rotation: ([0, 90, 180, 270].includes(item.rotation) ? item.rotation : 0) as 0 | 90 | 180 | 270,
          customCaption: typeof item.customCaption === 'string' ? item.customCaption : '',
          captureDate: typeof item.captureDate === 'number' ? item.captureDate : null,
          modifiedDate: typeof item.modifiedDate === 'number' ? item.modifiedDate : undefined,
        }))
    : [];

  return {
    format: 'fotoprint',
    version: 1,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: Date.now(),
    rootFolderHint: raw.rootFolderHint || detectRootFolderHint(photoList),
    settings: mergedSettings,
    photos: photoList,
  };
}
