'use client';

import { useState, useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { AudioEngine } from '@/components/audio/AudioEngine';
import { BottomBarPlayer } from '@/components/audio/BottomBarPlayer';
import { InlineEditor } from '@/components/admin/InlineEditor';
import { AdminTrackDetail } from '@/components/admin/AdminTrackDetail';
import { SortableSidebarTrack } from '@/components/admin/SortableSidebarTrack';
import { Plus, Trash2, AudioLines, Settings, ArrowUp, ArrowDown, X } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';

import Link from 'next/link';

export function AdminClientLayout({ projects }: { projects: any[] }) {
  const project = useProjectStore(state => state.project);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempTitle, setTempTitle] = useState(project?.title || '');
  const [tempAlias, setTempAlias] = useState(project?.custom_alias || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (project) {
      setTempTitle(project.title);
      setTempAlias(project.custom_alias || '');
    }
  }, [project]);

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

  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= project.categories.length) return;
    
    // Zustand 스토어 즉시 반영
    useProjectStore.getState().reorderCategories(index, targetIndex);
    
    // API 호출에 필요한 순서 갱신 리스트
    const updatedCats = [...project.categories];
    const [moved] = updatedCats.splice(index, 1);
    updatedCats.splice(targetIndex, 0, moved);
    const updates = updatedCats.map((c, idx) => ({ id: c.id, order_index: idx }));
    
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reorderCategories', payload: { updates } })
    });
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && project) {
      const origin = window.location.origin;
      const nanoidUrl = `${origin}/${project.short_id || project.id}`;
      navigator.clipboard.writeText(nanoidUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveProjectSettings = async () => {
    if (!tempTitle.trim()) {
      alert("프로젝트 이름을 입력해 주세요.");
      return;
    }
    
    // Zustand 스토어 즉시 반영 (별칭은 기존값 유지)
    useProjectStore.getState().updateProjectSettings(tempTitle, project?.custom_alias || '');
    
    // API 호출
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'updateProjectSettings', 
        payload: { id: project.id, title: tempTitle, custom_alias: project.custom_alias || '' } 
      })
    });
    setIsSettingsOpen(false);
  };

  const publicUrl = `/${project.custom_alias || project.short_id || project.id}`;

  return (
    <div className="h-screen w-screen overflow-hidden antialiased flex flex-col bg-[#111416]">
      <AudioEngine trackVersions={allVersions} />
      <BottomBarPlayer />
      
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
            대시보드
          </a>
          <a 
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm bg-[#1c2126] text-gray-300 font-bold px-4 py-2 rounded hover:text-white hover:bg-[#252b31] transition-colors border border-[#22272c]"
          >
            메인페이지 보기
          </a>
        </div>
      </header>
      
      {/* 2-Pane Content Wrapper (Centered and restricted on wider screens) */}
      <div className="flex-1 flex justify-center bg-[#111416] overflow-hidden w-full pb-16">
        <div className="w-full lg:w-[66%] max-w-6xl flex overflow-hidden border-x border-[#22272c] bg-[#111416] h-full">
          
          {/* Left Pane: Tree/Category Sidebar Editor */}
          <aside className="w-80 bg-[#15191c] border-r border-[#22272c] flex flex-col shrink-0 h-full">
            {/* Project Title Header */}
            <div className="p-4 border-b border-[#22272c] flex justify-between items-center bg-[#1c2126] shrink-0">
              <div className="font-extrabold text-white text-lg flex items-center gap-2 min-w-0 flex-1 pr-2 truncate">
                <span className="truncate" title={project.title}>{project.title}</span>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(true)} 
                className="text-gray-500 hover:text-white p-1 transition-colors shrink-0" 
                title="프로젝트 설정"
              >
                <Settings className="w-4 h-4" />
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

      {/* Project Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161a1d] border border-[#22272c] w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col text-white">
            {/* Header */}
            <div className="p-5 border-b border-[#22272c] flex justify-between items-center bg-[#1c2126]">
              <h3 className="text-lg font-bold text-white">프로젝트 설정</h3>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] scrollbar-hide">
              {/* Project Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">프로젝트 이름</label>
                <input 
                  type="text" 
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  className="w-full bg-[#111416] border border-[#22272c] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5a623] transition-colors"
                />
              </div>

              {/* 원래 프로젝트 고유 주소 (NanoID) 및 복사 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">원래 고유 주소 (NanoID)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/${project.short_id || project.id}` : `/${project.short_id || project.id}`}
                    className="flex-1 bg-[#111416] border border-[#22272c] rounded px-3 py-2 text-xs text-gray-400 select-all outline-none"
                  />
                  <button 
                    onClick={handleCopyLink}
                    className="bg-[#1c2126] hover:bg-[#252b31] border border-[#22272c] text-xs font-bold px-3 py-2 rounded text-white transition-colors shrink-0"
                  >
                    {copied ? '복사됨!' : '주소 복사'}
                  </button>
                </div>
              </div>

              {/* 프로젝트 Bias (별칭 별도 저장 카드) */}
              <div className="space-y-2.5 p-4 border border-[#22272c]/60 rounded-lg bg-[#111416]/50">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">프로젝트 별칭 (bias)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={tempAlias}
                    onChange={(e) => setTempAlias(e.target.value)}
                    className="flex-1 bg-[#111416] border border-[#22272c] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5a623] transition-colors"
                    placeholder="별칭 입력 (예: my-portfolio)"
                  />
                  <button 
                    onClick={async () => {
                      if (!tempAlias.trim()) {
                        alert("별칭(bias)을 입력해 주세요.");
                        return;
                      }
                      // Zustand 스토어 즉시 반영
                      useProjectStore.getState().updateProjectSettings(project.title, tempAlias);
                      
                      // API 호출
                      await fetch('/api/actions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          action: 'updateProjectSettings', 
                          payload: { id: project.id, title: project.title, custom_alias: tempAlias } 
                        })
                      });
                      alert("별칭(bias)이 설정되었습니다. 기존 주소와 별칭 주소 둘 다 접근할 수 있습니다.");
                    }}
                    className="bg-[#f5a623] hover:bg-[#f5a623]/80 text-black text-xs font-extrabold px-3.5 py-2 rounded transition-colors shrink-0 shadow-lg shadow-[#f5a623]/10"
                  >
                    별칭 저장
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal whitespace-pre-line">
                  {tempAlias ? `지정 시 두 주소로 모두 접근 가능합니다:\n/${project.short_id} 및 /${tempAlias}` : '별칭을 지정하여 자신만의 단축 URL을 설정하세요.'}
                </p>
              </div>
              {/* Category Reordering */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">카테고리 위치 설정</label>
                <div className="border border-[#22272c] rounded-lg bg-[#111416] divide-y divide-[#22272c]/40 overflow-hidden">
                  {project.categories.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500 font-bold">생성된 카테고리가 없습니다.</div>
                  ) : (
                    project.categories.map((c, idx) => (
                      <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-gray-300 truncate">{c.title}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveCategory(idx, 'up')}
                            className="p-1 hover:bg-[#1c2126] text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded transition-colors"
                            title="위로 이동"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === project.categories.length - 1}
                            onClick={() => handleMoveCategory(idx, 'down')}
                            className="p-1 hover:bg-[#1c2126] text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded transition-colors"
                            title="아래로 이동"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="p-5 border-t border-[#22272c] flex justify-between items-center bg-[#1c2126]">
              <button 
                onClick={handleDeleteProject}
                className="text-xs text-red-500 hover:text-red-400 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> 프로젝트 삭제
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-xs bg-[#111416] text-gray-400 font-bold px-3 py-1.5 rounded border border-[#22272c] hover:text-white transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleSaveProjectSettings}
                  className="text-xs bg-[#f5a623] hover:bg-[#f5a623]/80 text-black font-extrabold px-3 py-1.5 rounded transition-colors shadow-lg shadow-[#f5a623]/10"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
