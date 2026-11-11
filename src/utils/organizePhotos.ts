import {
  CellImageGeometry,
  DocumentSettings,
  PhotoGroup,
  PhotoItem,
  PlannedCell,
  PlannedPage,
  PlannedRow,
} from '../types';
import {
  buildPhotoCaption,
  getEffectiveDimensions,
  getEffectiveTimestamp,
  getMonthGroupInfo,
  getNamePrefix,
  getYearGroupInfo,
} from './formatters';

/**
 * Exact page geometry derived from PLANTILLA.docx:
 * - A4: 11906 x 16838 dxa (210mm x 297mm)
 * - Margins: top 1418 dxa (25.01mm), bottom 851 dxa (15.01mm),
 *   left/right 1080 dxa (19.05mm), header/footer 708 dxa (12.49mm)
 * - 1 inch = 1440 dxa = 25.4 mm -> 1 dxa = 25.4 / 1440 mm
 */
export const DXA_TO_MM = 25.4 / 1440;
export const MM_TO_DXA = 1440 / 25.4;
export const MM_TO_PX_96DPI = 96 / 25.4;

export const TEMPLATE_METRICS = {
  a4WidthDxa: 11906,
  a4HeightDxa: 16838,
  marginTopDxa: 1418,
  marginBottomDxa: 851,
  marginLeftDxa: 1080,
  marginRightDxa: 1080,
  headerDxa: 708,
  footerDxa: 708,
  cellPaddingHorizontalMm: 2.2,
  cellPaddingVerticalMm: 2.2,
  captionReserveMm: 7.5,
  groupHeaderHeightMm: 9.5,
};

const nameCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export function sortPhotos(photos: PhotoItem[], settings: DocumentSettings): PhotoItem[] {
  const cloned = [...photos];
  const factor = settings.sortDirection === 'asc' ? 1 : -1;

  cloned.sort((a, b) => {
    let cmp = 0;
    switch (settings.sortField) {
      case 'captureDate': {
        cmp = getEffectiveTimestamp(a, true) - getEffectiveTimestamp(b, true);
        break;
      }
      case 'modifiedDate': {
        cmp = a.modifiedDate - b.modifiedDate;
        break;
      }
      case 'name': {
        cmp = nameCollator.compare(a.name, b.name);
        break;
      }
      case 'size': {
        cmp = a.size - b.size;
        break;
      }
      case 'manual': {
        return a.manualOrder - b.manualOrder;
      }
    }
    if (cmp === 0) {
      cmp = nameCollator.compare(a.name, b.name);
    }
    return cmp * factor;
  });

  return cloned;
}

export function groupPhotos(sortedPhotos: PhotoItem[], settings: DocumentSettings): PhotoGroup[] {
  if (settings.groupBy === 'none') {
    return [
      {
        key: 'all',
        label: '',
        photos: sortedPhotos,
      },
    ];
  }

  const groupMap = new Map<string, PhotoGroup>();

  for (const photo of sortedPhotos) {
    let key = 'all';
    let label = '';

    if (settings.groupBy === 'month') {
      const info = getMonthGroupInfo(getEffectiveTimestamp(photo, true));
      key = info.key;
      label = info.label;
    } else if (settings.groupBy === 'year') {
      const info = getYearGroupInfo(getEffectiveTimestamp(photo, true));
      key = info.key;
      label = info.label;
    } else if (settings.groupBy === 'nameInitial') {
      const firstChar = photo.name.trim().charAt(0).toUpperCase() || '#';
      const normalized = /[A-ZÁÉÍÓÚÑ0-9]/i.test(firstChar) ? firstChar : '#';
      key = normalized;
      label = `Grupo "${normalized}"`;
    } else if (settings.groupBy === 'namePrefix') {
      const prefix = getNamePrefix(photo.name);
      key = prefix;
      label = prefix;
    }

    const existing = groupMap.get(key);
    if (existing) {
      existing.photos.push(photo);
    } else {
      groupMap.set(key, { key, label, photos: [photo] });
    }
  }

  return Array.from(groupMap.values());
}

