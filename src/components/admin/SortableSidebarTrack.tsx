'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { InlineEditor } from '@/components/admin/InlineEditor';
import { useProjectStore } from '@/store/projectStore';

interface SortableSidebarTrackProps {
  track: any;
  isSelected: boolean;
  onClick: () => void;
  onRename: (newTitle: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function SortableSidebarTrack({ track, isSelected, onClick, onRename, onDelete }: SortableSidebarTrackProps) {
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
    <div 
      ref={setNodeRef} 
      style={style} 
      className="relative group/sidebar-track flex items-center gap-1 mb-1"
    >
      {/* Drag & Drop Grab Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab text-gray-600 hover:text-gray-400 p-1 shrink-0 transition-colors"
        title="드래그하여 순서 변경"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Main Track Item Button */}
      <div 
        onClick={onClick}
        className={`flex-1 flex items-center justify-between pl-2 pr-2 py-2 rounded text-sm transition-colors cursor-pointer select-none ${
          isSelected 
            ? 'bg-primary/10 text-primary font-bold' 
            : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c2126]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-6" onClick={(e) => {
          // 이름 수정 클릭 시 버블링을 방지해 트랙이 갑자기 선택해제되거나 다시 선택되는 걸 막을 수 있으나 
          // 텍스트 영역 클릭은 기본적으로 트랙 선택이 되게 합니다.
        }}>
          <InlineEditor 
            initialValue={track.title} 
            onSave={onRename}
            textClassName="truncate"
            isTitle={true}
          />
        </div>
      </div>

      {/* Delete button (displays on hover) */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-2 text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover/sidebar-track:opacity-100 transition-opacity"
        title="트랙 삭제"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
