import React, { useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { DocumentSettings, PlannedPage } from '../types';
import { DXA_TO_MM, getPageDimensionsMm, TEMPLATE_METRICS } from '../utils/organizePhotos';

interface DocumentPreviewViewProps {
  pages: PlannedPage[];
  settings: DocumentSettings;
}

export const DocumentPreviewView: React.FC<DocumentPreviewViewProps> = ({
  pages,
  settings,
}) => {
  const dims = getPageDimensionsMm(settings.orientation);
  const [zoom, setZoom] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const targetPx = Math.max(260, window.innerWidth - 36);
      const pagePxAt100 = dims.pageWidthMm * 3.7795275591;
      return Math.max(0.32, Math.min(0.85, Number((targetPx / pagePxAt100).toFixed(2))));
    }
    return 0.85;
  });
  const headerTopMm = TEMPLATE_METRICS.headerDxa * DXA_TO_MM;
  const footerBottomMm = TEMPLATE_METRICS.footerDxa * DXA_TO_MM;

  // Convert mm to CSS px at 96dpi * zoom (1mm ≈ 3.7795px)
  const mmToPx = (mm: number) => mm * 3.7795275591 * zoom;

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Zoom controls */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs">
        <span className="text-xs text-slate-600">
          Vista previa exacta A4 ({settings.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} ·{' '}
          <strong>
            {settings.columns}×{settings.rows}
          </strong>{' '}
          · {pages.length} {pages.length === 1 ? 'página' : 'páginas'})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            title="Alejar"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono w-12 text-center text-slate-700">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            title="Acercar"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pages stack */}
      <div className="flex flex-col items-center gap-6 pb-8 overflow-x-auto">
        {pages.map((page) => (
          <div
            key={page.pageNumber}
            style={{
              width: mmToPx(dims.pageWidthMm),
              height: mmToPx(dims.pageHeightMm),
              paddingTop: mmToPx(dims.marginTopMm),
              paddingBottom: mmToPx(dims.marginBottomMm),
              paddingLeft: mmToPx(dims.marginLeftMm),
              paddingRight: mmToPx(dims.marginRightMm),
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
            className="relative bg-white shadow-md ring-1 ring-slate-200 shrink-0 select-none overflow-hidden"
          >
            {/* Header matching PLANTILLA.docx */}
            <div
              style={{
                top: mmToPx(headerTopMm),
                left: mmToPx(dims.marginLeftMm),
                right: mmToPx(dims.marginRightMm),
                fontSize: `${11 * zoom}pt`,
              }}
              className="absolute border-b border-black font-bold text-black pb-0.5 leading-tight truncate"
            >
              {settings.title.trim() || 'TÍTULO'}
            </div>

            {/* Body blocks */}
            <div className="w-full h-full flex flex-col">
              {page.blocks.map((block, bIdx) => (
                <div key={bIdx} className={bIdx > 0 ? 'mt-1.5' : ''}>
                  {block.groupLabel && (
                    <div
                      style={{
                        height: mmToPx(TEMPLATE_METRICS.groupHeaderHeightMm),
                        fontSize: `${10 * zoom}pt`,
                      }}
                      className="font-bold text-slate-800 flex items-center"
                    >
                      {block.groupLabel}
                    </div>
                  )}

                  <table
                    style={{
                      width: mmToPx(dims.contentWidthMm),
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                    }}
                  >
                    <tbody>
                      {block.rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ height: mmToPx(row.rowHeightMm) }}>
                          {row.cells.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              style={{
                                width: mmToPx(block.colWidthMm),
                                height: mmToPx(row.rowHeightMm),
                                border: settings.showTableBorders
                                  ? '1px solid #000'
                                  : '1px dashed #e2e8f0',
                                verticalAlign: 'middle',
                                textAlign: 'center',
                                padding: `${mmToPx(1)}px ${mmToPx(1.8)}px`,
                              }}
                            >
                              {cell.photo && cell.imageSizeMm && (
                                <div className="flex flex-col items-center justify-center w-full h-full">
                                  <img
                                    src={cell.photo.thumbnailUrl}
                                    alt={cell.photo.name}
                                    style={{
                                      width: mmToPx(cell.imageSizeMm.widthMm),
                                      height: mmToPx(cell.imageSizeMm.heightMm),
                                      objectFit: 'contain',
                                    }}
                                  />
                                  {cell.caption && (
                                    <div
                                      style={{
                                        fontSize: `${9 * zoom}pt`,
                                        marginTop: mmToPx(1),
                                      }}
                                      className="italic text-black leading-tight max-w-full truncate"
                                    >
                                      {cell.caption}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Footer matching PLANTILLA.docx */}
            {settings.footerLabel !== 'none' && (
              <div
                style={{
                  bottom: mmToPx(footerBottomMm - 1.5),
                  left: mmToPx(dims.marginLeftMm),
                  right: mmToPx(dims.marginRightMm),
                  fontSize: `${9 * zoom}pt`,
                }}
                className="absolute text-center text-black"
              >
                {settings.footerLabel === 'paxina' ? 'Páxina' : 'Página'}{' '}
                <strong className="font-bold">{page.pageNumber}</strong> de{' '}
                <strong className="font-bold">{page.totalPages}</strong>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

