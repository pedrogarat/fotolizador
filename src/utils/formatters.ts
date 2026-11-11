import { DateFormatStyle, DocumentSettings, PhotoItem } from '../types';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

export function getEffectiveTimestamp(photo: PhotoItem, preferCapture = true): number {
  if (preferCapture && photo.captureDate !== null) {
    return photo.captureDate;
  }
  return photo.modifiedDate;
}

export function formatDateValue(timestamp: number, style: DateFormatStyle): string {
  const date = new Date(timestamp);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  if (style === 'long') {
    return `${dd}/${mm}/${yyyy}`;
  }
  if (style === 'shortWithTime') {
    return `${dd}/${mm}/${yy} ${hh}:${min}`;
  }
  return `${dd}/${mm}/${yy}`;
}

export function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return filename;
  return filename.slice(0, lastDot);
}

export function getNamePrefix(filename: string): string {
  const base = stripExtension(filename).trim();
  const match = base.match(/^([^\d_\-\s]+)/);
  if (match && match[1].length >= 2) {
    return match[1].toUpperCase();
  }
  const token = base.split(/[_\-\s]+/)[0];
  return (token || base || 'Sin nombre').toUpperCase();
}

export function getMonthGroupInfo(timestamp: number): { key: string; label: string } {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const monthIdx = d.getMonth();
  const mm = String(monthIdx + 1).padStart(2, '0');
  return {
    key: `${year}-${mm}`,
    label: `${MONTHS_ES[monthIdx]} ${year}`,
  };
}

export function getYearGroupInfo(timestamp: number): { key: string; label: string } {
  const year = new Date(timestamp).getFullYear();
  return {
    key: String(year),
    label: `Año ${year}`,
  };
}

export function buildPhotoCaption(
  photo: PhotoItem,
  settings: DocumentSettings,
  indexOneBased: number
): string {
  if (!settings.showCaption) {
    return '';
  }

  if (photo.customCaption.trim().length > 0) {
    return photo.customCaption.trim();
  }

  const captureTs = getEffectiveTimestamp(photo, true);
  const modifiedTs = photo.modifiedDate;
  const dateShort = formatDateValue(captureTs, settings.dateFormat);
  const dateLong = formatDateValue(captureTs, 'long');
  const modDateStr = formatDateValue(modifiedTs, settings.dateFormat);
  const timeDate = new Date(captureTs);
  const timeStr = `${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`;

  switch (settings.captionMode) {
    case 'captureDate':
      return `Fecha: ${dateShort}`;
    case 'modifiedDate':
      return `Fecha: ${modDateStr}`;
    case 'fileName':
      return photo.name;
    case 'fileNameNoExt':
      return stripExtension(photo.name);
    case 'customTemplate': {
      return settings.captionTemplate
        .replace(/\{fecha\}/gi, dateShort)
        .replace(/\{fecha_larga\}/gi, dateLong)
        .replace(/\{fecha_mod\}/gi, modDateStr)
        .replace(/\{hora\}/gi, timeStr)
        .replace(/\{nombre\}/gi, stripExtension(photo.name))
        .replace(/\{archivo\}/gi, photo.name)
        .replace(/\{indice\}/gi, String(indexOneBased));
    }
    default:
      return `Fecha: ${dateShort}`;
  }
}

export function getEffectiveDimensions(photo: PhotoItem): { width: number; height: number } {
  if (photo.rotation === 90 || photo.rotation === 270) {
    return { width: photo.height || 1000, height: photo.width || 1000 };
  }
  return { width: photo.width || 1000, height: photo.height || 1000 };
}

