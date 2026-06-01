'use client';

import { useState, useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { AudioEngine } from '@/components/audio/AudioEngine';
import { InlineEditor } from '@/components/admin/InlineEditor';
import { AdminTrackDetail } from '@/components/admin/AdminTrackDetail';
import { SortableSidebarTrack } from '@/components/admin/SortableSidebarTrack';
import { Plus, Trash2, AudioLines } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

import Link from 'next/link';

export function AdminClientLayout({ projects }: { projects: any[] }) {
  const project = useProjectStore(state => state.project);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Auto-select the first track upon loading
  useEffect(() => {
    if (project && !selectedTrackId) {
      const firstTrack = project.categories.flatMap(c => c.tracks)[0];
      if (firstTrack) {
        setSelectedTrackId(firstTrack.id);
      }
    }
  }, [project, selectedTrackId]);

  if (!project) return null;

  const allVersions = project.categories.flatMap(cat => 
    cat.tracks.flatMap(t => t.versions)
  );

  // Find the selected track data
  const selectedTrack = project.categories
    .flatMap(c => c.tracks)
    .find(t => t.id === selectedTrackId);

  const handleDragEnd = async (event: any, categoryId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const category = project.categories.find(c => c.id === categoryId);
    if (!category) return;
    
    const oldIndex = category.tracks.findIndex(t => t.id === active.id);
    const newIndex = category.tracks.findIndex(t => t.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      useProjectStore.getState().reorderTracks(categoryId, oldIndex, newIndex);
      
      const updatedTracks = useProjectStore.getState().project!.categories.find(c => c.id === categoryId)!.tracks;
      const updates = updatedTracks.map((t, idx) => ({ id: t.id, order_index: idx }));
      
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reorderTracks', 
          payload: { updates }
        })
      });
    }
  };

  const handleUpdateCategory = async (id: string, title: string) => {
    useProjectStore.getState().updateCategoryTitle(id, title);
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renameCategory', payload: { id, title } })
    });
  };

  const handleAddCategory = async () => {
    const title = prompt("새 카테고리 이름을 입력하세요:");
    if (!title) return;
    
    const id = crypto.randomUUID();
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addCategory', payload: { id, project_id: project.id, title } })
    });
    if (res.ok) {
      useProjectStore.getState().addCategory({ id, project_id: project.id, title, order_index: 999, tracks: [] });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (confirm("이 카테고리와 속해있는 모든 트랙을 삭제하시겠습니까?")) {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteCategory', payload: { id: categoryId } })
      });
      useProjectStore.getState().deleteCategory(categoryId);
      // Selected track may have been deleted, reset selection
      const activeTrackStillExists = useProjectStore.getState().project?.categories.flatMap(c => c.tracks).some(t => t.id === selectedTrackId);
      if (!activeTrackStillExists) {
        setSelectedTrackId(null);
      }
    }
  };

  const handleAddTrack = async (categoryId: string) => {
    const title = prompt("새 트랙 이름을 입력하세요:");
    if (!title) return;
    
    const id = crypto.randomUUID();
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addTrack', payload: { id, category_id: categoryId, title } })
    });
    if (res.ok) {
      const newTrack = { id, category_id: categoryId, title, order_index: 999, versions: [] };
      useProjectStore.getState().addTrack(newTrack);
      setSelectedTrackId(id); // Auto-focus newly created track
    }
  };

  const handleDeleteProject = async () => {
    if (confirm("이 프로젝트와 포함된 모든 오디오(R2 포함)를 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteProject', payload: { id: project.id } })
      });
      window.location.href = '/admin';
    }
  };

  const publicUrl = `/${project.custom_alias || project.short_id || project.id}`;

  return (
    <div className="h-screen w-screen overflow-hidden antialiased flex flex-col bg-[#111416]">
      <AudioEngine trackVersions={allVersions} />
      
      {/* Global Top Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-[#22272c] shrink-0 bg-[#111416] w-full z-10">
        <Link href="/admin" className="relative z-20 flex items-center gap-2 font-extrabold tracking-tight text-xl w-fit text-white hover:text-primary transition-colors cursor-pointer select-none">
          <AudioLines className="text-primary w-6 h-6" />
          Audiofolio
          <span className="text-xs text-primary font-bold ml-1 px-1.5 py-0.5 bg-primary/10 rounded">ADMIN</span>
        </Link>
        <div className="flex-1"></div>
        <div className="flex justify-end w-1/3 gap-3">
          <a 
            href="/admin"
            className="text-sm bg-[#1c2126] text-gray-300 font-bold px-4 py-2 rounded hover:text-white hover:bg-[#252b31] transition-colors border border-[#22272c]"
          >
            대시보드 ↗
          </a>
          <a 
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-[#1c2126] text-gray-300 font-bold px-4 py-2 rounded hover:text-white hover:bg-[#252b31] transition-colors border border-[#22272c]"
          >
            메인페이지 보기 ↗
          </a>
        </div>
      </header>
      
      {/* 2-Pane Content Wrapper (Centered and restricted on wider screens) */}
      <div className="flex-1 flex justify-center bg-[#111416] overflow-hidden w-full">
        <div className="w-full lg:w-[66%] max-w-6xl flex overflow-hidden border-x border-[#22272c] bg-[#111416] h-full">
          
          {/* Left Pane: Tree/Category Sidebar Editor */}
          <aside className="w-80 bg-[#15191c] border-r border-[#22272c] flex flex-col shrink-0 h-full">
            {/* Project Title Header */}
            <div className="p-4 border-b border-[#22272c] flex justify-between items-center bg-[#1c2126] shrink-0">
              <div className="font-extrabold text-white text-lg flex items-center gap-2 min-w-0 flex-1 pr-2">
                <InlineEditor 
                  initialValue={project.title} 
                  onSave={async (newTitle) => {
                    useProjectStore.getState().setProject({ ...project, title: newTitle });
                    await fetch('/api/actions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'renameProject', payload: { id: project.id, title: newTitle } })
                    });
                  }} 
                  isTitle={true}
                  textClassName="text-lg font-extrabold text-white tracking-tight"
                />
              </div>
              <button 
                onClick={handleDeleteProject} 
                className="text-gray-500 hover:text-red-400 p-1 transition-colors shrink-0" 
                title="프로젝트 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Tree Workspace */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              {project.categories.map((category) => (
                <div key={category.id} className="mb-6">
                  {/* Category Title with inline Pencil */}
                  <div className="flex justify-between items-center mb-2 group pl-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-4">
                      <InlineEditor 
                        initialValue={category.title}
                        onSave={async (newTitle) => handleUpdateCategory(category.id, newTitle)}
                        textClassName="text-xs font-extrabold uppercase tracking-wider text-gray-400"
                        isTitle={true}
                      />
                    </div>
                    <button 
                      onClick={() => handleDeleteCategory(category.id)} 
                      className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="카테고리 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Tracks list within Category */}
                  <div className="pl-4 border-l border-[#22272c] ml-2 pb-1 space-y-1">
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, category.id)}
                    >
                      <SortableContext 
                        items={category.tracks.map(t => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {category.tracks.map((track) => (
                          <SortableSidebarTrack 
                            key={track.id} 
                            track={track} 
                            isSelected={selectedTrackId === track.id}
                            onClick={() => setSelectedTrackId(track.id)}
                            onRename={async (newTitle) => {
                              useProjectStore.getState().updateTrackTitle(track.id, newTitle);
                              await fetch('/api/actions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'renameTrack', payload: { id: track.id, title: newTitle } })
                              });
                            }}
                            onDelete={async () => {
                              if (confirm("이 트랙을 정말로 삭제하시겠습니까?")) {
                                await fetch('/api/actions', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ action: 'deleteTrack', payload: { id: track.id } })
                                });
                                useProjectStore.getState().deleteTrack(track.id);
                                if (selectedTrackId === track.id) {
                                  setSelectedTrackId(null);
                                }
                              }
                            }}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    {/* Quick Add Track Button */}
                    <button 
                      onClick={() => handleAddTrack(category.id)}
                      className="w-full text-left py-2 text-sm text-gray-500 hover:text-primary transition-colors flex items-center gap-1 font-bold mt-2"
                    >
                      <Plus className="w-4 h-4" /> 트랙 추가
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Category Section */}
              <button 
                onClick={handleAddCategory}
                className="w-full mt-6 py-4 border border-dashed border-[#22272c] rounded-lg text-gray-500 hover:text-primary hover:border-primary/50 transition-colors flex justify-center items-center gap-1 text-sm font-bold"
              >
                <Plus className="w-4 h-4" /> 카테고리 추가
              </button>
            </div>
          </aside>

          {/* Right Pane: Main Track Detail Panel */}
          <div className="flex-1 bg-[#111416] h-full overflow-hidden">
            {selectedTrack ? (
              <AdminTrackDetail track={selectedTrack} projectId={project.id} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <AudioLines className="w-12 h-12 text-gray-700 mb-3" />
                <p className="text-sm font-bold">편집할 트랙을 왼쪽 트리에서 선택해 주세요.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
