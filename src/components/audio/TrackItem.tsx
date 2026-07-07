'use client';

import { useEffect } from 'react';
import { Play, Pause, Headphones, Loader, Sparkles } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';
import { useProjectStore } from '@/store/projectStore';
import { InlineEditor } from '@/components/admin/InlineEditor';

export function TrackItem({ track, readOnly = false }: { track: any; readOnly?: boolean }) {
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const versionStates = useAudioStore(state => state.versionStates);
  const setPlayingVersionId = useAudioStore(state => state.setPlayingVersionId);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);

  const versions: any[] = track.versions ?? [];

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

  // 각 버전 별 실제 재생 길이(초) 결정 함수 (디코딩된 실제 오디오 데이터의 길이를 최우선 순위로 지정)
  const getVersionDuration = (v: any): number => {
    const st = versionStates[v.id];
    if (st?.durationMs && st.durationMs > 0) return st.durationMs / 1000;
    if (v.duration_ms && v.duration_ms > 0) return v.duration_ms / 1000;
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
          const isRep = version.id === representativeVersionId;
          const isCurrent = playingVersionId === version.id;
          const vState = versionStates[version.id];

          // 버퍼 준비 여부: 이 트랙이 재생 중일 때만 로딩 상태 표시
          const isReady = isPlayingTrack && vState ? vState.isReady : true;
          const versionDuration = getVersionDuration(version);
          const rowHeight = isRep ? 'h-16' : 'h-10';

          return (
            <div
              key={version.id}
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

              {/* ── 스펙트럼 영역 (버전명 오버레이 내장) ── */}
              <div className="h-full relative select-none">
                <VersionProgressBar
                  version={version}
                  maxDuration={maxDuration}
                  isPlayingTrack={isPlayingTrack}
                  versionDuration={versionDuration}
                  isReady={isReady}
                  isRep={isRep}
                />
              </div>
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
          {/* 현재 재생 위치 (고주파 격리 컴포넌트) */}
          <CurrentTimeText trackId={track.id} />
          {/* 총 길이 (최대 버전 기준) */}
          <span>{totalDisplayDuration > 0 ? formatTime(totalDisplayDuration) : '00:00'}</span>
        </div>
      </div>
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
}: {
  version: any;
  maxDuration: number;
  isPlayingTrack: boolean;
  versionDuration: number;
  isReady: boolean;
  isRep: boolean;
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
 
  // 스펙트럼 너비 비율
  const spectrumWidthPercent =
    maxDuration > 0 && versionDuration > 0
      ? Math.min((versionDuration / maxDuration) * 100, 100)
      : 100;
 
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
      onClick={e => {
        if (!isReady) return;
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
            isRep ? 'font-bold text-primary border-primary/30' : 'font-medium text-gray-400'
          }`}
        >
          {version.title || `v${version.order_index}`}
        </span>
      </div>
 
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
      {waveformBars.length > 0 && (() => {
        const maxVal = Math.max(...waveformBars, 1);
        return (
          <div className="absolute inset-0 flex items-center px-0 z-[1] pointer-events-none" style={{ gap: '1px' }}>
            {waveformBars.map((val, i) => {
              const isPassed = isPlayingTrack && ((i + 1) / waveformBars.length) * 100 <= progressPercent;
              
              let barColor = 'rgba(255, 255, 255, 0.12)'; // 기본 회색 (로드 안 됨 혹은 아직 안 지나간 구간)
              
              if (isReady) {
                if (isPassed) {
                  if (isCurrent && isPlayingTrack) {
                    barColor = 'rgba(245, 166, 35, 0.9)'; // 재생 중인 버전 (노란색)
                  } else {
                    barColor = 'rgba(255, 255, 255, 0.85)'; // 재생 중이지 않은 버전 (하얀색)
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
 
      {/* 포맷/비트레이트 뱃지: Audio/ 프리픽스 제거 및 비대표 버전도 비트레이트 모두 노출 */}
      <div className="absolute right-1 bottom-1 flex gap-1 z-10">
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
