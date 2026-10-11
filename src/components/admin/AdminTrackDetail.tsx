'use client';

import { useState, useRef, useEffect } from 'react';
import { Star, Eye, EyeOff, UploadCloud, Trash2, Loader, Pencil, X, Sparkles, Download, Code, Copy, Check, MessageSquare, StickyNote } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { useAudioStore } from '@/store/audioStore';
import { InlineEditor } from '@/components/admin/InlineEditor';
import { extractAudioMetadata } from '@/lib/audioUtils';
import { TrackComments } from '@/components/audio/TrackComments';

interface AdminTrackDetailProps {
  track: any;
  projectId: string;
}

export function AdminTrackDetail({ track, projectId }: AdminTrackDetailProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadText, setUploadText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // ── 버전 메모 모달 상태 ──
  const [memoModalVersion, setMemoModalVersion] = useState<any | null>(null);
  const [memoText, setMemoText] = useState('');
  const [isMemoDefaultExpanded, setIsMemoDefaultExpanded] = useState(false);

  const handleOpenMemoModal = (version: any) => {
    setMemoModalVersion(version);
    setMemoText(version.memo || '');
    setIsMemoDefaultExpanded(version.is_memo_default_expanded === 1 || version.is_memo_default_expanded === true);
  };

  const handleSaveMemoModal = async () => {
    if (!memoModalVersion) return;
    const versionId = memoModalVersion.id;
    const newMemo = memoText;
    const newExpanded = isMemoDefaultExpanded;

    // Zustand 스토어 즉시 반영
    useProjectStore.getState().updateVersionMemo(track.id, versionId, newMemo, newExpanded);

    // D1 DB 동기화
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateVersionMemo',
        payload: { id: versionId, memo: newMemo, is_memo_default_expanded: newExpanded }
      })
    });

    setMemoModalVersion(null);
  };

  const isCommentBlock = track.track_type === 'comment';
  const isCommentEnabled = track.is_comment_enabled === 1 || track.is_comment_enabled === true;

  const handleCommentToggle = async () => {
    const nextVal = !isCommentEnabled;
    useProjectStore.getState().toggleTrackCommentEnabled(track.id);
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggleTrackCommentEnabled',
        payload: { id: track.id, is_comment_enabled: nextVal }
      })
    });
  };

  const normalizedVersionIds = useAudioStore(state => state.normalizedVersionIds);
  const toggleNormalize = useAudioStore(state => state.toggleNormalize);

  const isDownloadable = track.is_downloadable === 1 || track.is_downloadable === true;
  const handleDownloadableToggle = async () => {
    const nextVal = !isDownloadable;
    
    // D1 DB 동기화
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateTrackDownloadable',
        payload: { id: track.id, is_downloadable: nextVal }
      })
    });

    // projectStore 상태도 실시간 반영
    const currentProject = useProjectStore.getState().project;
    if (currentProject) {
      const updatedCats = currentProject.categories.map(cat => ({
        ...cat,
        tracks: cat.tracks.map(t => t.id === track.id ? { ...t, is_downloadable: Boolean(nextVal) } : t)
      }));
      useProjectStore.getState().setProject({ ...currentProject, categories: updatedCats });
    }
  };

  // DB의 버전 노멀라이즈 상태를 오디오 엔진 상태로 동기화
  useEffect(() => {
    if (track && track.versions) {
      const updates: Record<string, boolean> = {};
      track.versions.forEach((v: any) => {
        updates[v.id] = v.is_normalized === 1 || v.is_normalized === true;
      });
      useAudioStore.setState((prev) => ({
        normalizedVersionIds: { ...prev.normalizedVersionIds, ...updates }
      }));
    }
  }, [track]);

  const handleVersionNormalizeToggle = async (versionId: string, currentNormalize: any) => {
    const isNorm = currentNormalize === 1 || currentNormalize === true;
    const nextVal = !isNorm;
    toggleNormalize(versionId);

    // D1 DB 동기화
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateVersionNormalize',
        payload: { id: versionId, is_normalized: nextVal }
      })
    });

    // projectStore 상태도 실시간 반영
    const currentProject = useProjectStore.getState().project;
    if (currentProject) {
      const updatedCats = currentProject.categories.map(cat => ({
        ...cat,
        tracks: cat.tracks.map(t => {
          if (t.versions?.some((v: any) => v.id === versionId)) {
            return {
              ...t,
              versions: t.versions.map((v: any) => v.id === versionId ? { ...v, is_normalized: nextVal ? 1 : 0 } : v)
            };
          }
          return t;
        })
      }));
      useProjectStore.getState().setProject({ ...currentProject, categories: updatedCats });
    }
  };

  const project = useProjectStore(state => state.project);
  const categories = project?.categories || [];

  const getRepresentativeId = (): string | null => {
    const versions = track.versions || [];
    if (versions.length === 0) return null;
    const manualRep = versions.find((v: any) => v.is_representative === true || v.is_representative === 1);
    if (manualRep) return manualRep.id;

    let latest = versions[0];
    for (let i = 1; i < versions.length; i++) {
      const v = versions[i];
      if (v.created_at && latest.created_at) {
        if (new Date(v.created_at) > new Date(latest.created_at)) {
          latest = v;
        }
      } else if (v.order_index > latest.order_index) {
        latest = v;
      }
    }
    return latest.id;
  };

  const representativeId = getRepresentativeId();
  const hasManualRep = track.versions?.some((v: any) => v.is_representative === true || v.is_representative === 1) || false;

  const handleDeleteTrack = async () => {
    const confirmMsg = isCommentBlock 
      ? "이 댓글 영역을 삭제하시겠습니까?" 
      : "이 트랙과 속해있는 모든 버전을 삭제하시겠습니까? (R2 파일 포함)";
    if (confirm(confirmMsg)) {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteTrack', payload: { id: track.id } })
      });
      useProjectStore.getState().deleteTrack(track.id);
    }
  };

  const handleUpdateTrack = async (newTitle: string) => {
    useProjectStore.getState().updateTrackTitle(track.id, newTitle);
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renameTrack', payload: { id: track.id, title: newTitle } })
    });
  };

  const handleUpdateVersion = async (versionId: string, newTitle: string) => {
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renameVersion', payload: { id: versionId, title: newTitle } })
    });
    // 스토어 상태 직접 교체
    useProjectStore.getState().updateVersionTitle(track.id, versionId, newTitle);
  };

  const handleToggleRepresentative = async (versionId: string, isManualRep: boolean) => {
    const nextVersionId = isManualRep ? null : versionId;

    // Zustand 스토어 즉시 반영
    useProjectStore.getState().setRepresentativeVersion(track.id, nextVersionId);

    // API 호출
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'setRepresentativeVersion', 
        payload: { id: nextVersionId, track_id: track.id } 
      })
    });
  };

  const handleToggleVisibility = async (versionId: string, currentVisible: boolean) => {
    const nextVisible = !currentVisible;

    // Zustand 스토어 즉시 반영
    useProjectStore.getState().toggleVersionVisibility(track.id, versionId);

    // API 호출
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'toggleVersionVisibility', 
        payload: { id: versionId, is_visible: nextVisible } 
      })
    });
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (confirm("이 버전을 영구 삭제하시겠습니까? (R2 실물 파일 포함)")) {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteVersion', payload: { id: versionId } })
      });
      useProjectStore.getState().deleteVersionFromTrack(track.id, versionId);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadText(`오디오 분석 중: ${file.name}...`);

    try {
      // 1. Metadata 추출 (Duration 및 포맷 등)
      const meta = await extractAudioMetadata(file);
      
      const versionId = crypto.randomUUID();
      const fileName = encodeURIComponent(file.name);
      // 파형 데이터를 JSON으로 직렬화해 쿼리 파라미터로 전달
      const waveformParam = encodeURIComponent(JSON.stringify(meta.waveformData));
      const url = `/api/upload?trackId=${track.id}&versionId=${versionId}&fileName=${fileName}&durationMs=${meta.durationMs}&fileSizeBytes=${meta.sizeBytes}&bitrate=${meta.bitrateKbps}&waveformData=${waveformParam}`;

      setUploadText(`R2 직접 업로드 중: ${file.name}...`);
      
      // 2. XMLHttpRequest를 통한 진행율 표시 직접 업로드
      const uploadPromise = new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'audio/wav');
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(`업로드 실패: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('업로드 네트워크 오류'));
        
        xhr.send(file);
      });

      const responseText = await uploadPromise;

      setUploadProgress(100);
      setUploadText('업로드 및 메타데이터 저장 완료!');
      
      // UI 리로드 대신 스토어 상태 직접 변이
      try {
        const resJson = JSON.parse(responseText);
        if (resJson.version) {
          useProjectStore.getState().addVersionToTrack(track.id, resJson.version);
        }
      } catch (e) {
        console.error("Failed to parse upload API response:", e);
      }
      
    } catch (err) {
      console.error(err);
      alert("업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
  };

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|m4a|aac)$/i.test(droppedFile.name)) {
        handleUploadFile(droppedFile);
      } else {
        alert("오디오 파일(WAV, MP3, OGG, FLAC 등)만 업로드 가능합니다.");
      }
    }
  };

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col bg-[#111416] min-w-0 lg:min-w-[400px] h-full relative transition-colors ${
        isDragOver ? 'border-2 border-primary border-dashed bg-primary/5' : ''
      }`}
    >
      {/* Full-panel drag overlay hint */}
      {isDragOver && (
        <div className="absolute inset-0 bg-[#111416]/95 backdrop-blur-md z-40 flex flex-col items-center justify-center pointer-events-none p-6 text-center animate-fade-in">
          <UploadCloud className="w-16 h-16 text-primary animate-bounce mb-3" />
          <p className="text-xl font-extrabold text-white">이 위치에 오디오 파일을 놓으세요</p>
          <p className="text-sm text-gray-400 font-bold mt-2">WAV, MP3, FLAC, OGG 오디오 파일 드롭 업로드 지원</p>
        </div>
      )}
      {/* Track Title Header */}
      <div className="p-6 border-b border-[#22272c] shrink-0 flex justify-between items-center bg-[#111416]">
        <div className="min-w-0 flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-extrabold text-white flex items-center">
              <InlineEditor 
                initialValue={track.title} 
                onSave={handleUpdateTrack}
                textClassName="text-2xl font-extrabold text-white"
                isTitle={true}
              />
            </h2>
            {isCommentBlock && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                댓글 영역
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500 font-bold shrink-0">카테고리 이동:</span>
            <select
              value={track.category_id}
              onChange={async (e) => {
                const newCategoryId = e.target.value;
                const oldCategoryId = track.category_id;
                if (newCategoryId === oldCategoryId) return;
                
                // Zustand 스토어 즉시 반영
                useProjectStore.getState().moveTrackToCategory(track.id, oldCategoryId, newCategoryId);
                // API 호출
                await fetch('/api/actions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    action: 'moveTrackToCategory', 
                    payload: { id: track.id, category_id: newCategoryId } 
                  })
                });
              }}
              className="bg-[#1c2126] text-xs text-gray-300 font-bold border border-[#22272c] rounded px-2.5 py-1.5 focus:outline-none focus:border-[#f5a623] transition-colors cursor-pointer"
            >
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      <div className="flex gap-2 shrink-0 items-center">
        {!isCommentBlock ? (
          <>
            {/* 재생 모드 설정: AB 비교 vs 연속 재생 */}
            <div className="flex items-center gap-1.5 bg-[#1c2126] px-2.5 py-1.5 rounded border border-[#22272c] text-xs">
              <span className="text-gray-400 font-bold shrink-0">재생:</span>
              <select
                value={track.playback_mode || 'ab_test'}
                onChange={async (e) => {
                  const newMode = e.target.value;
                  useProjectStore.getState().updateTrackPlaybackMode(track.id, newMode);
                  await fetch('/api/actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'updateTrackPlaybackMode',
                      payload: { id: track.id, playback_mode: newMode }
                    })
                  });
                }}
                className="bg-transparent text-xs font-bold text-primary outline-none cursor-pointer"
              >
                <option value="ab_test" className="bg-[#1c2126] text-white">AB 비교</option>
                <option value="playlist" className="bg-[#1c2126] text-white">연속 재생</option>
              </select>
            </div>

            <button
              onClick={() => setIsEmbedModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-extrabold bg-[#1c2126] text-gray-300 hover:text-white border border-[#22272c] hover:border-primary/50 transition-all cursor-pointer"
              title="외부 사이트 삽입용 iframe 임베드 코드 생성"
            >
              <Code className="w-3.5 h-3.5 text-primary" /> 임베드
            </button>

            <button
              onClick={handleDownloadableToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-extrabold border transition-all ${
                isDownloadable
                  ? 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/30 shadow-lg shadow-[#f5a623]/5'
                  : 'bg-[#1c2126] text-gray-500 border-gray-800 hover:text-gray-300 hover:bg-[#252b31]'
              }`}
              title="공개 페이지 다운로드 허용 여부 토글"
            >
              <Download className="w-3.5 h-3.5" /> 다운로드 {isDownloadable ? '허용' : '차단'}
            </button>

            <button
              onClick={handleCommentToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-extrabold border transition-all ${
                isCommentEnabled
                  ? 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/30 shadow-lg shadow-[#f5a623]/5'
                  : 'bg-[#1c2126] text-gray-500 border-gray-800 hover:text-gray-300 hover:bg-[#252b31]'
              }`}
              title="공개 페이지 댓글 허용 여부 토글"
            >
              <MessageSquare className="w-3.5 h-3.5" /> 댓글 {isCommentEnabled ? '허용' : '차단'}
            </button>
          </>
        ) : null}

        <button 
          onClick={handleDeleteTrack} 
          className="text-red-500 hover:text-red-400 font-bold text-xs flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
          title={isCommentBlock ? "댓글 영역 삭제" : "트랙 삭제"}
        >
          <Trash2 className="w-3.5 h-3.5" /> {isCommentBlock ? '영역 삭제' : '트랙 삭제'}
        </button>
      </div>
    </div>

      {/* Main Body: 독립 댓글 영역 vs 일반 오디오 트랙 버전 목록 */}
      {isCommentBlock ? (
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide flex flex-col min-w-0">
          <div className="mb-4">
            <p className="text-xs text-gray-500">독립형 댓글 영역입니다. 음원 없이 댓글 및 방명록으로만 표시됩니다.</p>
          </div>
          <TrackComments trackId={track.id} isAdmin={true} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide flex flex-col min-w-0">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">업로드된 버전 목록</h3>
        <ul className="space-y-3 mb-6 w-full">
          {(!track.versions || track.versions.length === 0) ? (
            <div className="text-center py-8 text-gray-600 border border-dashed border-[#22272c] rounded-lg">
              업로드된 오디오 버전이 없습니다.
            </div>
          ) : (
            track.versions.map((version: any) => {
              const isManualRep = version.is_representative === true || version.is_representative === 1;
              const isAutoRep = !hasManualRep && version.id === representativeId;
              const isEffectiveRep = isManualRep || isAutoRep;
              const isVis = version.is_visible;
              return (
                <div 
                  key={version.id} 
                  className={`flex items-center gap-3 border p-3 rounded-md transition-all ${
                    isEffectiveRep 
                      ? 'bg-[#1c2126] border-[#22272c] shadow-md shadow-black/20' 
                      : 'bg-[#161a1d] border-[#22272c]/40 hover:bg-[#1c2126] hover:border-[#22272c]'
                  } ${!isVis ? 'opacity-60 hover:opacity-100' : ''}`}
                >
                  {/* Left Pane Controls: Drag & Star */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="cursor-grab text-gray-600 hover:text-gray-400 p-1">
                      <Star className="w-4 h-4 opacity-0 pointer-events-none" /> {/* Spacer */}
                    </div>
                    <button 
                      onClick={() => handleToggleRepresentative(version.id, isManualRep)}
                      className={`p-1 transition-transform hover:scale-110 ${
                        isEffectiveRep ? 'text-[#f5a623]' : 'text-gray-500 hover:text-[#f5a623]'
                      }`} 
                      title={
                        isManualRep 
                          ? "대표 버전 활성화됨 (클릭 시 지정 해제)" 
                          : isAutoRep 
                            ? "현재 자동 대표 버전 (클릭하여 수동 대표 버전으로 지정)" 
                            : "클릭하여 대표 버전으로 지정"
                      }
                    >
                      <Star 
                        className={`w-4 h-4 ${
                          isManualRep 
                            ? 'fill-[#f5a623] text-[#f5a623]' 
                            : isAutoRep 
                              ? 'text-[#f5a623] fill-none stroke-[1.5px]' 
                              : 'text-gray-500 fill-none'
                        }`} 
                      />
                    </button>
                  </div>

                  {/* Middle Info & Inline Rename */}
                  <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <InlineEditor 
                          initialValue={version.title || `v${version.order_index}`} 
                          onSave={async (newTitle) => handleUpdateVersion(version.id, newTitle)}
                          textClassName={`text-sm font-bold truncate ${isEffectiveRep ? 'text-white' : 'text-gray-300'}`}
                          isTitle={true}
                        />
                      </div>
                      {/* Right Tools: Memo & Normalize & Eye & Delete */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {/* 버전별 메모 버튼 (노멀라이즈 버튼 왼쪽) */}
                        {(() => {
                          const hasMemo = Boolean(version.memo && version.memo.trim().length > 0);
                          return (
                            <button
                              onClick={() => handleOpenMemoModal(version)}
                              className={`p-1 transition-all hover:scale-110 ${
                                hasMemo
                                  ? 'text-[#f5a623]'
                                  : 'text-gray-500 hover:text-[#f5a623]'
                              }`}
                              title={hasMemo ? "메모 확인 및 수정 (작성됨 - 노란색)" : "메모 추가 (비어있음)"}
                            >
                              <StickyNote className={`w-4 h-4 ${hasMemo ? 'fill-[#f5a623]/20' : ''}`} />
                            </button>
                          );
                        })()}

                        {/* 버전별 음량 피크 노멀라이즈 */}
                        <button
                          onClick={() => handleVersionNormalizeToggle(version.id, version.is_normalized)}
                          className={`p-1 transition-all hover:scale-110 ${
                            version.is_normalized 
                              ? 'text-[#f5a623]' 
                              : 'text-gray-500 hover:text-[#f5a623]'
                          }`}
                          title={version.is_normalized ? "음량 노멀라이즈 활성화됨 (클릭 시 해제)" : "음량 노멀라이즈 활성화"}
                        >
                          <Sparkles className={`w-4 h-4 ${version.is_normalized ? 'fill-[#f5a623]' : ''}`} />
                        </button>

                        <button 
                          onClick={() => handleToggleVisibility(version.id, isVis)}
                          className={`p-1 transition-colors ${isVis ? 'text-primary hover:text-gray-400' : 'text-gray-500 hover:text-primary'}`} 
                          title={isVis ? "공개 페이지 노출 중 (클릭 시 비공개)" : "공개 페이지 숨김 중 (클릭 시 노출)"}
                        >
                          {isVis ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleDeleteVersion(version.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors p-1" 
                          title="버전 삭제"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                      <span className="bg-black/50 px-1.5 py-0.5 rounded border border-gray-700/50 uppercase">{version.file_format || 'WAV'}</span>
                      {version.file_size_bytes ? <span>{(version.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span> : null}
                      {version.bitrate ? <span>{version.bitrate} kbps</span> : null}
                      {version.memo && version.memo.trim().length > 0 && (
                        <span className="text-[#f5a623] truncate max-w-[220px] font-medium" title={version.memo}>
                          • 📝 {version.memo.split('\n')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </ul>

        {/* Uploading Status & Dropzone */}
        <div className="pt-4 border-t border-[#22272c]/40">
          {isUploading && (
            <div className="bg-[#1c2126] p-4 rounded border border-primary/30 relative overflow-hidden mb-4">
              <div className="absolute inset-0 bg-primary/10 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              <div className="relative z-10 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Loader className="w-4 h-4 text-primary animate-spin" />
                  <div className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-[300px]">{uploadText}</div>
                  <div className="text-xs text-primary font-bold">{uploadProgress}%</div>
                </div>
              </div>
            </div>
          )}

          <div className={`border-2 border-dashed border-[#22272c] rounded-lg p-8 text-center transition-colors bg-[#161a1d] ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer group/upload'} relative`}>
            <div className={`w-12 h-12 mx-auto bg-[#1c2126] rounded-full flex items-center justify-center mb-3 transition-colors ${!isUploading && 'group-hover/upload:bg-primary/20'}`}>
              <UploadCloud className={`w-6 h-6 text-gray-400 transition-colors ${!isUploading && 'group-hover/upload:text-primary'}`} />
            </div>
            <p className="text-sm text-gray-300 font-bold mb-1">{isUploading ? '오디오 파일 업로드 중...' : '여기에 오디오 파일을 드래그하여 업로드하세요'}</p>
            <p className="text-xs text-gray-500 font-medium">WAV, FLAC, MP3, OGG, M4A (최대 200MB)</p>
            {!isUploading && (
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                title="" 
              />
            )}
          </div>

          {/* ── 트랙 댓글 영역 (어드민 뷰: IP 표시 및 삭제 권한) ── */}
          <div className="mt-8 pt-6 border-t border-[#22272c]">
            {!isCommentEnabled && (
              <div className="mb-3 px-3 py-2 rounded bg-[#1c2126] border border-[#22272c] text-xs text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-600"></span>
                현재 이 트랙은 공개 페이지에서 댓글이 차단(비활성화)되어 있습니다.
              </div>
            )}
            <TrackComments trackId={track.id} isAdmin={true} />
          </div>
        </div>
      </div>
    )}

      {/* ── 임베드 코드 복사 모달 ── */}
      {isEmbedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#161a1d] border border-[#22272c] rounded-xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsEmbedModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#22272c] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Code className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">트랙 임베드 코드 생성</h3>
                <p className="text-xs text-gray-400">{track.title} 전용 위젯</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              노션(Notion), 개인 블로그, 포트폴리오 사이트 등에 아래의 <code className="text-primary font-mono bg-black/40 px-1 py-0.5 rounded">&lt;iframe&gt;</code> 코드를 붙여넣으면 가로폭에 맞춰 가변형으로 반응하는 오디오 플레이어가 삽입됩니다. (오토플레이 없음)
            </p>

            <div className="bg-black/60 border border-[#22272c] rounded-lg p-3 relative font-mono text-xs text-gray-300 mb-4 select-all break-all">
              {`<iframe src="${typeof window !== 'undefined' ? window.location.origin : 'https://audiofolio.ondabii.com'}/embed/track/${track.id}" width="100%" height="${Math.min(140 + (track.versions?.length || 1) * 35, 260)}" frameborder="0"></iframe>`}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-gray-500 font-medium">
                권장 높이: {Math.min(140 + (track.versions?.length || 1) * 35, 260)}px (가로폭 100% 자동 반응)
              </span>
              <button
                onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://audiofolio.ondabii.com';
                  const embedCode = `<iframe src="${origin}/embed/track/${track.id}" width="100%" height="${Math.min(140 + (track.versions?.length || 1) * 35, 260)}" frameborder="0"></iframe>`;
                  navigator.clipboard.writeText(embedCode);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  isCopied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary text-black hover:bg-primary/90 font-extrabold cursor-pointer'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4" /> 복사 완료!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> 코드 복사하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 버전 메모 편집 모달 ── */}
      {memoModalVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#161a1d] border border-[#22272c] rounded-xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
            <button
              onClick={() => setMemoModalVersion(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#22272c] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#f5a623]/10 border border-[#f5a623]/20 flex items-center justify-center text-[#f5a623] font-bold">
                <StickyNote className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {memoModalVersion.title || `v${memoModalVersion.order_index}`} 메모 설정
                </h3>
                <p className="text-xs text-gray-400">해당 버전에 대한 작업 내역이나 믹스 피드백 노트를 입력하세요.</p>
              </div>
            </div>

            {/* 기본 펼침 여부 토글 */}
            <div className="flex items-center justify-between p-3.5 bg-[#111416] border border-[#22272c] rounded-lg">
              <div>
                <div className="text-xs font-bold text-gray-200">공개 페이지 기본 상태: 열림(펼침)</div>
                <div className="text-[11px] text-gray-500">체크 해제 시 접혀서 첫 줄만 표시되며, 방문자가 클릭 시 펼쳐집니다.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMemoDefaultExpanded}
                  onChange={(e) => setIsMemoDefaultExpanded(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#f5a623]"></div>
              </label>
            </div>

            {/* 메모 내용 텍스트에어리어 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-gray-400 uppercase tracking-wider">메모 내용</label>
                <span className="text-gray-500 text-[11px]">여러 줄 입력 가능</span>
              </div>
              <textarea
                rows={5}
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="예: 보컬 3kHz 대역 1.5dB 부스트, 마스터 리미터 쓰레숄드 조정..."
                className="w-full bg-[#111416] border border-[#22272c] rounded-lg p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#f5a623] transition-colors leading-relaxed resize-none"
              />
              <p className="text-[11px] text-gray-500">※ 메모가 접혀 있어도 첫 번째 줄은 공개 페이지에 요약되어 노출됩니다.</p>
            </div>

            {/* 하단 버튼 */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#22272c]/60">
              <button
                onClick={() => setMemoModalVersion(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:bg-[#22272c] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSaveMemoModal}
                className="px-4 py-2 rounded-lg text-xs font-extrabold bg-[#f5a623] text-black hover:bg-[#f5a623]/90 transition-all cursor-pointer"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
