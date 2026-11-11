import React, { useState } from 'react';
import {
  Calendar,
  GripVertical,
  Pencil,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { DocumentSettings, PhotoGroup, PhotoItem } from '../types';
import {
  buildPhotoCaption,
  formatBytes,
  formatDateValue,
  getEffectiveDimensions,
} from '../utils/formatters';

interface PhotoGridViewProps {
  groups: PhotoGroup[];
  settings: DocumentSettings;
  onRotatePhoto: (id: string) => void;
  onDeletePhoto: (id: string) => void;
  onUpdateCustomCaption: (id: string, caption: string) => void;
  onReorderManual: (draggedId: string, targetId: string) => void;
}

export const PhotoGridView: React.FC<PhotoGridViewProps> = ({
  groups,
  settings,
  onRotatePhoto,
  onDeletePhoto,
  onUpdateCustomCaption,
  onReorderManual,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  let runningIndex = 0;

  const renderPhotoCard = (photo: PhotoItem, indexOneBased: number) => {
    const effectiveDims = getEffectiveDimensions(photo);
    const captionPreview = buildPhotoCaption(photo, settings, indexOneBased);
    const captureStr =
      photo.captureDate !== null
        ? formatDateValue(photo.captureDate, 'shortWithTime')
        : `${formatDateValue(photo.modifiedDate, 'shortWithTime')} (mod)`;

    const isEditing = editingId === photo.id;
    const isDropTarget = dragOverId === photo.id && draggedId !== photo.id;

    return (
      <div
        key={photo.id}
        draggable
        onDragStart={(e) => {
          setDraggedId(photo.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', photo.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverId !== photo.id) {
            setDragOverId(photo.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverId === photo.id) setDragOverId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const sourceId = draggedId || e.dataTransfer.getData('text/plain');
          setDraggedId(null);
          setDragOverId(null);
          if (sourceId && sourceId !== photo.id) {
            onReorderManual(sourceId, photo.id);
          }
        }}
        onDragEnd={() => {
          setDraggedId(null);
          setDragOverId(null);
        }}
        className={`group relative rounded-xl bg-white border transition-all overflow-hidden flex flex-col shadow-xs ${
          isDropTarget
            ? 'border-indigo-500 ring-2 ring-indigo-300 scale-[1.01]'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
        } ${draggedId === photo.id ? 'opacity-50' : ''}`}
      >
        {/* Top bar overlay */}
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden flex items-center justify-center">
          <img
            src={photo.thumbnailUrl}
            alt={photo.name}
            loading="lazy"
            className="w-full h-full object-contain p-1.5 select-none pointer-events-none"
          />

          <div className="absolute top-2 left-2 flex items-center gap-1">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-900/75 text-white text-[11px] font-semibold px-1.5 py-0.5 backdrop-blur-xs cursor-grab active:cursor-grabbing">
              <GripVertical className="w-3 h-3 text-slate-300" />#{indexOneBased}
            </span>
          </div>

          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onRotatePhoto(photo.id)}
              title="Girar 90°"
              className="p-1.5 rounded-lg bg-white/95 text-slate-700 hover:text-indigo-600 shadow-sm border border-slate-200 transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeletePhoto(photo.id)}
              title="Eliminar foto"
              className="p-1.5 rounded-lg bg-white/95 text-slate-700 hover:text-rose-600 shadow-sm border border-slate-200 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Metadata & Caption */}
        <div className="p-2.5 flex-1 flex flex-col justify-between gap-1.5 text-xs">
          <div>
            <p className="font-medium text-slate-800 truncate" title={photo.name}>
              {photo.name}
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
              <span className="inline-flex items-center gap-1 truncate">
                <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                {captureStr}
              </span>
              <span className="shrink-0 font-mono text-[10px]">
                {effectiveDims.width}×{effectiveDims.height} · {formatBytes(photo.size)}
              </span>
            </div>
          </div>

          {settings.showCaption && (
            <div className="pt-1.5 border-t border-slate-100">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={photo.customCaption}
                    onChange={(e) => onUpdateCustomCaption(photo.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    placeholder={captionPreview || 'Texto personalizado...'}
                    className="w-full rounded border border-indigo-400 px-2 py-0.5 text-[11px] focus:outline-none"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(photo.id)}
                  title="Clic para editar este pie de foto"
                  className="w-full text-left flex items-center justify-between gap-1 text-[11px] italic text-slate-600 hover:text-indigo-700 group/cap"
                >
                  <span className="truncate">
                    {captionPreview || 'Sin pie de foto'}
                    {photo.customCaption.trim() && (
                      <span className="not-italic ml-1 text-[10px] text-indigo-600 font-medium">
                        (editado)
                      </span>
                    )}
                  </span>
                  <Pencil className="w-3 h-3 shrink-0 opacity-40 group-hover/cap:opacity-100" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key} className="space-y-3">
          {group.label && (
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-800 bg-slate-200/70 px-3 py-1 rounded-full">
                {group.label}
              </h3>
              <span className="text-xs text-slate-500">
                {group.photos.length} {group.photos.length === 1 ? 'foto' : 'fotos'}
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {group.photos.map((photo) => {
              runningIndex += 1;
              return renderPhotoCard(photo, runningIndex);
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

