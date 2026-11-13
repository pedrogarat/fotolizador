import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  FolderOpen,
  FolderSearch,
  HardDrive,
  Loader2,
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
                Reconectar fotos del proyecto
              </h3>
              <p className="text-xs text-slate-500">
                Localización automática de archivos en subcarpetas
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
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {missingCount === totalProjectPhotos
                  ? `Se requieren ${totalProjectPhotos} fotos para este montaje.`
                  : `Faltan ${missingCount} de ${totalProjectPhotos} fotos por vincular.`}
              </span>
              <p className="text-amber-800 mt-1">
                En este equipo, la unidad de red NAS puede tener otra letra (por ejemplo <span className="font-mono font-semibold">Z:</span> o <span className="font-mono font-semibold">X:</span> en lugar de <span className="font-mono font-semibold">V:</span>) o estar en otra ruta.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-600 font-medium mb-1.5">
              Carpeta de referencia guardada en el proyecto:
            </p>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800 break-all">
              <HardDrive className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>\{rootFolderHint}</span>
            </div>
          </div>

          {/* Directory Drag & Drop / Click zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!isProcessing) folderInputRef.current?.click();
            }}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
              isProcessing
                ? 'border-indigo-400 bg-indigo-50 cursor-wait'
                : isDragOver
                  ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
            }`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                <p className="text-sm font-bold text-slate-800">
                  Escaneando y vinculando fotos...
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Buscando coincidencias en subcarpetas
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2.5">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">
                  Selecciona la carpeta <span className="text-indigo-600">\{rootFolderHint}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Haz clic aquí o arrastra la carpeta para escanear automáticamente todas las subcarpetas de visitas.
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs hover:bg-indigo-700 transition">
                  <Upload className="w-3.5 h-3.5" />
                  Elegir carpeta en este PC
                </span>
              </div>
            )}

            {/* Hidden native directory picker */}
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
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Escaneo 100% local en tu navegador
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
          >
            Hacerlo más tarde
          </button>
        </div>
      </div>
    </div>
  );
};

