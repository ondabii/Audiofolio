'use client';

import { Play, Pause, Headphones, Loader } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';
import { useProjectStore } from '@/store/projectStore';
import { InlineEditor } from '@/components/admin/InlineEditor';

export function TrackItem({ track, readOnly = false }: { track: any; readOnly?: boolean }) {
  // ✅ 훅은 조건 없이 컴포넌트 최상위에서만 호출
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const versionStates = useAudioStore(state => state.versionStates);
  const globalCurrentTime = useAudioStore(state => state.globalCurrentTime);
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

  // ──────────────────────────────────────────────
  // 재생 시간 계산 (스펙트럼 비율 기준)
  // ──────────────────────────────────────────────
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

  // 총 표시 시간: 최대 길이 버전 기준
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
          const isRep = version.is_representative;
          const isCurrent = playingVersionId === version.id;
          const vState = versionStates[version.id];

          // 버퍼 준비 여부: 이 트랙이 재생 중일 때만 로딩 상태 표시
          const isReady = isPlayingTrack && vState ? vState.isReady : true;

          const versionDuration = getVersionDuration(version);

          // 스펙트럼 너비 비율 (maxDuration 대비)
          const spectrumWidthPercent =
            maxDuration > 0 && versionDuration > 0
              ? Math.min((versionDuration / maxDuration) * 100, 100)
              : 100;

          // 재생 진행 퍼센트:
          // - 현재 재생 중인 버전이면 isCurrent 기반
          // - 이 트랙이 재생 중이지만 다른 버전이면, 해당 버전 길이 내에서 globalCurrentTime 진행률
          let progressPercent = 0;
          if (isPlayingTrack && isPlaying && versionDuration > 0) {
            // 이 버전의 길이를 초과하면 loop 처리 (짧은 버전은 0으로 wrap-around)
            const localTime = globalCurrentTime % versionDuration;
            progressPercent = Math.min((localTime / versionDuration) * 100, 100);
          } else if (isCurrent && versionDuration > 0) {
            progressPercent = Math.min((globalCurrentTime / versionDuration) * 100, 100);
          }

          // 재생선(Playhead) 위치: 스펙트럼 너비 내에서의 비율
          // globalCurrentTime이 maxDuration 기준으로 스펙트럼 전체에서 어느 위치인지
          const playheadPercent =
            maxDuration > 0 && isPlayingTrack
              ? Math.min((globalCurrentTime / maxDuration) * 100, 100)
              : 0;

          // 대표 버전 높이: h-16(64px), 일반 버전: h-10(40px)
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
              {/* 그리드 1fr 셀 내부에 비율 너비로 실제 스펙트럼 div를 배치 */}
              <div className="h-full relative">
                {/* 비율 스펙트럼 bar: maxDuration 기준으로 짧은 버전은 더 좁게 */}
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
                    // seek 위치는 이 버전 기준이 아닌 클릭한 버전의 실제 길이 기준
                    const seekTarget = percent * (versionDuration > 0 ? versionDuration : maxDuration);
                    useAudioStore.getState().requestSeek(seekTarget);
                    // 클릭한 버전으로 재생 전환
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

                  {/* 재생선(Playhead): 이 트랙이 재생 중이면 모든 버전에 표시 */}
                  {isPlayingTrack && versionDuration > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_#f5a623] z-10 pointer-events-none"
                      style={{
                        // 스펙트럼 너비 내에서의 실제 playhead 위치
                        // = (globalCurrentTime % versionDuration) / versionDuration * 100%
                        left: `${progressPercent}%`,
                      }}
                    />
                  )}

                  {/* 버퍼링 스트라이프 */}
                  {!isReady && <div className="absolute inset-0 bg-stripes animate-pulse z-0" />}

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

      {/* ── 하단 시간 표시 (버튼 열 제외 스펙트럼 하단 양끝) ── */}
      <div className="grid grid-cols-[2rem_1fr_4rem] lg:grid-cols-[2.5rem_1fr_6rem] gap-x-1 lg:gap-x-2 mt-1.5">
        <div />
        <div
          className={`flex justify-between text-[11px] lg:text-xs font-semibold px-1 ${
            isPlayingTrack ? 'text-primary' : 'text-gray-500'
          }`}
        >
          {/* 현재 재생 위치 */}
          <span>{isPlayingTrack ? formatTime(globalCurrentTime) : '00:00'}</span>
          {/* 총 길이 (최대 버전 기준) */}
          <span>{totalDisplayDuration > 0 ? formatTime(totalDisplayDuration) : '00:00'}</span>
        </div>
        <div />
      </div>
    </div>
  );
}

// 시간 포맷 헬퍼 (초 → MM:SS)
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
