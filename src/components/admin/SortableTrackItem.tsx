'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { AdminTrackItem } from '@/components/admin/AdminTrackItem';

export function SortableTrackItem({ track }: { track: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/trackdnd mb-4">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute -left-6 top-6 cursor-grab opacity-0 group-hover/trackdnd:opacity-100 transition-opacity text-gray-600 hover:text-white z-20"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <AdminTrackItem track={track} />
    </div>
  );
}