export function getPageDimensionsMm(orientation: DocumentSettings['orientation']): {
  pageWidthMm: number;
  pageHeightMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
} {
  const portraitW = TEMPLATE_METRICS.a4WidthDxa * DXA_TO_MM;
  const portraitH = TEMPLATE_METRICS.a4HeightDxa * DXA_TO_MM;
  const pageWidthMm = orientation === 'portrait' ? portraitW : portraitH;
  const pageHeightMm = orientation === 'portrait' ? portraitH : portraitW;

  const marginTopMm = TEMPLATE_METRICS.marginTopDxa * DXA_TO_MM;
  const marginBottomMm = TEMPLATE_METRICS.marginBottomDxa * DXA_TO_MM;
  const marginLeftMm = TEMPLATE_METRICS.marginLeftDxa * DXA_TO_MM;
  const marginRightMm = TEMPLATE_METRICS.marginRightDxa * DXA_TO_MM;

  return {
    pageWidthMm,
    pageHeightMm,
    contentWidthMm: pageWidthMm - marginLeftMm - marginRightMm,
    contentHeightMm: pageHeightMm - marginTopMm - marginBottomMm - 4, // safety margin matching Word line pitch
    marginTopMm,
    marginBottomMm,
    marginLeftMm,
    marginRightMm,
  };
}

export function fitImageInBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidthMm: number,
  maxHeightMm: number
): CellImageGeometry {
  const safeW = Math.max(1, naturalWidth);
  const safeH = Math.max(1, naturalHeight);
  const scale = Math.min(maxWidthMm / safeW, maxHeightMm / safeH);
  return {
    widthMm: Number((safeW * scale).toFixed(2)),
    heightMm: Number((safeH * scale).toFixed(2)),
  };
}

