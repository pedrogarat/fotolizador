import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DocumentSettings, PhotoItem } from '../types';
import { buildDocumentPages, groupPhotos, sortPhotos } from './organizePhotos';
import { buildPhotoCaption } from './formatters';
import { generateDocxBlob, generatePdfBlob } from './exporters';

function makePhoto(overrides: Partial<PhotoItem> & { id: string; name: string }): PhotoItem {
  return {
    size: 500_000,
    type: 'image/jpeg',
    width: 1600,
    height: 1200,
    captureDate: new Date(2026, 10, 11, 10, 0).getTime(),
    modifiedDate: new Date(2026, 10, 11, 12, 0).getTime(),
    addedAt: 1000,
    manualOrder: 0,
    rotation: 0,
    customCaption: '',
    thumbnailUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/',
    blob: new Blob(['dummy'], { type: 'image/jpeg' }),
    ...overrides,
  };
}

describe('sortPhotos & groupPhotos', () => {
  const p1 = makePhoto({
    id: '1',
    name: 'Obra_10.jpg',
    captureDate: new Date(2026, 0, 15).getTime(),
    modifiedDate: new Date(2026, 1, 1).getTime(),
    size: 300,
    manualOrder: 2,
  });
  const p2 = makePhoto({
    id: '2',
    name: 'Obra_2.jpg',
    captureDate: new Date(2025, 11, 20).getTime(),
    modifiedDate: new Date(2026, 0, 5).getTime(),
    size: 100,
    manualOrder: 0,
  });
  const p3 = makePhoto({
    id: '3',
    name: 'Calle_1.jpg',
    captureDate: new Date(2026, 0, 20).getTime(),
    modifiedDate: new Date(2026, 2, 10).getTime(),
    size: 200,
    manualOrder: 1,
  });

  it('sorts naturally by filename ascending and descending', () => {
    const asc = sortPhotos([p1, p2, p3], {
      ...DEFAULT_SETTINGS,
      sortField: 'name',
      sortDirection: 'asc',
    });
    expect(asc.map((p) => p.name)).toEqual(['Calle_1.jpg', 'Obra_2.jpg', 'Obra_10.jpg']);

    const desc = sortPhotos([p1, p2, p3], {
      ...DEFAULT_SETTINGS,
      sortField: 'name',
      sortDirection: 'desc',
    });
    expect(desc.map((p) => p.name)).toEqual(['Obra_10.jpg', 'Obra_2.jpg', 'Calle_1.jpg']);
  });

  it('sorts by captureDate and manualOrder', () => {
    const byCapture = sortPhotos([p1, p2, p3], {
      ...DEFAULT_SETTINGS,
      sortField: 'captureDate',
      sortDirection: 'asc',
    });
    expect(byCapture.map((p) => p.id)).toEqual(['2', '1', '3']);

    const byManual = sortPhotos([p1, p2, p3], {
      ...DEFAULT_SETTINGS,
      sortField: 'manual',
    });
    expect(byManual.map((p) => p.id)).toEqual(['2', '3', '1']);
  });

  it('groups by month, year, and name prefix', () => {
    const byMonth = groupPhotos([p2, p1, p3], { ...DEFAULT_SETTINGS, groupBy: 'month' });
    expect(byMonth.map((g) => g.label)).toEqual(['Diciembre 2025', 'Enero 2026']);
    expect(byMonth[1].photos).toHaveLength(2);

    const byYear = groupPhotos([p2, p1, p3], { ...DEFAULT_SETTINGS, groupBy: 'year' });
    expect(byYear.map((g) => g.label)).toEqual(['Año 2025', 'Año 2026']);

    const byPrefix = groupPhotos([p1, p2, p3], { ...DEFAULT_SETTINGS, groupBy: 'namePrefix' });
    expect(byPrefix.map((g) => g.label)).toEqual(['OBRA', 'CALLE']);
  });
});

