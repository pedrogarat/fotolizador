import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  FileText,
  FolderOpen,
  FolderSearch,
  Images,
  Loader2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { DocumentSettings, PhotoConfigItem, PhotoItem } from './types';
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
import { exportProjectToFot, readFotFile } from './utils/projectFile';
import { extractFilesFromDataTransfer, isPhotoMatch } from './utils/fileSystemUtils';
import { buildDocumentPages, groupPhotos, sortPhotos } from './utils/organizePhotos';
import { exportDocument, ExportProgress } from './utils/exporters';
import { formatBytes } from './utils/formatters';
import { SidebarControls } from './components/SidebarControls';
import { ImportProgress, PhotoDropzone } from './components/PhotoDropzone';
import { PhotoGridView } from './components/PhotoGridView';
import { DocumentPreviewView } from './components/DocumentPreviewView';
import { ReconnectPhotosModal } from './components/ReconnectPhotosModal';

type ActiveTab = 'photos' | 'preview' | 'settings';

export function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [settings, setSettings] = useState<DocumentSettings>(() => loadSettingsFromStorage());
  const [isLoaded, setIsLoaded] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('photos');
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [pendingPhotoConfigs, setPendingPhotoConfigs] = useState<PhotoConfigItem[]>([]);
  const [reconnectModalOpen, setReconnectModalOpen] = useState(false);
  const [rootFolderHint, setRootFolderHint] = useState('02_VISITAS DE OBRA');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const fotInputRef = useRef<HTMLInputElement>(null);

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
          const file = files[i];
          setImportProgress({
            current: i + 1,
            total: files.length,
            fileName: file.name,
          });
          const preset = pendingPhotoConfigs.find((c) => isPhotoMatch(c, file));
          const item = await importImageFile(file, baseOrder + i, preset);
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
    [photos, pendingPhotoConfigs, showToast]
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
    if (photos.length === 0) return;
    const ok = window.confirm(
      '¿Deseas eliminar todas las fotos para empezar un nuevo montaje?\n\nEsta acción vaciará la galería actual y liberará el almacenamiento local del navegador.'
    );
    if (!ok) return;

    setPhotos([]);
    setPendingPhotoConfigs([]);
    await clearPhotosDb();
    setActiveTab('photos');
    showToast('Se han eliminado todas las fotos. Listo para un nuevo montaje.');
  }, [photos.length, showToast]);

  const handleExportFot = useCallback(() => {
    try {
      const res = exportProjectToFot(settings, photos);
      showToast(`Proyecto guardado: ${res.fileName} (${formatBytes(res.byteCount)})`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al guardar el archivo .fot');
    }
  }, [settings, photos, showToast]);

  const handleImportFot = useCallback(
    async (file: File) => {
      try {
        const project = await readFotFile(file);
        setSettings(project.settings);
        setPendingPhotoConfigs(project.photos);
        if (project.rootFolderHint) {
          setRootFolderHint(project.rootFolderHint);
        }

        const configMap = new Map(
          project.photos.map((c) => [c.name.toLowerCase(), c])
        );

        let matchedCount = 0;
        if (photos.length > 0) {
          const updated = await Promise.all(
            photos.map(async (photo) => {
              const match = configMap.get(photo.name.toLowerCase());
              if (!match) return photo;
              matchedCount++;
              const nextRot = match.rotation;
              let thumb = photo.thumbnailUrl;
              if (nextRot !== photo.rotation) {
                const res = await createThumbnailDataUrl(photo.blob, nextRot, 380);
                thumb = res.thumbnailUrl;
              }
              return {
                ...photo,
                rotation: nextRot,
                customCaption: match.customCaption,
                manualOrder: match.manualOrder,
                thumbnailUrl: thumb,
              };
            })
          );
          setPhotos(updated);

          if (matchedCount === project.photos.length) {
            showToast(
              `Proyecto .fot cargado: configuración aplicada a las ${matchedCount} fotos.`
            );
          } else {
            setReconnectModalOpen(true);
            showToast(
              `Proyecto .fot cargado: se actualizaron ${matchedCount} de ${project.photos.length} fotos.`
            );
          }
        } else {
          // If no photos loaded yet, immediately open the reconnect modal so user can pick the folder
          setReconnectModalOpen(true);
          showToast(
            `Proyecto .fot cargado (${project.photos.length} fotos requeridas). Selecciona la carpeta raíz para localizarlas.`
          );
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'No se pudo leer el archivo .fot');
      }
    },
    [photos, showToast]
  );

  const handleFolderSelected = useCallback(
    async (fileList: File[]) => {
      const imageFiles = fileList.filter(
        (f) =>
          f.type.startsWith('image/') ||
          /\.(jpe?g|png|webp|heic|bmp|tiff?)$/i.test(f.name)
      );

      if (imageFiles.length === 0) {
        showToast('No se detectaron imágenes en la carpeta seleccionada.');
        return;
      }

      setIsReconnecting(true);
      try {
        const existingNames = new Set(photos.map((p) => p.name.toLowerCase()));
        const matchedItems: PhotoItem[] = [];

        for (const file of imageFiles) {
          const config = pendingPhotoConfigs.find((c) => isPhotoMatch(c, file));
          if (config && !existingNames.has(file.name.toLowerCase())) {
            existingNames.add(file.name.toLowerCase());
            const item = await importImageFile(file, config.manualOrder, config);
            matchedItems.push(item);
          }
        }

        if (matchedItems.length > 0) {
          setPhotos((prev) => {
            const combined = [...prev, ...matchedItems];
            combined.sort((a, b) => a.manualOrder - b.manualOrder);
            return combined;
          });
          setReconnectModalOpen(false);
          showToast(
            `¡Reconectadas con éxito ${matchedItems.length} fotos desde la carpeta!`
          );
        } else {
          showToast(
            'Se revisaron los archivos pero ninguno coincidió con los nombres del proyecto.'
          );
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Error al procesar la carpeta.'
        );
      } finally {
        setIsReconnecting(false);
      }
    },
    [photos, pendingPhotoConfigs, showToast]
  );

  const missingProjectPhotosCount = useMemo(() => {
    if (pendingPhotoConfigs.length === 0) return 0;
    const currentNameSet = new Set(photos.map((p) => p.name.toLowerCase()));
    return pendingPhotoConfigs.filter((c) => !currentNameSet.has(c.name.toLowerCase()))
      .length;
  }, [pendingPhotoConfigs, photos]);

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

  const handleWindowDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setGlobalDragActive(false);
    if (e.dataTransfer) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        handleFilesSelected(files);
      }
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
      <header className="sticky top-0 h-16 shrink-0 bg-white border-b border-slate-200 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 z-30">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
              Fotolizador
              <span className="block sm:inline sm:ml-1 font-normal text-slate-500 text-[11px] sm:text-sm">
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

        {/* Center view switcher (Desktop lg+) */}
        <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('photos')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'photos' || activeTab === 'settings'
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

        {/* Export buttons and actions */}
        <div className="flex items-center gap-2">
          {/* Quick .fot buttons */}
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-0.5">
            <button
              type="button"
              onClick={handleExportFot}
              title="Guardar archivo de configuración (.fot) de este montaje"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 transition cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="hidden xl:inline">Guardar .fot</span>
            </button>

            <button
              type="button"
              onClick={() => fotInputRef.current?.click()}
              title="Cargar archivo de configuración (.fot)"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-700 transition cursor-pointer shadow-2xs"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="hidden xl:inline">Cargar .fot</span>
            </button>
          </div>

          {photos.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={Boolean(exportProgress)}
              title="Eliminar todas las fotos para comenzar un nuevo montaje"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 hover:border-rose-300 px-2.5 sm:px-3 py-2 text-xs font-semibold text-rose-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Nuevo montaje</span>
              <span className="sm:hidden">Nuevo</span>
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

      {/* Sticky Mobile / Tablet Navigation Tabs */}
      <nav
        aria-label="Navegación móvil"
        className="lg:hidden sticky top-16 z-20 bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 shadow-xs"
      >
        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'photos'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <Images className="w-3.5 h-3.5 shrink-0" />
          <span>Fotos ({photos.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'preview'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>Vista previa ({pages.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span>Ajustes</span>
        </button>
      </nav>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className={activeTab === 'settings' ? 'block lg:block' : 'hidden lg:block'}>
          <SidebarControls
            settings={settings}
            onChange={updateSettings}
            totalOriginalBytes={totalOriginalBytes}
            totalEstimatedBytes={totalEstimatedBytes}
            photoCount={photos.length}
            pageCount={pages.length}
            onExportFot={handleExportFot}
            onTriggerImportFot={() => fotInputRef.current?.click()}
          />
        </div>

        <main
          className={`flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 ${
            activeTab === 'settings' ? 'hidden lg:block' : 'block'
          }`}
        >
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

          {/* Dropzone (shown in Fotos tab or desktop) */}
          {(activeTab !== 'preview' || photos.length === 0) && (
            <PhotoDropzone
              onFilesSelected={handleFilesSelected}
              compact={photos.length > 0}
              importProgress={importProgress}
            />
          )}

          {/* Missing photos banner if project .fot is active */}
          {missingProjectPhotosCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold">
                    Faltan {missingProjectPhotosCount} de {pendingPhotoConfigs.length} fotos por vincular.
                  </span>
                  <span className="hidden sm:inline text-amber-800 ml-1.5">
                    Carpeta de referencia: <code className="font-mono font-semibold bg-amber-100/70 px-1.5 py-0.5 rounded text-amber-950">\{rootFolderHint}</code>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReconnectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition cursor-pointer shadow-xs shrink-0"
              >
                <FolderSearch className="w-3.5 h-3.5" />
                Reconectar carpeta
              </button>
            </div>
          )}

          {/* Content area */}
          {photos.length > 0 ? (
            <>
              {/* Photo bar with counter & quick action */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs text-xs">
                <div className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="font-bold text-slate-900">
                    {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>
                    {pages.length} {pages.length === 1 ? 'página' : 'páginas'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{formatBytes(totalOriginalBytes)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportFot}
                    className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-200 font-medium transition cursor-pointer"
                    title="Guardar archivo de configuración (.fot) de este montaje"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    Guardar .fot
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={Boolean(exportProgress)}
                    className="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-transparent hover:border-rose-200 font-medium transition cursor-pointer"
                    title="Eliminar todas las fotos de este montaje"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    Vaciar fotos (Nuevo montaje)
                  </button>
                </div>
              </div>

              {activeTab === 'preview' ? (
                <DocumentPreviewView pages={pages} settings={settings} />
              ) : (
                <PhotoGridView
                  groups={groups}
                  settings={settings}
                  onRotatePhoto={handleRotatePhoto}
                  onDeletePhoto={handleDeletePhoto}
                  onUpdateCustomCaption={handleUpdateCustomCaption}
                  onReorderManual={handleReorderManual}
                />
              )}
            </>
          ) : (
            activeTab === 'preview' && (
              <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center">
                <Eye className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  Aún no hay páginas para previsualizar
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Añade al menos una foto arriba para ver la vista previa A4.
                </p>
              </div>
            )
          )}
        </main>
      </div>

      {/* Hidden file input for .fot / .json projects */}
      <input
        ref={fotInputRef}
        type="file"
        accept=".fot,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImportFot(file);
          }
          e.target.value = '';
        }}
      />

      {/* Reconnect Photos Modal */}
      <ReconnectPhotosModal
        isOpen={reconnectModalOpen}
        onClose={() => setReconnectModalOpen(false)}
        rootFolderHint={rootFolderHint}
        missingCount={missingProjectPhotosCount || pendingPhotoConfigs.length}
        totalProjectPhotos={pendingPhotoConfigs.length}
        onFolderSelected={handleFolderSelected}
        isProcessing={isReconnecting}
      />

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

