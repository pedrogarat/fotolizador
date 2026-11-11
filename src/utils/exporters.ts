import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { jsPDF } from 'jspdf';
import { DocumentSettings, PhotoItem, PlannedPage } from '../types';
import { ProcessedImagePayload, resizePhotoForExport } from './imageProcessor';
import {
  getPageDimensionsMm,
  MM_TO_DXA,
  MM_TO_PX_96DPI,
  TEMPLATE_METRICS,
} from './organizePhotos';

export interface ExportProgress {
  current: number;
  total: number;
  stage: string;
}

function sanitizeFilename(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_');
  return cleaned || 'FotoPrint_Documento';
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function prepareResizedImages(
  pages: PlannedPage[],
  settings: DocumentSettings,
  onProgress?: (progress: ExportProgress) => void
): Promise<Map<string, ProcessedImagePayload>> {
  const uniquePhotos = new Map<string, PhotoItem>();
  for (const page of pages) {
    for (const block of page.blocks) {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          if (cell.photo && !uniquePhotos.has(cell.photo.id)) {
            uniquePhotos.set(cell.photo.id, cell.photo);
          }
        }
      }
    }
  }

  const cache = new Map<string, ProcessedImagePayload>();
  const list = Array.from(uniquePhotos.values());
  let idx = 0;

  for (const photo of list) {
    idx += 1;
    onProgress?.({
      current: idx,
      total: list.length,
      stage: `Redimensionando fotos (${idx}/${list.length})...`,
    });
    const processed = await resizePhotoForExport(
      photo,
      settings.maxDimensionPx,
      settings.jpegQuality
    );
    cache.set(photo.id, processed);
  }

  return cache;
}

function buildDocxBorders(enabled: boolean) {
  const border = enabled
    ? { style: BorderStyle.SINGLE, size: 4, color: '000000' }
    : { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  };
}

function buildDocxHeader(settings: DocumentSettings): Header {
  return new Header({
    children: [
      new Paragraph({
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 4,
            space: 1,
            color: '000000',
          },
        },
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text: settings.title.trim() || 'TÍTULO',
            font: 'Arial',
            bold: true,
            size: 22, // 11pt
          }),
        ],
      }),
    ],
  });
}

function buildDocxFooter(settings: DocumentSettings): Footer | undefined {
  if (settings.footerLabel === 'none') {
    return undefined;
  }
  const word = settings.footerLabel === 'paxina' ? 'Páxina' : 'Página';
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: 240 },
        children: [
          new TextRun({
            text: `${word} `,
            font: 'Arial',
            size: 18, // 9pt
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Arial',
            bold: true,
            size: 18,
          }),
          new TextRun({
            text: ' de ',
            font: 'Arial',
            size: 18,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: 'Arial',
            bold: true,
            size: 18,
          }),
        ],
      }),
    ],
  });
}