describe('buildPhotoCaption & buildDocumentPages', () => {
  it('formats captions matching PLANTILLA.docx and supports overrides', () => {
    const photo = makePhoto({
      id: 'a',
      name: 'Foto_prueba.jpg',
      captureDate: new Date(2026, 4, 7, 14, 30).getTime(),
    });

    expect(buildPhotoCaption(photo, DEFAULT_SETTINGS, 1)).toBe('Fecha: 07/05/26');

    expect(
      buildPhotoCaption(
        photo,
        { ...DEFAULT_SETTINGS, captionMode: 'fileNameNoExt' },
        1
      )
    ).toBe('Foto_prueba');

    expect(
      buildPhotoCaption(
        photo,
        { ...DEFAULT_SETTINGS, captionMode: 'customTemplate', captionTemplate: '#{indice} {nombre}' },
        3
      )
    ).toBe('#3 Foto_prueba');

    expect(
      buildPhotoCaption(
        { ...photo, customCaption: 'Fachada norte' },
        DEFAULT_SETTINGS,
        1
      )
    ).toBe('Fachada norte');

    expect(
      buildPhotoCaption(photo, { ...DEFAULT_SETTINGS, showCaption: false }, 1)
    ).toBe('');
  });

  it('paginates according to grid cols x rows and scales images preserving aspect ratio', () => {
    const photos = Array.from({ length: 7 }, (_, i) =>
      makePhoto({
        id: `p${i}`,
        name: `img_${i}.jpg`,
        width: 2000,
        height: 1000,
        manualOrder: i,
      })
    );

    const settings: DocumentSettings = {
      ...DEFAULT_SETTINGS,
      sortField: 'manual',
      columns: 2,
      rows: 3,
    };

    const pages = buildDocumentPages(photos, settings);
    expect(pages).toHaveLength(2);
    expect(pages[0].totalPages).toBe(2);
    expect(pages[0].blocks[0].rows).toHaveLength(3);
    expect(pages[1].blocks[0].rows).toHaveLength(1);

    const imgGeom = pages[0].blocks[0].rows[0].cells[0].imageSizeMm!;
    expect(imgGeom.widthMm / imgGeom.heightMm).toBeCloseTo(2, 1);

    // Changing grid to 3x3 fits all 7 photos on 1 page
    const pages3x3 = buildDocumentPages(photos, { ...settings, columns: 3, rows: 3 });
    expect(pages3x3).toHaveLength(1);
    expect(pages3x3[0].blocks[0].rows).toHaveLength(3);
  });
});

function readBlobAsUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

describe('DOCX & PDF export generation', () => {
  it('generates valid DOCX and PDF blobs from the planned pages', async () => {
    // Minimal 1x1 valid JPEG bytes
    const tinyJpegBase64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const raw = atob(tinyJpegBase64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const photo = makePhoto({ id: 'p1', name: 'test.jpg' });
    const pages = buildDocumentPages([photo], {
      ...DEFAULT_SETTINGS,
      title: 'INFORME PRUEBA',
    });

    const cache = new Map([
      [
        'p1',
        {
          bytes,
          dataUrl: `data:image/jpeg;base64,${tinyJpegBase64}`,
          width: 1,
          height: 1,
        },
      ],
    ]);

    const docxBlob = await generateDocxBlob(pages, { ...DEFAULT_SETTINGS, title: 'INFORME PRUEBA' }, cache);
    expect(docxBlob.size).toBeGreaterThan(1500);
    const docxBytes = await readBlobAsUint8Array(docxBlob);
    // ZIP magic bytes 'PK'
    expect(String.fromCharCode(docxBytes[0], docxBytes[1])).toBe('PK');

    const pdfBlob = await generatePdfBlob(pages, { ...DEFAULT_SETTINGS, title: 'INFORME PRUEBA' }, cache);
    expect(pdfBlob.size).toBeGreaterThan(500);
    const pdfBytes = await readBlobAsUint8Array(pdfBlob);
    const pdfHeader = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(pdfHeader).toBe('%PDF-');
  });
});
