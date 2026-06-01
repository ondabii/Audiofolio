'use client';

import { useState, useRef } from 'react';
import { Star, Eye, EyeOff, UploadCloud, Trash2, Loader, Pencil, X } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { InlineEditor } from '@/components/admin/InlineEditor';
import { extractAudioMetadata } from '@/lib/audioUtils';

interface AdminTrackDetailProps {
  track: any;
  projectId: string;
}

export function AdminTrackDetail({ track, projectId }: AdminTrackDetailProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadText, setUploadText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteTrack = async () => {
    if (confirm("이 트랙과 속해있는 모든 버전을 삭제하시겠습니까? (R2 파일 포함)")) {
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
    // 스토어 상태 갱신은 간단한 화면 새로고침 또는 스토어 내 직접 교체로 할 수 있습니다.
    window.location.reload();
  };

  const handleToggleRepresentative = async (versionId: string, isRep: boolean) => {
    // 이미 대표 버전인데 클릭한 경우는 해제하지 않고 무시하거나 대표 상태를 유지합니다.
    if (isRep) return;

    // Zustand 스토어 즉시 반영
    useProjectStore.getState().setRepresentativeVersion(track.id, versionId);

    // API 호출
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'setRepresentativeVersion', 
        payload: { id: versionId, track_id: track.id } 
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
      window.location.reload();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadText(`오디오 분석 중: ${file.name}...`);

    try {
      // 1. Metadata 추출 (Duration 및 포맷 등)
      const meta = await extractAudioMetadata(file);
      
      const versionId = crypto.randomUUID();
      const fileName = encodeURIComponent(file.name);
      // R2 direct upload presigned URL을 받아와서 업로드하기 위한 파라미터 구성
      const url = `/api/upload?trackId=${track.id}&versionId=${versionId}&fileName=${fileName}&durationMs=${meta.durationMs}&fileSizeBytes=${meta.sizeBytes}&bitrate=${meta.bitrateKbps}`;

      setUploadText(`R2 직접 업로드 중: ${file.name}...`);
      
      // 2. XMLHttpRequest를 통한 진행율 표시 직접 업로드
      await new Promise((resolve, reject) => {
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

      setUploadProgress(100);
      setUploadText('업로드 및 메타데이터 저장 완료!');
      
      // UI 리로드
      window.location.reload();
      
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

  return (
    <div className="flex-1 flex flex-col bg-[#111416] min-w-0 lg:min-w-[400px] h-full">
      {/* Track Title Header */}
      <div className="p-6 border-b border-[#22272c] shrink-0 flex justify-between items-center bg-[#111416]">
        <div className="min-w-0 flex-1 pr-4">
          <h2 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2">
            <InlineEditor 
              initialValue={track.title} 
              onSave={handleUpdateTrack}
              textClassName="text-2xl font-extrabold text-white"
              isTitle={true}
            />
          </h2>
          <p className="text-xs text-gray-500 font-medium">버전 관리 및 오디오 업로드 (공개 페이지용 설정)</p>
        </div>
        <button 
          onClick={handleDeleteTrack} 
          className="text-red-500 hover:text-red-400 font-bold text-xs flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all shrink-0"
          title="트랙 삭제"
        >
          <Trash2 className="w-3.5 h-3.5" /> 트랙 삭제
        </button>
      </div>

      {/* Version List & Dropzone Container */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide flex flex-col min-w-0">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">업로드된 버전 목록</h3>
        <ul className="space-y-3 mb-6 w-full">
          {(!track.versions || track.versions.length === 0) ? (
            <div className="text-center py-8 text-gray-600 border border-dashed border-[#22272c] rounded-lg">
              업로드된 오디오 버전이 없습니다.
            </div>
          ) : (
            track.versions.map((version: any) => {
              const isRep = version.is_representative;
              const isVis = version.is_visible;
              return (
                <div 
                  key={version.id} 
                  className={`flex items-center gap-3 border p-3 rounded-md transition-all ${
                    isRep 
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
                      onClick={() => handleToggleRepresentative(version.id, isRep)}
                      className={`p-1 transition-transform hover:scale-110 ${isRep ? 'text-primary' : 'text-gray-500 hover:text-primary'}`} 
                      title={isRep ? "대표 버전 활성화됨" : "클릭하여 대표 버전으로 지정"}
                    >
                      <Star className={`w-4 h-4 ${isRep ? 'fill-primary text-primary' : ''}`} />
                    </button>
                  </div>

                  {/* Middle Info & Inline Rename */}
                  <div className="flex flex-col flex-1 min-w-0 gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <InlineEditor 
                          initialValue={version.title || `v${version.order_index}`} 
                          onSave={async (newTitle) => handleUpdateVersion(version.id, newTitle)}
                          textClassName={`text-sm font-bold truncate ${isRep ? 'text-white' : 'text-gray-300'}`}
                          isTitle={true}
                        />
                      </div>
                      {/* Right Tools: Eye & Delete */}
                      <div className="flex items-center gap-2 shrink-0">
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
        </div>
      </div>
    </div>
  );
}
