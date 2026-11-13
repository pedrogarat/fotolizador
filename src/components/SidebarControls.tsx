import React from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Captions,
  Download,
  FileCode2,
  FileText,
  FolderTree,
  Grid,
  Minimize2,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  CaptionMode,
  DateFormatStyle,
  DEFAULT_SETTINGS,
  DocumentSettings,
  FooterLabelMode,
  GroupBy,
  RESIZE_PRESETS,
  ResizePreset,
  SortField,
} from '../types';
import { formatBytes } from '../utils/formatters';

interface SidebarControlsProps {
  settings: DocumentSettings;
  onChange: (patch: Partial<DocumentSettings>) => void;
  totalOriginalBytes: number;
  totalEstimatedBytes: number;
  photoCount: number;
  pageCount: number;
  onExportFot: () => void;
  onTriggerImportFot: () => void;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  settings,
  onChange,
  totalOriginalBytes,
  totalEstimatedBytes,
  photoCount,
  pageCount,
  onExportFot,
  onTriggerImportFot,
}) => {
  const handlePresetChange = (preset: ResizePreset) => {
    if (preset === 'custom') {
      onChange({ resizePreset: 'custom' });
      return;
    }
    const cfg = RESIZE_PRESETS[preset];
    onChange({
      resizePreset: preset,
      maxDimensionPx: cfg.maxDimensionPx,
      jpegQuality: cfg.jpegQuality,
    });
  };

  const appendTemplateToken = (token: string) => {
    const current = settings.captionTemplate;
    const spacer = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
    onChange({ captionTemplate: `${current}${spacer}${token}` });
  };

  const savingsPct =
    totalOriginalBytes > 0
      ? Math.max(0, Math.round((1 - totalEstimatedBytes / totalOriginalBytes) * 100))
      : 0;

  return (
    <aside className="w-full lg:w-84 xl:w-92 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Configuración de plantilla</h2>
          <p className="text-xs text-slate-500">
            Basado en <span className="font-mono text-slate-700">PLANTILLA.docx</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_SETTINGS)}
          title="Restaurar valores de plantilla"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md hover:bg-slate-100 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar
        </button>
      </div>

      {/* Proyecto .fot: Guardar y Cargar configuración */}
      <div className="p-4 bg-slate-50/90 border-b border-slate-200">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
            <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
            Proyecto (.fot)
          </div>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
            Ligero
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Guarda o reanuda la plantilla, orden, rotaciones y pies de foto en un archivo de configuración <span className="font-mono font-semibold text-slate-700">.fot</span> (sin imágenes, &lt; 20 KB).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onExportFot}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-xs font-semibold text-slate-700 hover:text-indigo-700 shadow-2xs transition cursor-pointer"
            title="Guardar archivo .fot de este montaje"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            Guardar .fot
          </button>
          <button
            type="button"
            onClick={onTriggerImportFot}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-xs font-semibold text-slate-700 hover:text-indigo-700 shadow-2xs transition cursor-pointer"
            title="Cargar un archivo .fot existente"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            Cargar .fot
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5 text-sm">
        {/* 1. Título y Página */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            Título y página
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Título del encabezado
            </label>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Ej. Informe fotográfico obra..."
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Orientación A4
              </label>
              <select
                value={settings.orientation}
                onChange={(e) =>
                  onChange({ orientation: e.target.value as 'portrait' | 'landscape' })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="portrait">Vertical</option>
                <option value="landscape">Horizontal</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pie de página
              </label>
              <select
                value={settings.footerLabel}
                onChange={(e) =>
                  onChange({ footerLabel: e.target.value as FooterLabelMode })
                }
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="paxina">Páxina X de Y</option>
                <option value="pagina">Página X de Y</option>
                <option value="none">Sin numeración</option>
              </select>
            </div>
          </div>
        </section>

        <hr className="border-slate-100" />

        {/* 2. Cuadrícula */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Grid className="w-3.5 h-3.5 text-indigo-600" />
              Cuadrícula (Grid)
            </div>
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {settings.columns * settings.rows} fotos/pág
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Columnas</span>
                <span className="font-bold text-slate-900">{settings.columns}</span>
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={settings.columns}
                onChange={(e) => onChange({ columns: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Filas</span>
                <span className="font-bold text-slate-900">{settings.rows}</span>
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={settings.rows}
                onChange={(e) => onChange({ rows: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <label className="flex items-center justify-between cursor-pointer select-none pt-0.5">
            <span className="text-xs text-slate-700">Mostrar bordes de cuadrícula</span>
            <input
              type="checkbox"
              checked={settings.showTableBorders}
              onChange={(e) => onChange({ showTableBorders: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </section>

        <hr className="border-slate-100" />

        {/* 3. Orden y agrupación */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
            Orden y agrupación
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ordenar por
              </label>
              <select
                value={settings.sortField}
                onChange={(e) => onChange({ sortField: e.target.value as SortField })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="captureDate">Fecha de captura (EXIF)</option>
                <option value="modifiedDate">Fecha de modificación</option>
                <option value="name">Nombre de archivo</option>
                <option value="size">Tamaño de archivo</option>
                <option value="manual">Orden manual (arrastrar)</option>
              </select>
            </div>

            {settings.sortField !== 'manual' && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    sortDirection: settings.sortDirection === 'asc' ? 'desc' : 'asc',
                  })
                }
                title={
                  settings.sortDirection === 'asc'
                    ? 'Orden ascendente'
                    : 'Orden descendente'
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                {settings.sortDirection === 'asc' ? (
                  <>
                    <ArrowUpAZ className="w-4 h-4 text-indigo-600" />
                    Asc
                  </>
                ) : (
                  <>
                    <ArrowDownAZ className="w-4 h-4 text-indigo-600" />
                    Desc
                  </>
                )}
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Agrupar por
            </label>
            <select
              value={settings.groupBy}
              onChange={(e) => onChange({ groupBy: e.target.value as GroupBy })}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="none">Sin agrupar (continuo)</option>
              <option value="month">Por mes</option>
              <option value="year">Por año</option>
              <option value="namePrefix">Por prefijo de nombre</option>
              <option value="nameInitial">Por inicial del nombre</option>
            </select>
          </div>

          {settings.groupBy !== 'none' && (
            <label className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-xs text-slate-700">Nueva página por cada grupo</span>
              <input
                type="checkbox"
                checked={settings.groupPageBreak}
                onChange={(e) => onChange({ groupPageBreak: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* 4. Pie de foto */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Captions className="w-3.5 h-3.5 text-indigo-600" />
              Pie de foto
            </div>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showCaption}
                onChange={(e) => onChange({ showCaption: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-medium text-slate-700">Mostrar</span>
            </label>
          </div>

          {settings.showCaption && (
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contenido del pie de foto
                </label>
                <select
                  value={settings.captionMode}
                  onChange={(e) => onChange({ captionMode: e.target.value as CaptionMode })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="captureDate">Fecha de captura (Fecha: dd/mm/aa)</option>
                  <option value="modifiedDate">Fecha de modificación</option>
                  <option value="fileName">Nombre de archivo (con extensión)</option>
                  <option value="fileNameNoExt">Nombre sin extensión</option>
                  <option value="customTemplate">Personalizado (plantilla)</option>
                </select>
              </div>

              {(settings.captionMode === 'captureDate' ||
                settings.captionMode === 'modifiedDate' ||
                settings.captionMode === 'customTemplate') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Formato de fecha
                  </label>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) =>
                      onChange({ dateFormat: e.target.value as DateFormatStyle })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="short">Corta (dd/mm/aa) · como plantilla</option>
                    <option value="long">Completa (dd/mm/aaaa)</option>
                    <option value="shortWithTime">Con hora (dd/mm/aa HH:MM)</option>
                  </select>
                </div>
              )}

              {settings.captionMode === 'customTemplate' && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={settings.captionTemplate}
                    onChange={(e) => onChange({ captionTemplate: e.target.value })}
                    placeholder="Ej. Foto {indice} - {fecha}"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {['{fecha}', '{hora}', '{nombre}', '{indice}'].map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => appendTemplateToken(tok)}
                        className="text-[11px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-1.5 py-0.5 rounded transition font-mono"
                      >
                        +{tok}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                También puedes editar el pie individual de cualquier foto desde su miniatura.
              </p>
            </div>
          )}
        </section>

        <hr className="border-slate-100" />

        {/* 5. Redimensionado / Optimización */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Minimize2 className="w-3.5 h-3.5 text-indigo-600" />
            Redimensión y peso
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {(['light', 'balanced', 'high', 'custom'] as ResizePreset[]).map((preset) => {
              const active = settings.resizePreset === preset;
              const label =
                preset === 'custom' ? 'Personalizado' : RESIZE_PRESETS[preset].label;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetChange(preset)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition ${
                    active
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200/70">
            <div>
              <label className="flex justify-between text-xs text-slate-700 mb-0.5">
                <span>Lado máximo</span>
                <span className="font-mono font-semibold">{settings.maxDimensionPx} px</span>
              </label>
              <input
                type="range"
                min={400}
                max={2400}
                step={100}
                value={settings.maxDimensionPx}
                onChange={(e) =>
                  onChange({
                    resizePreset: 'custom',
                    maxDimensionPx: Number(e.target.value),
                  })
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="flex justify-between text-xs text-slate-700 mb-0.5">
                <span>Calidad JPEG</span>
                <span className="font-mono font-semibold">
                  {Math.round(settings.jpegQuality * 100)}%
                </span>
              </label>
              <input
                type="range"
                min={45}
                max={95}
                step={5}
                value={Math.round(settings.jpegQuality * 100)}
                onChange={(e) =>
                  onChange({
                    resizePreset: 'custom',
                    jpegQuality: Number(e.target.value) / 100,
                  })
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          {photoCount > 0 && (
            <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 px-3 py-2 text-xs text-emerald-900 space-y-0.5">
              <div className="flex justify-between">
                <span>Original ({photoCount} fotos):</span>
                <span className="font-mono line-through text-emerald-700">
                  {formatBytes(totalOriginalBytes)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Estimado optimizado:</span>
                <span className="font-mono">
                  ~{formatBytes(totalEstimatedBytes)} (-{savingsPct}%)
                </span>
              </div>
              <div className="text-[11px] text-emerald-700 pt-0.5">
                {pageCount} {pageCount === 1 ? 'página A4' : 'páginas A4'} en el documento
              </div>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};

