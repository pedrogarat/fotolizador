import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  FolderOpen,
  FolderSearch,
  HardDrive,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { extractFilesFromDataTransfer } from '../utils/fileSystemUtils';

interface ReconnectPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  rootFolderHint?: string;
  missingCount: number;
  totalProjectPhotos: number;
  onFolderSelected: (files: File[]) => void;
  isProcessing?: boolean;
}

export const ReconnectPhotosModal: React.FC<ReconnectPhotosModalProps> = ({
  isOpen,
  onClose,
  rootFolderHint = '02_VISITAS DE OBRA',
  missingCount,
  totalProjectPhotos,
  onFolderSelected,
  isProcessing = false,
}) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    onFolderSelected(fileList);
    e.target.value = '';
  };

  const handleOpenNativeFolderPicker = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof (window as any).showDirectoryPicker === 'function') {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];

        async function traverseDir(handle: any, pathPrefix = ''): Promise<void> {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file: File = await entry.getFile();
              if (
                file.type.startsWith('image/') ||
                /\.(jpe?g|png|webp|heic|bmp|tiff?)$/i.test(file.name)
              ) {
                Object.defineProperty(file, 'customRelativePath', {
                  value: pathPrefix ? `${pathPrefix}/${file.name}` : file.name,
                  writable: true,
                  configurable: true,
                });
                files.push(file);
              }
            } else if (entry.kind === 'directory') {
              await traverseDir(entry, pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name);
            }
          }
        }

        await traverseDir(dirHandle, dirHandle.name);
        if (files.length > 0) {
          onFolderSelected(files);
          return;
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return; // User cancelled dialog
        }
      }
    }

    // Fallback to webkitdirectory input
    folderInputRef.current?.click();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        onFolderSelected(files);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <FolderSearch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Vincular fotos del proyecto
              </h3>
              <p className="text-xs text-slate-500">
                Lectura directa sin mover ni copiar archivos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Step 1 notification */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>1º Configuración y orden del proyecto cargados ({totalProjectPhotos} fotos).</span>
            </div>
            <div className="text-slate-600 pl-6 leading-relaxed">
              2º Se comprobó la ubicación guardada originalmente. Al estar en otro equipo o variar la letra de red (<span className="font-mono font-semibold text-slate-800">V:</span>, <span className="font-mono font-semibold text-slate-800">Z:</span>, etc.), indica la carpeta correspondiente para leerlas directamente.
            </div>
          </div>

          {/* Root folder hint box */}
          <div>
            <p className="text-xs text-slate-600 font-medium mb-1">
              Carpeta de origen guardada en el archivo:
            </p>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800 break-all">
              <HardDrive className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>\{rootFolderHint}</span>
            </div>
          </div>

          {/* Safe operation guarantee */}
          <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 p-3 text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Lectura 100% segura en su ubicación original:</span>
              <p className="text-emerald-800 mt-0.5 leading-relaxed">
                Tus fotos <strong>NO se copiarán, NO se moverán ni se modificarán</strong> en tu disco o NAS. Solo se leen en memoria para continuar tu montaje.
              </p>
            </div>
          </div>

          {/* Directory Drag & Drop / Click zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleOpenNativeFolderPicker}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition cursor-pointer ${
              isProcessing
                ? 'border-indigo-400 bg-indigo-50 cursor-wait'
                : isDragOver
                  ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
            }`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mb-2" />
                <p className="text-sm font-bold text-slate-800">
                  Leyendo fotos desde la carpeta...
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vinculando subcarpetas sin copiar archivos
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Selecciona la carpeta <span className="text-indigo-600 font-mono">\{rootFolderHint}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Haz clic para abrir el explorador de Windows o arrastra la carpeta aquí.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNativeFolderPicker}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3.5 py-2 text-xs font-semibold shadow-xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Abrir cuadro de diálogo de Windows
                </button>
              </div>
            )}

            {/* Hidden fallback directory picker */}
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {missingCount} {missingCount === 1 ? 'foto pendiente' : 'fotos pendientes'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
