import React, { useRef, useState } from 'react';
import { FolderOpen, ImagePlus, Loader2, Upload } from 'lucide-react';
import { extractFilesFromDataTransfer } from '../utils/fileSystemUtils';

export interface ImportProgress {
  current: number;
  total: number;
  fileName: string;
}

interface PhotoDropzoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  compact?: boolean;
  importProgress?: ImportProgress | null;
}

export const PhotoDropzone: React.FC<PhotoDropzoneProps> = ({
  onFilesSelected,
  compact = false,
  importProgress = null,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isImporting = Boolean(importProgress);

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    onFilesSelected(files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer) {
      const files = await extractFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        handleFiles(files);
      }
    }
  };

  const pct = importProgress
    ? Math.min(
        100,
        Math.round((importProgress.current / Math.max(1, importProgress.total)) * 100)
      )
    : 0;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => {
        if (!isImporting) inputRef.current?.click();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!isImporting && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`rounded-2xl border-2 border-dashed transition-all ${
        isImporting
          ? 'cursor-wait border-indigo-400 bg-indigo-50/70'
          : isDragging
            ? 'cursor-pointer border-indigo-500 bg-indigo-50/80 scale-[1.005]'
            : 'cursor-pointer border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/70'
      } ${compact ? 'px-5 py-4 flex items-center justify-between gap-4' : 'px-6 py-14 text-center'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {compact ? (
        <>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isImporting
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {isImporting ? (
                <>
                  <span className="absolute inset-0 rounded-xl bg-indigo-500 animate-ping opacity-30" />
                  <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                </>
              ) : (
                <ImagePlus className="w-5 h-5" />
              )}
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {importProgress
                  ? `Cargando fotos (${importProgress.current}/${importProgress.total}) · ${importProgress.fileName}`
                  : 'Arrastra más fotos aquí o selecciona desde tu equipo'}
              </p>
              {importProgress ? (
                <div className="w-full max-w-md bg-indigo-200/80 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-150"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Todo se procesa y guarda localmente en tu navegador (JPG, PNG, WebP...)
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              disabled={isImporting}
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Añadir una carpeta completa con sus subcarpetas"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Añadir carpeta</span>
            </button>
            <button
              type="button"
              disabled={isImporting}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer ${
                isImporting ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {pct}%
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Añadir fotos
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div
            className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
              isImporting
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            {isImporting ? (
              <>
                <span className="absolute inset-0 rounded-2xl bg-indigo-500 animate-ping opacity-30" />
                <Loader2 className="w-7 h-7 animate-spin relative z-10" />
              </>
            ) : (
              <ImagePlus className="w-7 h-7" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {importProgress
              ? `Cargando fotos (${importProgress.current} de ${importProgress.total})...`
              : 'Arrastra todas tus fotos aquí'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-5">
            {importProgress
              ? `Procesando ${importProgress.fileName}`
              : 'O haz clic para abrir el selector tradicional de archivos. Extraemos la fecha EXIF de captura automáticamente.'}
          </p>
          {importProgress ? (
            <div className="w-full max-w-xs bg-indigo-200/80 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-indigo-400 transition cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-indigo-600" />
                Seleccionar carpeta de fotos
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Seleccionar archivos
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-4">
            Sin servidores externos · Almacenamiento local en el navegador
          </p>
        </div>
      )}
    </div>
  );
};
