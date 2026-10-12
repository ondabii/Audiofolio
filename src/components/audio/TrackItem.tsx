'use client';

import { useEffect, useState } from 'react';
import { Play, Pause, Headphones, Loader, Sparkles, Download } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';
import { useProjectStore } from '@/store/projectStore';
import { InlineEditor } from '@/components/admin/InlineEditor';
import { TrackComments } from '@/components/audio/TrackComments';
import { initAudioContext } from '@/lib/audioContext';

export function TrackItem({ track, readOnly = false }: { track: any; readOnly?: boolean }) {
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const versionStates = useAudioStore(state => state.versionStates);
  const setPlayingVersionId = useAudioStore(state => state.setPlayingVersionId);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);

  // 💡 공개 페이지(readOnly === true)에서는 is_visible이 true인 버전만 노출
  const rawVersions: any[] = track.versions ?? [];
  const versions: any[] = readOnly
    ? rawVersions.filter((v: any) => v.is_visible === true || v.is_visible === 1 || v.is_visible === '1')
    : rawVersions;
  const isDownloadable = track.is_downloadable === 1 || track.is_downloadable === true;

  const handleDownloadVersion = async (v: any) => {
    try {
      const url = `/api/audio-url?key=${encodeURIComponent(v.audio_url)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("다운로드 실패");
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const ext = v.audio_url.split('.').pop() || 'ogg';
      a.download = `${track.title} - ${v.title || 'Version'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error(e);
      alert("파일 다운로드 중 에러가 발생했습니다.");
    }
  };

  // ─── 대표 버전 동적 결정 알고리즘 ───
  // 1. 수동 지정된 대표 버전 검사
  // 2. 수동 지정이 없으면 가장 생성 시각(created_at)이 늦은 최신 버전을 자동으로 지정
  const getRepresentativeId = (): string | null => {
    if (versions.length === 0) return null;
    const manualRep = versions.find(v => v.is_representative === true || v.is_representative === 1);
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

  const representativeVersionId = getRepresentativeId();

  // 이 트랙의 버전 중 현재 재생 중인 버전이 있는지 확인
  const isPlayingTrack = playingVersionId
    ? (versions.some((v: any) => v.id === playingVersionId) ?? false)
    : false;

  const isPlaylist = track.playback_mode === 'playlist';

  // 버전 재생/정지 토글
  const handlePlayToggle = (versionId: string) => {
    initAudioContext();
    if (playingVersionId === versionId) {
      setIsPlaying(!isPlaying);
    } else {
      if (isPlaylist) {
        useAudioStore.getState().setGlobalCurrentTime(0);
        useAudioStore.getState().setRawCurrentTime(0);
      }
      setPlayingVersionId(versionId);
      setIsPlaying(true);
    }
  };

  const handleUpdateTrack = async (newTitle: string) => {
    if (readOnly) return;
    useProjectStore.getState().updateTrackTitle(track.id, newTitle);
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renameTrack', payload: { id: track.id, title: newTitle } }),
    });
  };

  // 각 버전 별 실제 재생 길이(초) 결정 함수 (디코딩된 실제 오디오 데이터의 길이를 최우선 순위로 지정)
  const getVersionDuration = (v: any): number => {
    const st = versionStates[v.id];
    if (st?.durationMs && st.durationMs > 0) return st.durationMs / 1000;
    if (v.duration_ms && v.duration_ms > 0) return v.duration_ms / 1000;
    return 0;
  };

  // 트랙 내 최대 재생 길이 (스펙트럼 100% 기준)
  const maxDuration = versions.reduce((max, v) => Math.max(max, getVersionDuration(v)), 0);
  // 💡 독립형 댓글 블록인 경우: 오디오 스펙트럼 및 플레이어 생략하고 제목 + 댓글창만 렌더링
  if (track.track_type === 'comment') {
    return (
      <div id={`track-${track.id}`} className="mb-16 pt-4">
        {/* 댓글 영역 제목 */}
        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
          <InlineEditor
            initialValue={track.title}
            onSave={handleUpdateTrack}
            textClassName="text-lg font-bold text-white truncate"
            readOnly={readOnly}
          />
        </h3>
        <TrackComments trackId={track.id} isAdmin={!readOnly} />
      </div>
    );
  }

  const totalDisplayDuration = maxDuration;
  const isCommentEnabled = track.is_comment_enabled === 1 || track.is_comment_enabled === true;

  const currentPlayingVersion = versions.find((v: any) => v.id === playingVersionId);

  return (
    <div id={`track-${track.id}`} className="mb-16 pt-4">
      {/* 트랙 제목 */}
      <h3 className="text-lg font-bold text-white mb-4 flex items-center">
        <InlineEditor
          initialValue={track.title}
          onSave={handleUpdateTrack}
          textClassName="text-lg font-bold text-white truncate"
          readOnly={readOnly}
        />
      </h3>

      {/* 버전 목록 */}
      <div className="flex flex-col">
        {versions.map((version: any) => {
          const isRep = version.id === representativeVersionId;
          const isCurrent = playingVersionId === version.id;
          const vState = versionStates[version.id];

          // 버퍼 준비 여부: 이 트랙이 재생 중일 때만 로딩 상태 표시
          const isReady = isPlayingTrack && vState ? vState.isReady : true;
          const versionDuration = getVersionDuration(version);
          const rowHeight = isPlaylist || isRep ? 'h-16' : 'h-10';
          const showPause = isCurrent && isPlaying;
          const showPlayAsRep = isPlaylist || isRep;

          return (
            <div key={version.id} className="flex flex-col">
              <div
                className={`grid grid-cols-[2rem_1fr] lg:grid-cols-[2.5rem_1fr] gap-x-2 lg:gap-x-3 ${rowHeight} items-center`}
              >
                {/* ── 재생/Solo 버튼 ── */}
                <div className="flex justify-center items-center h-full">
                  {!isReady ? (
                    <button
                      className="text-gray-700 cursor-not-allowed transition-colors flex items-center justify-center w-full h-full"
                      aria-label="로딩 중"
                    >
                      <Loader className="w-[18px] h-[18px] animate-spin" />
                    </button>
                  ) : (
                    <button
                      onPointerDown={() => initAudioContext()}
                      onClick={() => handlePlayToggle(version.id)}
                      className={`${
                        isCurrent || showPlayAsRep ? 'text-primary hover:text-primary/80' : 'text-gray-600 hover:text-primary'
                      } transition-colors flex items-center justify-center w-full h-full`}
                      aria-label={showPause ? '일시정지' : showPlayAsRep ? '재생' : 'Solo'}
                    >
                      {showPause ? (
                        <Pause className={showPlayAsRep ? 'w-6 h-6 fill-primary' : 'w-[18px] h-[18px]'} />
                      ) : showPlayAsRep ? (
                        <Play className="w-6 h-6 fill-primary" />
                      ) : (
                        <Headphones className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  )}
                </div>

                {/* ── 스펙트럼 영역 (버전명 오버레이 내장) ── */}
                <div className="h-full relative select-none">
                  <VersionProgressBar
                    version={version}
                    maxDuration={maxDuration}
                    isPlayingTrack={isPlayingTrack}
                    versionDuration={versionDuration}
                    isReady={isReady}
                    isRep={isRep}
                    isPlaylist={isPlaylist}
                    isDownloadable={isDownloadable}
                    onDownload={handleDownloadVersion}
                  />
                </div>
              </div>

              {/* ── 버전 메모 행 (접혀도 첫 줄 요약 표시) ── */}
              {version.memo && version.memo.trim().length > 0 && (
                <VersionMemoRow version={version} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── 하단 시간 표시 ── */}
      <div className="grid grid-cols-[2rem_1fr] lg:grid-cols-[2.5rem_1fr] gap-x-2 lg:gap-x-3 mt-1.5">
        <div />
        <div
          className={`flex justify-between text-[11px] lg:text-xs font-semibold px-1 ${
            isPlayingTrack ? 'text-primary' : 'text-gray-500'
          }`}
        >
          {/* 현재 재생 위치 (고주파 격리 컴포넌트: 미재생 시 항상 00:00 표시) */}
          <CurrentTimeText trackId={track.id} />
          {/* 총 길이 (연속 재생 모드이면서 버전이 2개 이상일 때: 미재생 시 --:--, 재생 시 현재 곡 길이 / 단일 버전 또는 AB 모드: 해당/최대 버전 총 길이 원래대로 표시) */}
          <span>
            {isPlaylist && versions.length > 1 ? (
              isPlayingTrack && currentPlayingVersion ? (
                formatTime(getVersionDuration(currentPlayingVersion))
              ) : (
                '--:--'
              )
            ) : (
              totalDisplayDuration > 0 ? formatTime(totalDisplayDuration) : '00:00'
            )}
          </span>
        </div>
      </div>

      {/* ── 댓글 영역 (허용된 경우에만 노출) ── */}
      {isCommentEnabled && (
        <TrackComments trackId={track.id} isAdmin={!readOnly} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// ⏱️ 고주파 렌더링 격리 전용 서브 컴포넌트
// ──────────────────────────────────────────────

/**
 * 진행 표시바 컴포넌트
 */
function VersionProgressBar({
  version,
  maxDuration,
  isPlayingTrack,
  versionDuration,
  isReady,
  isRep,
  isPlaylist = false,
  isDownloadable,
  onDownload,
}: {
  version: any;
  maxDuration: number;
  isPlayingTrack: boolean;
  versionDuration: number;
  isReady: boolean;
  isRep: boolean;
  isPlaylist?: boolean;
  isDownloadable: boolean;
  onDownload: (v: any) => void;
}) {
  const rawCurrentTime = useAudioStore(state => state.rawCurrentTime);
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const setPlayingVersionId = useAudioStore(state => state.setPlayingVersionId);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);
  const normalizedVersionIds = useAudioStore(state => state.normalizedVersionIds);
 
  const isCurrent = playingVersionId === version.id;
  const isNormalized = normalizedVersionIds[version.id] || false;

  // DB의 개별 버전 노멀라이즈 상태를 마운트/변경 시점에 스토어 상태로 역동기화 (게스트 뷰용)
  useEffect(() => {
    if (version) {
      const dbNormalize = version.is_normalized === 1 || version.is_normalized === true;
      const currentNormalize = useAudioStore.getState().normalizedVersionIds[version.id] || false;
      if (currentNormalize !== dbNormalize) {
        useAudioStore.setState((prev) => ({
          normalizedVersionIds: {
            ...prev.normalizedVersionIds,
            [version.id]: dbNormalize
          }
        }));
      }
    }
  }, [version, version.id]);
 
  // 스펙트럼 너비 비율 (연속 재생 모드일 때는 모든 버전이 100% 꽉 채움)
  const spectrumWidthPercent = isPlaylist
    ? 100
    : (maxDuration > 0 && versionDuration > 0
        ? Math.min((versionDuration / maxDuration) * 100, 100)
        : 100);
 
  // 재생 진행 퍼센트 (누적 시간 rawCurrentTime 기준 오차 없는 모듈로 연산 적용, 일시정지 시에도 위치 유지)
  let progressPercent = 0;
  if (versionDuration > 0) {
    const localTime = rawCurrentTime % versionDuration;
    progressPercent = Math.min((localTime / versionDuration) * 100, 100);
  }
 
  // waveform_data 파싱
  let waveformBars: number[] = [];
  try {
    if (version.waveform_data) {
      const parsed = typeof version.waveform_data === 'string'
        ? JSON.parse(version.waveform_data)
        : version.waveform_data;
      if (Array.isArray(parsed)) waveformBars = parsed;
    }
  } catch (e) {}
 
  // 형식 표시에서 "Audio/" 프리픽스 삭제
  const displayFormat = (version.file_format || 'WAV').replace(/^AUDIO\//i, '').toUpperCase();
 
  return (
    <div
      className={`h-full bg-[#1c2126] ${
        !isRep ? 'border-b border-[#22272c]' : ''
      } ${
        isPlayingTrack ? 'shadow-[0_0_15px_rgba(245,166,35,0.05)]' : ''
      } relative overflow-hidden hover:bg-[#252b31] cursor-pointer ${
        !isReady ? 'opacity-50' : ''
      }`}
      style={{ width: `${spectrumWidthPercent}%` }}
      onPointerDown={() => initAudioContext()}
      onClick={e => {
        if (!isReady) return;
        initAudioContext();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const seekTarget = percent * (versionDuration > 0 ? versionDuration : maxDuration);
        
        // 1. Seek 위치 변경 요청
        useAudioStore.getState().requestSeek(seekTarget);
        
        // 2. 재생할 버전 설정
        if (playingVersionId !== version.id) {
          setPlayingVersionId(version.id);
        }
        
        // 3. 멈춰있던 상태라면 그 즉시 그 자리에서 재생 가동
        if (!isPlaying) {
          setIsPlaying(true);
        }
      }}
    >
      {/* ── 버전 이름 (스펙트럼 좌측 상단 메타데이터형 캡슐화) ── */}
      <div className="absolute left-2.5 top-1.5 z-10 pointer-events-none select-none max-w-[75%]">
        <span
          className={`bg-black/50 border-gray-700/50 text-[10px] px-2 py-0.5 rounded border backdrop-blur-sm truncate inline-block ${
            isRep || isPlaylist ? 'font-bold text-primary border-primary/30' : 'font-medium text-gray-400'
          }`}
        >
          {version.title || `v${version.order_index}`}
        </span>
      </div>
 
      {/* 💡 진행 배경 & 재생선 (연속재생 모드는 오직 재생 중인 버전에만 노출) */}
      {(() => {
        const showProgress = isPlaylist ? (isCurrent && isPlayingTrack) : isPlayingTrack;
        return (
          <>
            {showProgress && (
              <div
                className={`absolute inset-0 ${isPlaying ? 'bg-primary/25' : 'bg-primary/20'} z-0`}
                style={{ width: `${progressPercent}%` }}
              />
            )}

            {showProgress && versionDuration > 0 && (
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_#f5a623] z-10 pointer-events-none"
                style={{
                  left: `${progressPercent}%`,
                }}
              />
            )}
          </>
        );
      })()}

      {/* 버퍼링 스트라이프 */}
      {!isReady && <div className="absolute inset-0 bg-stripes animate-pulse z-0" />}

      {/* 파형 막대 시각화 */}
      {waveformBars.length > 0 && (() => {
        const showProgress = isPlaylist ? (isCurrent && isPlayingTrack) : isPlayingTrack;
        const maxVal = Math.max(...waveformBars, 1);
        return (
          <div className="absolute inset-0 flex items-center px-0 z-[1] pointer-events-none" style={{ gap: '1px' }}>
            {waveformBars.map((val, i) => {
              const isPassed = showProgress && ((i + 1) / waveformBars.length) * 100 <= progressPercent;
              
              let barColor = 'rgba(255, 255, 255, 0.12)'; // 기본 회색 (로드 안 됨 혹은 아직 안 지나간 구간)
              
              if (isReady) {
                if (isPassed) {
                  if (isCurrent && isPlayingTrack) {
                    barColor = 'rgba(245, 166, 35, 0.9)'; // 재생 중인 버전 (노란색)
                  } else {
                    barColor = 'rgba(245, 166, 35, 0.38)'; // 재생 중이지 않은 버전 (어두운 주황색)
                  }
                }
              }

              // 💡 노멀라이즈 활성 시 피크값 기준 100% 한계치까지 비례 증폭 렌더링
              const displayVal = isNormalized ? val * (100 / maxVal) : val;

              return (
                <div
                  key={i}
                  className="flex-1 rounded-full origin-bottom"
                  style={{
                    height: `${Math.max(8, (displayVal / 100) * 85)}%`,
                    backgroundColor: barColor,
                  }}
                />
              );
            })}
          </div>
        );
      })()}
 
      {/* 다운로드 버튼: 노멀라이즈 없이 원본 저장. 캡슐 태그 바로 위(bottom-8)에 배치 */}
      {isDownloadable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(version);
          }}
          className="absolute right-1 bottom-8.5 z-20 p-1.5 bg-[#161a1d]/90 hover:bg-black border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white rounded-md transition-all active:scale-95 shadow-md flex items-center justify-center cursor-pointer"
          title="원본 오디오 다운로드 (Normalize 미적용)"
        >
          <Download className="w-3 h-3" />
        </button>
      )}

      {/* 포맷/비트레이트/노멀라이즈 뱃지: Audio/ 프리픽스 제거 및 비대표 버전도 비트레이트 모두 노출 */}
      <div className="absolute right-1 bottom-1 flex gap-1.5 z-10 items-center">
        <span
          className="bg-black/50 text-gray-400 border-gray-700/50 text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-sm uppercase"
        >
          {displayFormat}
        </span>
        {version.bitrate ? (
          <span
            className="bg-black/50 text-gray-400 border-gray-700/50 text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-sm uppercase"
          >
            {version.bitrate}kbps
          </span>
        ) : null}
        {isNormalized && (
          <span
            className="bg-black/50 text-gray-400 border-gray-700/50 text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-sm uppercase"
          >
            Normalized
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * 재생경과 시간 격리 표시 컴포넌트
 */
function CurrentTimeText({ trackId }: { trackId: string }) {
  const globalCurrentTime = useAudioStore(state => state.globalCurrentTime);
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const project = useProjectStore(state => state.project);

  const track = project?.categories
    ?.flatMap((c: any) => c.tracks || [])
    ?.find((t: any) => t.id === trackId);

  const isPlayingTrack = playingVersionId
    ? (track?.versions?.some((v: any) => v.id === playingVersionId) ?? false)
    : false;

  return <span>{isPlayingTrack ? formatTime(globalCurrentTime) : '00:00'}</span>;
}

// 시간 포맷 헬퍼 (초 → MM:SS)
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * 버전별 메모 표시 컴포넌트
 * - 접혀 있어도 첫 번째 줄이 요약 표시됨
 * - 펼치기/접기 인터랙션 지원
 */
function VersionMemoRow({ version }: { version: any }) {
  const [isExpanded, setIsExpanded] = useState<boolean>(
    Boolean(version.is_memo_default_expanded === 1 || version.is_memo_default_expanded === true)
  );

  const memo = (version.memo || '').trim();
  if (!memo) return null;

  const firstLine = memo.split('\n')[0];
  const isMultiLine = memo.includes('\n');

  return (
    <div className="grid grid-cols-[2rem_1fr] lg:grid-cols-[2.5rem_1fr] gap-x-2 lg:gap-x-3 mt-1 mb-2">
      <div />
      <div className="bg-[#161a1d]/70 hover:bg-[#161a1d] border border-[#22272c]/80 rounded px-2.5 py-1.5 text-xs text-gray-300 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0 flex-1">
            <span className="text-primary font-bold shrink-0 mt-0.5 text-[11px]">📝 Note:</span>
            {isExpanded ? (
              <div className="text-gray-300 whitespace-pre-wrap leading-relaxed break-words font-medium text-[11px] lg:text-xs">
                {memo}
              </div>
            ) : (
              <div className="truncate text-gray-400 font-medium text-[11px] lg:text-xs">
                {firstLine}
              </div>
            )}
          </div>
          {isMultiLine && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="shrink-0 text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer select-none"
              title={isExpanded ? "메모 접기" : "메모 전체 보기"}
            >
              <span>{isExpanded ? '접기' : '더보기'}</span>
              <span>{isExpanded ? '▴' : '▾'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
