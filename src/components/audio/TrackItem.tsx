'use client';

import { Play, Pause, Headphones, Loader } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';
import { useProjectStore } from '@/store/projectStore';
import { InlineEditor } from '@/components/admin/InlineEditor';

export function TrackItem({ track, readOnly = false }: { track: any; readOnly?: boolean }) {
  // ✅ 부모는 더 이상 globalCurrentTime을 직접 구독하지 않음 (리렌더링 최소화)
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const versionStates = useAudioStore(state => state.versionStates);
  const setPlayingVersionId = useAudioStore(state => state.setPlayingVersionId);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);

  // 이 트랙의 버전 중 현재 재생 중인 버전이 있는지 확인
  const isPlayingTrack = playingVersionId
    ? (track.versions?.some((v: any) => v.id === playingVersionId) ?? false)
    : false;

  // 버전 재생/정지 토글
  const handlePlayToggle = (versionId: string) => {
    if (playingVersionId === versionId) {
      setIsPlaying(!isPlaying);
    } else {
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

  const handleUpdateVersion = async (versionId: string, newTitle: string) => {
    if (readOnly) return;
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renameVersion', payload: { id: versionId, title: newTitle } }),
    });
  };

  const versions: any[] = track.versions ?? [];

  // 각 버전 별 실제 재생 길이(초) 결정 함수
  const getVersionDuration = (v: any): number => {
    if (v.duration_ms && v.duration_ms > 0) return v.duration_ms / 1000;
    const st = versionStates[v.id];
    if (st?.durationMs && st.durationMs > 0) return st.durationMs / 1000;
    return 0;
  };

  // 트랙 내 최대 재생 길이 (스펙트럼 100% 기준)
  const maxDuration = versions.reduce((max, v) => Math.max(max, getVersionDuration(v)), 0);
  const totalDisplayDuration = maxDuration;

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
          const isRep = version.is_representative === true || version.is_representative === 1;
          const isCurrent = playingVersionId === version.id;
          const vState = versionStates[version.id];

          // 버퍼 준비 여부: 이 트랙이 재생 중일 때만 로딩 상태 표시
          const isReady = isPlayingTrack && vState ? vState.isReady : true;
          const versionDuration = getVersionDuration(version);
          const rowHeight = isRep ? 'h-16' : 'h-10';

          return (
            <div
              key={version.id}
              className={`grid grid-cols-[2rem_1fr_4rem] lg:grid-cols-[2.5rem_1fr_6rem] gap-x-1 lg:gap-x-2 ${rowHeight} items-center`}
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
                    onClick={() => handlePlayToggle(version.id)}
                    className={`${
                      isCurrent || isRep ? 'text-primary hover:text-primary/80' : 'text-gray-600 hover:text-primary'
                    } transition-colors flex items-center justify-center w-full h-full`}
                    aria-label={isCurrent && isPlaying ? '일시정지' : isRep ? '재생' : 'Solo'}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className={isRep ? 'w-6 h-6 fill-primary' : 'w-[18px] h-[18px]'} />
                    ) : isRep ? (
                      <Play className="w-6 h-6 fill-primary" />
                    ) : (
                      <Headphones className="w-[18px] h-[18px]" />
                    )}
                  </button>
                )}
              </div>

              {/* ── 스펙트럼 영역 ── */}
              <div className="h-full relative">
                <VersionProgressBar
                  version={version}
                  maxDuration={maxDuration}
                  isPlayingTrack={isPlayingTrack}
                  versionDuration={versionDuration}
                  isReady={isReady}
                  isRep={isRep}
                />
              </div>

              {/* ── 버전 이름 ── */}
              <div className="pl-1 min-w-0 flex items-center h-full">
                <InlineEditor
                  initialValue={version.title || `v${version.order_index}`}
                  onSave={async newTitle => handleUpdateVersion(version.id, newTitle)}
                  textClassName={`truncate text-xs lg:text-sm ${
                    isRep ? 'font-bold text-primary' : 'font-medium text-gray-500'
                  }`}
                  readOnly={readOnly}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 하단 시간 표시 ── */}
      <div className="grid grid-cols-[2rem_1fr_4rem] lg:grid-cols-[2.5rem_1fr_6rem] gap-x-1 lg:gap-x-2 mt-1.5">
        <div />
        <div
          className={`flex justify-between text-[11px] lg:text-xs font-semibold px-1 ${
            isPlayingTrack ? 'text-primary' : 'text-gray-500'
          }`}
        >
          {/* 현재 재생 위치 (고주파 격리 컴포넌트) */}
          <CurrentTimeText trackId={track.id} />
          {/* 총 길이 (최대 버전 기준) */}
          <span>{totalDisplayDuration > 0 ? formatTime(totalDisplayDuration) : '00:00'}</span>
        </div>
        <div />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// ⏱️ 고주파 렌더링 격리 전용 서브 컴포넌트