export function buildDocumentPages(
  photos: PhotoItem[],
  settings: DocumentSettings
): PlannedPage[] {
  if (photos.length === 0) {
    return [];
  }

  const cols = Math.max(1, Math.min(6, Math.round(settings.columns)));
  const rowsPerPage = Math.max(1, Math.min(6, Math.round(settings.rows)));

  const sorted = sortPhotos(photos, settings);
  const groups = groupPhotos(sorted, settings);
  const dims = getPageDimensionsMm(settings.orientation);

  const colWidthMm = dims.contentWidthMm / cols;
  const baseRowHeightMm = dims.contentHeightMm / rowsPerPage;
  const captionSpaceMm = settings.showCaption ? TEMPLATE_METRICS.captionReserveMm : 0;

  const pages: PlannedPage[] = [];
  let globalIndex = 0;

  const createEmptyPage = (pageNum: number): PlannedPage => ({
    pageNumber: pageNum,
    totalPages: 0,
    blocks: [],
  });

  if (settings.groupBy === 'none' || settings.groupPageBreak) {
    for (const group of groups) {
      const groupHeadingReserve = group.label ? TEMPLATE_METRICS.groupHeaderHeightMm : 0;
      const availableFirstPageH = dims.contentHeightMm - groupHeadingReserve;
      const effectiveRowsFirstPage = Math.max(
        1,
        group.label ? Math.floor(availableFirstPageH / baseRowHeightMm) || 1 : rowsPerPage
      );

      let offset = 0;
      let isFirstPageOfGroup = true;

      while (offset < group.photos.length) {
        const rowsThisPage = isFirstPageOfGroup ? effectiveRowsFirstPage : rowsPerPage;
        const rowHeightMm = isFirstPageOfGroup && group.label
          ? availableFirstPageH / rowsThisPage
          : baseRowHeightMm;

        const maxImgW = Math.max(12, colWidthMm - TEMPLATE_METRICS.cellPaddingHorizontalMm * 2);
        const maxImgH = Math.max(
          12,
          rowHeightMm - TEMPLATE_METRICS.cellPaddingVerticalMm * 2 - captionSpaceMm
        );

        const pageRows: PlannedRow[] = [];
        for (let r = 0; r < rowsThisPage && offset < group.photos.length; r++) {
          const cells: PlannedCell[] = [];
          for (let c = 0; c < cols; c++) {
            const photo = offset < group.photos.length ? group.photos[offset] : null;
            if (photo) {
              globalIndex += 1;
              const { width, height } = getEffectiveDimensions(photo);
              cells.push({
                photo,
                caption: buildPhotoCaption(photo, settings, globalIndex),
                imageSizeMm: fitImageInBox(width, height, maxImgW, maxImgH),
                globalIndex,
              });
              offset += 1;
            } else {
              cells.push({
                photo: null,
                caption: '',
                imageSizeMm: null,
                globalIndex: 0,
              });
            }
          }
          pageRows.push({ cells, rowHeightMm });
        }

        const page = createEmptyPage(pages.length + 1);
        page.blocks.push({
          groupLabel: isFirstPageOfGroup && group.label ? group.label : null,
          rows: pageRows,
          colWidthMm,
        });
        pages.push(page);
        isFirstPageOfGroup = false;
      }
    }
  } else {
    // Inline flowing groups across pages without forcing page breaks between groups
    let currentPage = createEmptyPage(1);
    let remainingHeightMm = dims.contentHeightMm;

    const pushCurrentPage = () => {
      if (currentPage.blocks.length > 0) {
        pages.push(currentPage);
        currentPage = createEmptyPage(pages.length + 1);
        remainingHeightMm = dims.contentHeightMm;
      }
    };

    for (const group of groups) {
      const headingH = group.label ? TEMPLATE_METRICS.groupHeaderHeightMm : 0;
      if (remainingHeightMm < headingH + baseRowHeightMm * 0.85) {
        pushCurrentPage();
      }

      let offset = 0;
      let needGroupHeading = Boolean(group.label);

      while (offset < group.photos.length) {
        if (needGroupHeading && remainingHeightMm < headingH + baseRowHeightMm * 0.85) {
          pushCurrentPage();
        }
        if (!needGroupHeading && remainingHeightMm < baseRowHeightMm * 0.85) {
          pushCurrentPage();
        }

        const reservedHeading = needGroupHeading ? headingH : 0;
        const rowsThatFit = Math.max(
          1,
          Math.floor((remainingHeightMm - reservedHeading + 0.5) / baseRowHeightMm)
        );

        const maxImgW = Math.max(12, colWidthMm - TEMPLATE_METRICS.cellPaddingHorizontalMm * 2);
        const maxImgH = Math.max(
          12,
          baseRowHeightMm - TEMPLATE_METRICS.cellPaddingVerticalMm * 2 - captionSpaceMm
        );

        const blockRows: PlannedRow[] = [];
        for (let r = 0; r < rowsThatFit && offset < group.photos.length; r++) {
          const cells: PlannedCell[] = [];
          for (let c = 0; c < cols; c++) {
            const photo = offset < group.photos.length ? group.photos[offset] : null;
            if (photo) {
              globalIndex += 1;
              const { width, height } = getEffectiveDimensions(photo);
              cells.push({
                photo,
                caption: buildPhotoCaption(photo, settings, globalIndex),
                imageSizeMm: fitImageInBox(width, height, maxImgW, maxImgH),
                globalIndex,
              });
              offset += 1;
            } else {
              cells.push({
                photo: null,
                caption: '',
                imageSizeMm: null,
                globalIndex: 0,
              });
            }
          }
          blockRows.push({ cells, rowHeightMm: baseRowHeightMm });
        }

        const usedHeight = reservedHeading + blockRows.length * baseRowHeightMm;
        remainingHeightMm -= usedHeight;

        currentPage.blocks.push({
          groupLabel: needGroupHeading ? group.label : null,
          rows: blockRows,
          colWidthMm,
        });
        needGroupHeading = false;

        if (offset < group.photos.length) {
          pushCurrentPage();
        }
      }
    }

    if (currentPage.blocks.length > 0) {
      pages.push(currentPage);
    }
  }

  const totalPages = pages.length;
  for (const page of pages) {
    page.totalPages = totalPages;
  }

  return pages;
}
