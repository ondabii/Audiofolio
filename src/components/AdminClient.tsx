"use client";

import { useState, useOptimistic, startTransition, useEffect } from "react";
import { Plus, Trash2, AudioLines, GripVertical, Settings } from "lucide-react";
import UploadDropzone from "@/components/UploadDropzone";
import AdminVersionItem from "@/components/AdminVersionItem";
import InlineEditor from "./InlineEditor";
import Link from "next/link";
import { 
  addCategory, renameCategory, deleteCategory, reorderCategories,
  addTrack, renameTrack, deleteTrack, reorderTracks,
  renameProject, updateProjectSettings, reorderVersions 
} from "@/app/actions";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Project Settings Modal
function ProjectSettingsModal({ project, isOpen, onClose, onSave }: any) {
  const [alias, setAlias] = useState(project.custom_alias || "");
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1c2126] w-full max-w-md rounded-lg border border-[#22272c] shadow-2xl">
        <div className="p-6 border-b border-[#22272c]">
          <h2 className="text-xl font-bold">프로젝트 설정</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Project ID</label>
            <input type="text" readOnly value={project.id} className="w-full bg-[#111416] border border-[#22272c] rounded px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Custom Alias (커스텀 링크)</label>
            <input 
              type="text" 
              value={alias} 
              onChange={e => setAlias(e.target.value)} 
              placeholder="예: bias"
              className="w-full bg-[#111416] border border-[#22272c] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" 
            />
            <p className="text-xs text-gray-500 mt-1">이 별칭으로 쉽게 접속할 수 있습니다 (예: /bias)</p>
          </div>
        </div>
        <div className="p-6 border-t border-[#22272c] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white transition-colors">취소</button>
          <button onClick={() => { onSave(alias); onClose(); }} className="px-4 py-2 rounded text-sm bg-primary text-[#111416] font-bold hover:bg-primary/80 transition-colors">저장</button>
        </div>
      </div>
    </div>
  );
}