export async function generateDocxBlob(
  pages: PlannedPage[],
  settings: DocumentSettings,
  imageCache: Map<string, ProcessedImagePayload>
): Promise<Blob> {
  const isLandscape = settings.orientation === 'landscape';
  const pageWidthDxa = isLandscape
    ? TEMPLATE_METRICS.a4HeightDxa
    : TEMPLATE_METRICS.a4WidthDxa;
  const pageHeightDxa = isLandscape
    ? TEMPLATE_METRICS.a4WidthDxa
    : TEMPLATE_METRICS.a4HeightDxa;

  const contentWidthDxa =
    pageWidthDxa - TEMPLATE_METRICS.marginLeftDxa - TEMPLATE_METRICS.marginRightDxa;

  const sectionChildren: Array<Paragraph | Table> = [];
  const tableBorders = buildDocxBorders(settings.showTableBorders);

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) {
      sectionChildren.push(
        new Paragraph({
          pageBreakBefore: true,
          spacing: { before: 0, after: 0, line: 20 },
          children: [],
        })
      );
    }

    page.blocks.forEach((block, blockIdx) => {
      if (block.groupLabel) {
        sectionChildren.push(
          new Paragraph({
            spacing: {
              before: blockIdx === 0 ? 0 : 120,
              after: 80,
              line: 240,
            },
            children: [
              new TextRun({
                text: block.groupLabel,
                font: 'Arial',
                bold: true,
                size: 20, // 10pt
                color: '1E293B',
              }),
            ],
          })
        );
      }

      const colCount = Math.max(1, block.rows[0]?.cells.length ?? settings.columns);
      const colWidthDxa = Math.floor(contentWidthDxa / colCount);
      const columnWidths = Array.from({ length: colCount }, () => colWidthDxa);

      const tableRows = block.rows.map((row) => {
        const rowHeightDxa = Math.max(800, Math.round(row.rowHeightMm * MM_TO_DXA));
        const cells = row.cells.map((cell) => {
          const cellParagraphs: Paragraph[] = [];

          if (cell.photo && cell.imageSizeMm) {
            const payload = imageCache.get(cell.photo.id);
            if (payload) {
              const widthPx = Math.max(10, Math.round(cell.imageSizeMm.widthMm * MM_TO_PX_96DPI));
              const heightPx = Math.max(10, Math.round(cell.imageSizeMm.heightMm * MM_TO_PX_96DPI));

              cellParagraphs.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 40, after: cell.caption ? 40 : 40, line: 240 },
                  children: [
                    new ImageRun({
                      type: 'jpg',
                      data: payload.bytes,
                      transformation: {
                        width: widthPx,
                        height: heightPx,
                      },
                    }),
                  ],
                })
              );
            }

            if (cell.caption) {
              cellParagraphs.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 40, line: 240 },
                  children: [
                    new TextRun({
                      text: cell.caption,
                      font: 'Arial',
                      italics: true,
                      size: 18, // 9pt matching PLANTILLA.docx
                    }),
                  ],
                })
              );
            }
          } else {
            cellParagraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [],
              })
            );
          }

          return new TableCell({
            width: { size: colWidthDxa, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: {
              top: 40,
              bottom: 40,
              left: 108,
              right: 108,
            },
            children: cellParagraphs,
          });
        });

        return new TableRow({
          cantSplit: true,
          height: { value: rowHeightDxa, rule: HeightRule.ATLEAST },
          children: cells,
        });
      });

      sectionChildren.push(
        new Table({
          width: { size: colWidthDxa * colCount, type: WidthType.DXA },
          columnWidths,
          borders: tableBorders,
          rows: tableRows,
        })
      );
    });
  });

  const footer = buildDocxFooter(settings);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidthDxa,
              height: pageHeightDxa,
              orientation: isLandscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: {
              top: TEMPLATE_METRICS.marginTopDxa,
              right: TEMPLATE_METRICS.marginRightDxa,
              bottom: TEMPLATE_METRICS.marginBottomDxa,
              left: TEMPLATE_METRICS.marginLeftDxa,
              header: TEMPLATE_METRICS.headerDxa,
              footer: TEMPLATE_METRICS.footerDxa,
            },
          },
        },
        headers: {
          default: buildDocxHeader(settings),
        },
        footers: footer ? { default: footer } : undefined,
        children: sectionChildren,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function generatePdfBlob(
  pages: PlannedPage[],
  settings: DocumentSettings,
  imageCache: Map<string, ProcessedImagePayload>
): Promise<Blob> {
  const dims = getPageDimensionsMm(settings.orientation);
  const pdf = new jsPDF({
    orientation: settings.orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const headerY = TEMPLATE_METRICS.headerDxa * (25.4 / 1440);
  const footerBaselineY =
    dims.pageHeightMm - TEMPLATE_METRICS.footerDxa * (25.4 / 1440) + 2;

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) {
      pdf.addPage('a4', settings.orientation);
    }

    // Header matching PLANTILLA.docx (Arial 11pt Bold + 0.5pt bottom rule)
    const headerBaselineY = headerY + 4.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(settings.title.trim() || 'TÍTULO', dims.marginLeftMm, headerBaselineY);

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(
      dims.marginLeftMm,
      headerBaselineY + 1.5,
      dims.pageWidthMm - dims.marginRightMm,
      headerBaselineY + 1.5
    );

    // Body blocks
    let cursorY = dims.marginTopMm;

    for (const block of page.blocks) {
      if (block.groupLabel) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59);
        pdf.text(block.groupLabel, dims.marginLeftMm, cursorY + 5);
        cursorY += TEMPLATE_METRICS.groupHeaderHeightMm;
      }

      for (const row of block.rows) {
        const colCount = Math.max(1, row.cells.length);
        const colW = dims.contentWidthMm / colCount;
        const rowH = row.rowHeightMm;

        row.cells.forEach((cell, colIdx) => {
          const cellX = dims.marginLeftMm + colIdx * colW;

          if (settings.showTableBorders) {
            pdf.setDrawColor(0, 0, 0);
            pdf.setLineWidth(0.18);
            pdf.rect(cellX, cursorY, colW, rowH);
          }

          if (cell.photo && cell.imageSizeMm) {
            const payload = imageCache.get(cell.photo.id);
            const { widthMm, heightMm } = cell.imageSizeMm;
            const captionH = cell.caption ? 5.5 : 0;
            const totalContentH = heightMm + captionH;
            const startY = cursorY + Math.max(1.5, (rowH - totalContentH) / 2);
            const imgX = cellX + (colW - widthMm) / 2;

            if (payload) {
              pdf.addImage(
                payload.dataUrl,
                'JPEG',
                imgX,
                startY,
                widthMm,
                heightMm,
                undefined,
                'MEDIUM'
              );
            }

            if (cell.caption) {
              pdf.setFont('helvetica', 'italic');
              pdf.setFontSize(9);
              pdf.setTextColor(0, 0, 0);
              const captionY = startY + heightMm + 4;
              const clipped = pdf.splitTextToSize(cell.caption, colW - 4)[0] ?? cell.caption;
              pdf.text(clipped, cellX + colW / 2, captionY, { align: 'center' });
            }
          }
        });

        cursorY += rowH;
      }

      cursorY += 2.5;
    }

    // Footer matching PLANTILLA.docx: "Páxina X de Y" (bold numbers)
    if (settings.footerLabel !== 'none') {
      const word = settings.footerLabel === 'paxina' ? 'Páxina' : 'Página';
      const numStr = String(page.pageNumber);
      const totalStr = String(page.totalPages);

      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);

      pdf.setFont('helvetica', 'normal');
      const prefixW = pdf.getTextWidth(`${word} `);
      const midW = pdf.getTextWidth(' de ');
      pdf.setFont('helvetica', 'bold');
      const numW = pdf.getTextWidth(numStr);
      const totalW = pdf.getTextWidth(totalStr);

      const fullW = prefixW + numW + midW + totalW;
      let x = dims.pageWidthMm / 2 - fullW / 2;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`${word} `, x, footerBaselineY);
      x += prefixW;

      pdf.setFont('helvetica', 'bold');
      pdf.text(numStr, x, footerBaselineY);
      x += numW;

      pdf.setFont('helvetica', 'normal');
      pdf.text(' de ', x, footerBaselineY);
      x += midW;

      pdf.setFont('helvetica', 'bold');
      pdf.text(totalStr, x, footerBaselineY);
    }
  });

  return pdf.output('blob');
}

export async function exportDocument(
  format: 'docx' | 'pdf' | 'both',
  pages: PlannedPage[],
  settings: DocumentSettings,
  onProgress?: (progress: ExportProgress) => void
): Promise<{ docxBytes?: number; pdfBytes?: number }> {
  const cache = await prepareResizedImages(pages, settings, onProgress);
  const baseName = sanitizeFilename(settings.title);
  const result: { docxBytes?: number; pdfBytes?: number } = {};

  if (format === 'docx' || format === 'both') {
    onProgress?.({ current: 1, total: 1, stage: 'Generando archivo DOCX...' });
    const docxBlob = await generateDocxBlob(pages, settings, cache);
    result.docxBytes = docxBlob.size;
    triggerDownload(docxBlob, `${baseName}.docx`);
  }

  if (format === 'pdf' || format === 'both') {
    // Pass through the exact DOCX template model first, then emit crisp PDF
    onProgress?.({
      current: 1,
      total: 1,
      stage: 'Maquetando desde plantilla DOCX a PDF...',
    });
    const pdfBlob = await generatePdfBlob(pages, settings, cache);
    result.pdfBytes = pdfBlob.size;
    triggerDownload(pdfBlob, `${baseName}.pdf`);
  }

  return result;
}

