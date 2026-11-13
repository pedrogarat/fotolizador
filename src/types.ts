export type SortField = 'captureDate' | 'modifiedDate' | 'name' | 'size' | 'manual';
export type SortDirection = 'asc' | 'desc';
export type GroupBy = 'none' | 'month' | 'year' | 'nameInitial' | 'namePrefix';

export type CaptionMode =
  | 'captureDate'
  | 'modifiedDate'
  | 'fileName'
  | 'fileNameNoExt'
  | 'customTemplate';

export type DateFormatStyle = 'short' | 'long' | 'shortWithTime';
export type PageOrientation = 'portrait' | 'landscape';
export type FooterLabelMode = 'paxina' | 'pagina' | 'none';
export type ResizePreset = 'light' | 'balanced' | 'high' | 'custom';

export interface PhotoItem {
  id: string;
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
  captureDate: number | null; // epoch ms from EXIF or null
  modifiedDate: number; // file.lastModified epoch ms
  addedAt: number;
  manualOrder: number;
  rotation: 0 | 90 | 180 | 270;
  customCaption: string;
  thumbnailUrl: string;
  blob: Blob;
  relativePath?: string; // Subcarpeta o ruta relativa respecto a la carpeta común
}

export interface DocumentSettings {
  mainTitle: string;
  title: string;
  footerLabel: FooterLabelMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  groupPageBreak: boolean;
  showCaption: boolean;
  captionMode: CaptionMode;
  dateFormat: DateFormatStyle;
  captionTemplate: string;
  columns: number;
  rows: number;
  orientation: PageOrientation;
  showTableBorders: boolean;
  resizePreset: ResizePreset;
  maxDimensionPx: number;
  jpegQuality: number; // 0.4 - 0.95
}

export interface PhotoGroup {
  key: string;
  label: string;
  photos: PhotoItem[];
}

export interface CellImageGeometry {
  widthMm: number;
  heightMm: number;
}

export interface PhotoConfigItem {
  name: string;
  relativePath?: string;
  size?: number;
  manualOrder: number;
  rotation: 0 | 90 | 180 | 270;
  customCaption: string;
  captureDate?: number | null;
  modifiedDate?: number;
}

export interface FotProjectFile {
  format: 'fotoprint';
  version: 1;
  createdAt: number;
  updatedAt: number;
  rootFolderHint?: string;
  originalPathHint?: string;
  settings: DocumentSettings;
  photos: PhotoConfigItem[];
}

export interface PlannedCell {
  photo: PhotoItem | null;
  caption: string;
  imageSizeMm: CellImageGeometry | null;
  globalIndex: number;
}

export interface PlannedRow {
  cells: PlannedCell[];
  rowHeightMm: number;
}

export interface PlannedBlock {
  groupLabel: string | null;
  rows: PlannedRow[];
  colWidthMm: number;
}

export interface PlannedPage {
  pageNumber: number;
  totalPages: number;
  blocks: PlannedBlock[];
}

export const DEFAULT_SETTINGS: DocumentSettings = {
  mainTitle: 'TITULO PRINCIPAL',
  title: 'TÍTULO',
  footerLabel: 'paxina',
  sortField: 'captureDate',
  sortDirection: 'asc',
  groupBy: 'none',
  groupPageBreak: true,
  showCaption: true,
  captionMode: 'captureDate',
  dateFormat: 'short',
  captionTemplate: 'Fecha: {fecha} · {nombre}',
  columns: 2,
  rows: 3,
  orientation: 'portrait',
  showTableBorders: true,
  resizePreset: 'balanced',
  maxDimensionPx: 1200,
  jpegQuality: 0.82,
};

export const RESIZE_PRESETS: Record<
  Exclude<ResizePreset, 'custom'>,
  { label: string; description: string; maxDimensionPx: number; jpegQuality: number }
> = {
  light: {
    label: 'Ligero',
    description: '900 px · 72% (ideal correo)',
    maxDimensionPx: 900,
    jpegQuality: 0.72,
  },
  balanced: {
    label: 'Equilibrado',
    description: '1200 px · 82% (recomendado)',
    maxDimensionPx: 1200,
    jpegQuality: 0.82,
  },
  high: {
    label: 'Alta calidad',
    description: '1800 px · 90% (impresión)',
    maxDimensionPx: 1800,
    jpegQuality: 0.9,
  },
};