// ──────────────────────────────────────────────

/**
 * 진행 표시바 컴포넌트: globalCurrentTime을 격리 구독하여, 파형 전체의 무수히 많은 div 노드가
 * 프레임마다 재생성되는 CPU 병목 및 루프 소리 튐(Tick) 현상을 완치합니다.
 */
function VersionProgressBar({
  version,
  maxDuration,
  isPlayingTrack,
  versionDuration,
  isReady,
  isRep,
}: {
  version: any;
  maxDuration: number;
  isPlayingTrack: boolean;
  versionDuration: number;
  isReady: boolean;
  isRep: boolean;
}) {
  const globalCurrentTime = useAudioStore(state => state.globalCurrentTime);
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const setPlayingVersionId = useAudioStore(state => state.setPlayingVersionId);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);

  const isCurrent = playingVersionId === version.id;

  // 스펙트럼 너비 비율
  const spectrumWidthPercent =
    maxDuration > 0 && versionDuration > 0
      ? Math.min((versionDuration / maxDuration) * 100, 100)
      : 100;

  // 재생 진행 퍼센트
  let progressPercent = 0;
  if (isPlayingTrack && isPlaying && versionDuration > 0) {
    const localTime = globalCurrentTime % versionDuration;
    progressPercent = Math.min((localTime / versionDuration) * 100, 100);
  } else if (isCurrent && versionDuration > 0) {
    progressPercent = Math.min((globalCurrentTime / versionDuration) * 100, 100);
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
      onClick={e => {
        if (!isReady) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const seekTarget = percent * (versionDuration > 0 ? versionDuration : maxDuration);
        useAudioStore.getState().requestSeek(seekTarget);
        if (playingVersionId !== version.id) {
          setPlayingVersionId(version.id);
          setIsPlaying(true);
        }
      }}
    >
      {/* 진행 배경 */}
      {isPlayingTrack && (
        <div
          className={`absolute inset-0 ${isPlaying ? 'bg-primary/25' : 'bg-primary/20'} z-0`}
          style={{ width: `${progressPercent}%` }}
        />
      )}

      {/* 재생선(Playhead) */}
      {isPlayingTrack && versionDuration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_#f5a623] z-10 pointer-events-none"
          style={{
            left: `${progressPercent}%`,
          }}
        />
      )}

      {/* 버퍼링 스트라이프 */}
      {!isReady && <div className="absolute inset-0 bg-stripes animate-pulse z-0" />}

      {/* 파형 막대 시각화 */}
      {waveformBars.length > 0 && (
        <div className="absolute inset-0 flex items-center px-0 z-[1] pointer-events-none" style={{ gap: '1px' }}>
          {waveformBars.map((val, i) => (
            <div
              key={i}
              className="flex-1 rounded-[1px] origin-bottom"
              style={{
                height: `${Math.max(8, (val / 100) * 85)}%`,
                backgroundColor: isRep
                  ? `rgba(245, 166, 35, ${isPlayingTrack ? 0.55 : 0.3})`
                  : `rgba(255, 255, 255, ${isPlayingTrack ? 0.15 : 0.08})`,
              }}
            />
          ))}
        </div>
      )}

      {/* 포맷/비트레이트 뱃지 */}
      <div className="absolute right-1 bottom-1 flex gap-1 z-10">
        <span
          className={`${
            isRep
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-black/50 text-gray-400 border-gray-700/50'
          } text-[9px] font-bold px-1.5 py-0.5 rounded border backdrop-blur-sm uppercase`}
        >
          {version.file_format || 'WAV'}
        </span>
        {isRep && version.bitrate ? (
          <span className="bg-primary/20 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded border border-primary/30 backdrop-blur-sm uppercase">
            {version.bitrate}kbps
          </span>
        ) : null}
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
    .flatMap(c => c.tracks)
    .find(t => t.id === trackId);

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
