import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  FileDown,
  FileText,
  Images,
  Loader2,
  Trash2,
} from 'lucide-react';
import { DocumentSettings, PhotoItem } from './types';
import {
  loadPhotosFromDb,
  loadSettingsFromStorage,
  savePhotosToDb,
  saveSettingsToStorage,
  clearPhotosDb,
} from './utils/storage';
import {
  createThumbnailDataUrl,
  estimateResizedBytes,
  importImageFile,
} from './utils/imageProcessor';
import { buildDocumentPages, groupPhotos, sortPhotos } from './utils/organizePhotos';
import { exportDocument, ExportProgress } from './utils/exporters';
import { formatBytes } from './utils/formatters';
import { SidebarControls } from './components/SidebarControls';
import { ImportProgress, PhotoDropzone } from './components/PhotoDropzone';
import { PhotoGridView } from './components/PhotoGridView';
import { DocumentPreviewView } from './components/DocumentPreviewView';

type ActiveTab = 'photos' | 'preview';

export function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [settings, setSettings] = useState<DocumentSettings>(() => loadSettingsFromStorage());
  const [isLoaded, setIsLoaded] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('photos');
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [globalDragActive, setGlobalDragActive] = useState(false);

  // Hydrate persisted photos from browser IndexedDB
  useEffect(() => {
    let active = true;
    loadPhotosFromDb().then((stored) => {
      if (active) {
        setPhotos(stored);
        setIsLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist settings in localStorage
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  // Persist photos in IndexedDB whenever they change after initial hydration
  useEffect(() => {
    if (!isLoaded) return;
    savePhotosToDb(photos).catch(() => {
      // Ignore transient storage errors
    });
  }, [photos, isLoaded]);

  const updateSettings = useCallback((patch: Partial<DocumentSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((current) => (current === msg ? null : current));
    }, 4500);
  }, []);

  const handleFilesSelected = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) {
        showToast('No se detectaron archivos de imagen válidos.');
        return;
      }

      setImportProgress({
        current: 0,
        total: files.length,
        fileName: files[0].name,
      });
      try {
        const baseOrder =
          photos.length > 0 ? Math.max(...photos.map((p) => p.manualOrder)) + 1 : 0;

        const imported: PhotoItem[] = [];
        for (let i = 0; i < files.length; i++) {
          setImportProgress({
            current: i + 1,
            total: files.length,
            fileName: files[i].name,
          });
          const item = await importImageFile(files[i], baseOrder + i);
          imported.push(item);
        }

        setPhotos((prev) => [...prev, ...imported]);
        showToast(
          `Se añadieron ${imported.length} ${imported.length === 1 ? 'foto' : 'fotos'}.`
        );
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Ocurrió un error al importar las fotos.'
        );
      } finally {
        setImportProgress(null);
      }
    },
    [photos, showToast]
  );

  const handleRotatePhoto = useCallback(async (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target) return prev;
      const nextRotation = ((target.rotation + 90) % 360) as 0 | 90 | 180 | 270;
      createThumbnailDataUrl(target.blob, nextRotation, 380).then(({ thumbnailUrl }) => {
        setPhotos((latest) =>
          latest.map((p) =>
            p.id === id ? { ...p, rotation: nextRotation, thumbnailUrl } : p
          )
        );
      });
      return prev.map((p) => (p.id === id ? { ...p, rotation: nextRotation } : p));
    });
  }, []);

  const handleDeletePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleUpdateCustomCaption = useCallback((id: string, customCaption: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, customCaption } : p))
    );
  }, []);

  const handleClearAll = useCallback(async () => {
    setPhotos([]);
    await clearPhotosDb();
    showToast('Se eliminaron todas las fotos del navegador.');
  }, [showToast]);

  const sorted = useMemo(() => sortPhotos(photos, settings), [photos, settings]);
  const groups = useMemo(() => groupPhotos(sorted, settings), [sorted, settings]);
  const pages = useMemo(() => buildDocumentPages(photos, settings), [photos, settings]);

  const handleReorderManual = useCallback(
    (draggedId: string, targetId: string) => {
      const currentOrderedIds = sorted.map((p) => p.id);
      const fromIdx = currentOrderedIds.indexOf(draggedId);
      const toIdx = currentOrderedIds.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      const reordered = [...currentOrderedIds];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);

      const orderMap = new Map<string, number>();
      reordered.forEach((id, idx) => orderMap.set(id, idx));

      setPhotos((prev) =>
        prev.map((p) => ({
          ...p,
          manualOrder: orderMap.get(p.id) ?? p.manualOrder,
        }))
      );
      if (settings.sortField !== 'manual') {
        updateSettings({ sortField: 'manual' });
        showToast('Orden cambiado a "Orden manual".');
      }
    },
    [sorted, settings.sortField, updateSettings, showToast]
  );

  const totalOriginalBytes = useMemo(
    () => photos.reduce((acc, p) => acc + p.size, 0),
    [photos]
  );

  const totalEstimatedBytes = useMemo(
    () =>
      photos.reduce(
        (acc, p) =>
          acc + estimateResizedBytes(p, settings.maxDimensionPx, settings.jpegQuality),
        0
      ),
    [photos, settings.maxDimensionPx, settings.jpegQuality]
  );

  const handleExport = async (format: 'docx' | 'pdf' | 'both') => {
    if (pages.length === 0 || exportProgress) return;
    try {
      setExportProgress({ current: 0, total: photos.length, stage: 'Preparando exportación...' });
      const res = await exportDocument(format, pages, settings, setExportProgress);
      const parts: string[] = [];
      if (res.docxBytes) parts.push(`DOCX (${formatBytes(res.docxBytes)})`);
      if (res.pdfBytes) parts.push(`PDF (${formatBytes(res.pdfBytes)})`);
      showToast(`Exportado correctamente: ${parts.join(' y ')}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al generar el documento.'
      );
    } finally {
      setExportProgress(null);
    }
  };

  // Global file drag-and-drop handler across the whole screen
  const handleWindowDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setGlobalDragActive(true);
    }
  };

  const handleWindowDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setGlobalDragActive(false);
    }
  };

  const handleWindowDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      setGlobalDragActive(false);
      handleFilesSelected(e.dataTransfer.files);
    } else {
      setGlobalDragActive(false);
    }
  };

  return (
    <div
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
      className="min-h-screen lg:h-screen flex flex-col bg-slate-100 text-slate-900"
    >
      {/* Top Navbar */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 leading-tight truncate">
              Fotolizador{' '}
              <span className="font-normal text-slate-500 text-xs sm:text-sm">
                (por Pedro Garat)
              </span>
            </h1>
            <p className="text-xs text-slate-500 truncate hidden sm:block">
              Álbumes DOCX y PDF según plantilla · 100% en tu navegador
            </p>
          </div>
          {importProgress && (
            <div className="hidden xl:inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>
                Cargando {importProgress.current}/{importProgress.total}
              </span>
            </div>
          )}
        </div>

        {/* Center view switcher */}
        <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'photos'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Images className="w-3.5 h-3.5" />
            Miniaturas ({photos.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'preview'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Vista previa A4 ({pages.length})
          </button>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={Boolean(exportProgress)}
              title="Vaciar todas las fotos"
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Vaciar
            </button>
          )}

          <button
            type="button"
            disabled={photos.length === 0 || Boolean(exportProgress)}
            onClick={() => handleExport('docx')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
          >
            {exportProgress ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            DOCX
          </button>

          <button
            type="button"
            disabled={photos.length === 0 || Boolean(exportProgress)}
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
          >
            {exportProgress ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            PDF
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <SidebarControls
          settings={settings}
          onChange={updateSettings}
          totalOriginalBytes={totalOriginalBytes}
          totalEstimatedBytes={totalEstimatedBytes}
          photoCount={photos.length}
          pageCount={pages.length}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5">
          {/* Mobile Tab Switcher */}
          <div className="flex md:hidden items-center justify-between gap-2 bg-white p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('photos')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                activeTab === 'photos' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
              }`}
            >
              <Images className="w-3.5 h-3.5" />
              Miniaturas ({photos.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                activeTab === 'preview' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Vista previa ({pages.length})
            </button>
          </div>

          {/* Export progress bar */}
          {exportProgress && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-indigo-900">
                  {exportProgress.stage}
                </p>
                <div className="w-full bg-indigo-200/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-200"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (exportProgress.current / Math.max(1, exportProgress.total)) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dropzone */}
          <PhotoDropzone
            onFilesSelected={handleFilesSelected}
            compact={photos.length > 0}
            importProgress={importProgress}
          />

          {/* Content area */}
          {photos.length > 0 && (
            <>
              {activeTab === 'photos' ? (
                <PhotoGridView
                  groups={groups}
                  settings={settings}
                  onRotatePhoto={handleRotatePhoto}
                  onDeletePhoto={handleDeletePhoto}
                  onUpdateCustomCaption={handleUpdateCustomCaption}
                  onReorderManual={handleReorderManual}
                />
              ) : (
                <DocumentPreviewView pages={pages} settings={settings} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global file drag overlay */}
      {globalDragActive && (
        <div className="fixed inset-0 z-50 bg-indigo-900/40 backdrop-blur-xs flex items-center justify-center p-6 pointer-events-none">
          <div className="bg-white rounded-3xl border-2 border-dashed border-indigo-500 px-10 py-8 text-center shadow-2xl">
            <Images className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
            <p className="text-lg font-bold text-slate-900">
              Suelta tus fotos para añadirlas
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Se cargarán y almacenarán localmente en tu navegador
            </p>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {statusMessage && (
        <div className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-medium shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;