// Add Item Modal
function AddModal({ isOpen, onClose, onSave, title, placeholder }: any) {
  const [val, setVal] = useState("");
  
  useEffect(() => {
    if (isOpen) setVal("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1c2126] w-full max-w-sm rounded-lg border border-[#22272c] shadow-2xl">
        <div className="p-4 border-b border-[#22272c]">
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <div className="p-4">
          <input 
            type="text" 
            value={val} 
            onChange={e => setVal(e.target.value)} 
            onKeyDown={e => {
              if (e.key === 'Enter' && val.trim()) { onSave(val.trim()); onClose(); }
              if (e.key === 'Escape') onClose();
            }}
            placeholder={placeholder}
            className="w-full bg-[#111416] border border-[#22272c] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" 
            autoFocus
          />
        </div>
        <div className="p-4 border-t border-[#22272c] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white transition-colors">취소</button>
          <button onClick={() => { if(val.trim()) { onSave(val.trim()); onClose(); } }} className="px-4 py-2 rounded text-sm bg-primary text-[#111416] font-bold hover:bg-primary/80 transition-colors">추가</button>
        </div>
      </div>
    </div>
  );
}

// Sortable Wrappers
function SortableCategory({ cat, children, onEdit, onDelete, onAddTrack, onRefresh }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <div className="flex justify-between items-center mb-2 group pl-1">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab text-gray-600 hover:text-gray-300 -ml-2 p-1">
             <GripVertical className="w-4 h-4" />
          </div>
          <div className="font-extrabold text-sm uppercase tracking-wider text-gray-400">
            <InlineEditor value={cat.title} onSave={(val) => onEdit(cat.id, val)} className="hover:text-white" inputClassName="text-sm" />
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onDelete(cat.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="pl-6 border-l-2 border-[#22272c] ml-2 pb-1 space-y-1">
        {children}
        <button 
          onClick={() => onAddTrack(cat.id)}
          className="w-full text-left py-2 text-sm text-gray-600 hover:text-primary transition-colors flex items-center gap-1 font-bold mt-2"
        >
          <Plus className="w-4 h-4" /> 트랙 추가
        </button>
      </div>
    </div>
  );
}

function SortableTrack({ track, selectedTrackId, onClick, onEdit, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: track.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="relative group flex items-center gap-1">
      <div {...attributes} {...listeners} className="cursor-grab text-gray-600 hover:text-gray-300 p-1 shrink-0">
        <GripVertical className="w-3.5 h-3.5" />
      </div>
      <div 
        onClick={onClick}
        className={`flex-1 flex items-center justify-between pl-2 pr-2 py-2 rounded text-sm transition-colors cursor-pointer ${selectedTrackId === track.id ? 'bg-primary/10 text-primary font-bold' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1c2126]'}`}
      >
        <div className="flex-1 min-w-0 pr-6">
           <InlineEditor value={track.title} onSave={(val) => onEdit(track.id, val)} onTextClick={onClick} className="w-full" textClassName="break-words" />
        </div>
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onDelete(track.id)} className="text-gray-500 hover:text-red-400 p-1.5"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function SortableVersion({ version, index, hasNoRep }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: version.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <AdminVersionItem version={version} isFirstInList={index === 0} hasNoRep={hasNoRep} dragListeners={{...attributes, ...listeners}} />
    </div>
  );
}

// Main Component
export default function AdminClient({ project: initialProject, onRefresh }: { project: any, onRefresh?: () => void }) {
  const [optimisticProject, setOptimisticProject] = useOptimistic(initialProject);
  const [activeTab, setActiveTab] = useState<"tree" | "track">("tree");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
    initialProject.categories?.[0]?.tracks?.[0]?.id || null
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [addModalState, setAddModalState] = useState<{isOpen: boolean, type: 'category' | 'track', targetId?: string}>({isOpen: false, type: 'category'});

  // Sync when initialProject changes
  useEffect(() => {
    startTransition(() => {
      setOptimisticProject(initialProject);
    });
  }, [initialProject, setOptimisticProject]);

  const selectedTrack = optimisticProject.categories
    .flatMap((c: any) => c.tracks)
    .find((t: any) => t.id === selectedTrackId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle DND
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Detect what type of item we are dragging
    const isCategory = optimisticProject.categories.some((c:any) => c.id === active.id);
    
    if (isCategory) {
       const oldIndex = optimisticProject.categories.findIndex((c:any) => c.id === active.id);
       const newIndex = optimisticProject.categories.findIndex((c:any) => c.id === over.id);
       const newArray = arrayMove(optimisticProject.categories, oldIndex, newIndex);
       
       startTransition(async () => {
         setOptimisticProject({ ...optimisticProject, categories: newArray });
         const updates = newArray.map((c:any, i:number) => ({ id: c.id, order_index: i }));
         await reorderCategories(updates);
         if (onRefresh) onRefresh();
       });
       return;
    }

    // Try track
    for (const cat of optimisticProject.categories) {
      if (cat.tracks.some((t:any) => t.id === active.id)) {
        const oldIndex = cat.tracks.findIndex((t:any) => t.id === active.id);
        const newIndex = cat.tracks.findIndex((t:any) => t.id === over.id);
        if (newIndex === -1) return; // cannot drag across categories easily with this setup
        const newTracks = arrayMove(cat.tracks, oldIndex, newIndex);
        
        startTransition(async () => {
          const newCats = optimisticProject.categories.map((c:any) => c.id === cat.id ? { ...c, tracks: newTracks } : c);
          setOptimisticProject({ ...optimisticProject, categories: newCats });
          const updates = newTracks.map((t:any, i:number) => ({ id: t.id, order_index: i }));
          await reorderTracks(updates);
          if (onRefresh) onRefresh();
        });
        return;
      }
    }

    // Try version
    if (selectedTrack && selectedTrack.versions.some((v:any) => v.id === active.id)) {
      const oldIndex = selectedTrack.versions.findIndex((v:any) => v.id === active.id);
      const newIndex = selectedTrack.versions.findIndex((v:any) => v.id === over.id);
      const newVersions = arrayMove(selectedTrack.versions, oldIndex, newIndex);
      
      startTransition(async () => {
        const newCats = optimisticProject.categories.map((c:any) => ({
           ...c,
           tracks: c.tracks.map((t:any) => t.id === selectedTrack.id ? { ...t, versions: newVersions } : t)
        }));
        setOptimisticProject({ ...optimisticProject, categories: newCats });
        const updates = newVersions.map((v:any, i:number) => ({ id: v.id, order_index: i }));
        await reorderVersions(updates);
        if (onRefresh) onRefresh();
      });
    }
  };

  const handleAddCategory = async (name: string) => {
    await addCategory(optimisticProject.id, name);
    if (onRefresh) onRefresh();
  };
  const handleEditCategory = async (id: string, name: string) => {
     startTransition(async () => {
       setOptimisticProject({
         ...optimisticProject,
         categories: optimisticProject.categories.map((c:any) => c.id === id ? { ...c, title: name } : c)
       });
       await renameCategory(id, name);
       if (onRefresh) onRefresh();
     });
  };
  const handleDeleteCategory = async (id: string) => {
    if (window.confirm("카테고리를 삭제하면 하위 트랙과 버전이 모두 삭제됩니다.\n정말로 삭제하시겠습니까?")) {
      startTransition(async () => {
        setOptimisticProject({
          ...optimisticProject,
          categories: optimisticProject.categories.filter((c:any) => c.id !== id)
        });
        await deleteCategory(id);
        if (onRefresh) onRefresh();
      });
    }
  };

  const handleAddTrack = async (catId: string, name: string) => {
    await addTrack(catId, name);
    if (onRefresh) onRefresh();
  };
  const handleEditTrack = async (id: string, name: string) => {
    startTransition(async () => {
       setOptimisticProject({
         ...optimisticProject,
         categories: optimisticProject.categories.map((c:any) => ({
           ...c,
           tracks: c.tracks.map((t:any) => t.id === id ? { ...t, title: name } : t)
         }))
       });
       await renameTrack(id, name);
       if (onRefresh) onRefresh();
     });
  };
  const handleDeleteTrack = async (id: string) => {
    if (window.confirm("트랙을 삭제하면 업로드된 오디오가 모두 영구 삭제됩니다.\n정말로 삭제하시겠습니까?")) {
      startTransition(async () => {
         setOptimisticProject({
           ...optimisticProject,
           categories: optimisticProject.categories.map((c:any) => ({
             ...c,
             tracks: c.tracks.filter((t:any) => t.id !== id)
           }))
         });
         await deleteTrack(id);
         if (onRefresh) onRefresh();
         if (selectedTrackId === id) setSelectedTrackId(null);
       });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-main-bg text-white overflow-hidden antialiased">
      {/* Header - Fixed layout per request */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-[#22272c] shrink-0 bg-[#111416]">
        <div className="flex items-center gap-2 font-extrabold tracking-tight text-xl w-1/3">
          <AudioLines className="text-primary w-6 h-6" />
          Audiofolio
        </div>
        <div className="flex-1"></div>
        <div className="flex justify-end w-1/3">
          <Link 
            href={`/${optimisticProject.custom_alias || optimisticProject.short_id}`} 
            target="_blank" 
            className="text-sm bg-[#1c2126] text-gray-300 font-bold px-4 py-2 rounded hover:text-white hover:bg-[#252b31] transition-colors border border-[#22272c]"
          >
            메인페이지 보기 ↗
          </Link>
        </div>
      </header>

      {/* 2-Pane Content */}
      <div className="flex-1 flex overflow-hidden w-full">
        {/* Left Pane: Tree Editor */}
        <aside className={`w-full lg:w-96 bg-[#15191c] border-r border-[#22272c] flex flex-col shrink-0 ${activeTab === 'tree' ? 'block' : 'hidden lg:flex'}`}>
          <div className="p-4 border-b border-[#22272c] flex justify-between items-center bg-[#1c2126]">
            <div className="font-extrabold text-white flex items-center gap-2">
              <InlineEditor 
                value={optimisticProject.title} 
                onSave={async (val) => {
                  startTransition(async () => {
                    setOptimisticProject({...optimisticProject, title: val});
                    await renameProject(optimisticProject.id, val);
                    if (onRefresh) onRefresh();
                  });
                }}
                onTextClick={() => setIsSettingsOpen(true)}
                className="text-lg"
              />
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className="text-gray-500 hover:text-white transition-colors" title="프로젝트 설정">
              <Settings className="w-5 h-5" />
            </button>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              <SortableContext items={optimisticProject.categories.map((c:any) => c.id)} strategy={verticalListSortingStrategy}>
                {optimisticProject.categories.map((cat: any) => (
                  <SortableCategory 
                    key={cat.id} 
                    cat={cat} 
                    onEdit={handleEditCategory} 
                    onDelete={handleDeleteCategory}
                    onAddTrack={() => setAddModalState({isOpen: true, type: 'track', targetId: cat.id})}
                  >
                    <SortableContext items={cat.tracks.map((t:any) => t.id)} strategy={verticalListSortingStrategy}>
                      {cat.tracks.map((track: any) => (
                        <SortableTrack
                          key={track.id}
                          track={track}
                          selectedTrackId={selectedTrackId}
                          onClick={() => {
                            setSelectedTrackId(track.id);
                            if (window.innerWidth < 1024) setActiveTab('track');
                          }}
                          onEdit={handleEditTrack}
                          onDelete={handleDeleteTrack}
                        />
                      ))}
                    </SortableContext>
                  </SortableCategory>
                ))}
              </SortableContext>
              
              <button 
                onClick={() => setAddModalState({isOpen: true, type: 'category'})} 
                className="w-full mt-6 py-4 border-2 border-dashed border-[#22272c] rounded-lg text-gray-500 hover:text-primary hover:border-primary/50 transition-colors flex justify-center"
                title="새 카테고리 추가"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </DndContext>
        </aside>

        {/* Right Pane: Track Editor */}
        <main className={`flex-1 flex flex-col bg-main-bg min-w-0 lg:min-w-[500px] ${activeTab === 'track' ? 'block' : 'hidden lg:flex'}`}>
          {selectedTrack ? (
            <>
              <div className="p-6 border-b border-[#22272c] shrink-0">
                <h2 className="text-2xl font-bold text-white mb-2 break-words">{selectedTrack.title}</h2>
                <p className="text-sm text-gray-500">버전 관리 및 업로드 (드래그 앤 드롭으로 순서 변경)</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-hide flex flex-col min-w-0">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <ul className="space-y-2 mb-6 w-full">
                    <SortableContext items={selectedTrack.versions.map((v:any) => v.id)} strategy={verticalListSortingStrategy}>
                      {selectedTrack.versions.map((v: any, index: number) => {
                        const hasNoRep = !selectedTrack.versions.some((ver:any) => ver.is_representative);
                        return (
                          <SortableVersion 
                            key={v.id}
                            version={v} 
                            index={index}
                            hasNoRep={hasNoRep}
                          />
                        );
                      })}
                    </SortableContext>
                    
                    {selectedTrack.versions.length === 0 && (
                      <li className="text-gray-600 text-sm italic py-10 text-center border border-dashed border-[#22272c] rounded-lg">
                        등록된 오디오 버전이 없습니다.
                      </li>
                    )}
                  </ul>
                </DndContext>
                
                <UploadDropzone trackId={selectedTrack.id} compact={true} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              왼쪽 트리에서 트랙을 선택해 주세요.
            </div>
          )}
        </main>
      </div>

      {/* Mobile Tabs */}
      <div className="lg:hidden h-14 border-t border-[#22272c] bg-[#111416] flex shrink-0 w-full">
        <button 
          onClick={() => setActiveTab('tree')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeTab === 'tree' ? 'text-primary' : 'text-gray-500'}`}
        >
          <AudioLines className="w-5 h-5" />
          <span className="text-[10px] font-bold">트리 편집</span>
        </button>
        <button 
          onClick={() => setActiveTab('track')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeTab === 'track' ? 'text-primary' : 'text-gray-500'}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-bold">트랙 편집</span>
        </button>
      </div>
      
      <ProjectSettingsModal 
        project={optimisticProject} 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onSave={async (newAlias: string) => {
           startTransition(() => setOptimisticProject({...optimisticProject, custom_alias: newAlias}));
           await updateProjectSettings(optimisticProject.id, newAlias);
        }}
      />

      <AddModal 
        isOpen={addModalState.isOpen}
        title={addModalState.type === 'category' ? "새 카테고리 추가" : "새 트랙 추가"}
        placeholder={addModalState.type === 'category' ? "카테고리 이름" : "트랙 이름"}
        onClose={() => setAddModalState({isOpen: false, type: 'category'})}
        onSave={async (val: string) => {
          if (addModalState.type === 'category') {
            await handleAddCategory(val);
          } else if (addModalState.type === 'track' && addModalState.targetId) {
            await handleAddTrack(addModalState.targetId, val);
          }
        }}
      />
    </div>
  );
}
