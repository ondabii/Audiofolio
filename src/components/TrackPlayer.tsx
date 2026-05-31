"use client";

import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, Headphones, Loader } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { audioEngine } from "@/lib/audioEngine";

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TrackPlayer({ track }: { track: any }) {
  const { 
    isPlaying, 
    activeTrackId, 
    activeVersionId, 
    globalCurrentTime,
    readyVersions, 
    playTrack, 
    pause,
    resume,
    seek,
    switchVersion 
  } = useAudioStore();

  const allVersions = track.versions.map((v: any) => ({
    id: v.id,
    url: v.public_url,
    duration: v.duration_ms / 1000
  }));
  
  let repVersion = track.versions.find((v:any) => v.is_representative);
  if (!repVersion && track.versions.length > 0) repVersion = track.versions[0];

  const isTrackActive = activeTrackId === track.id;
  const [progress, setProgress] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState("00:00");
  const rafRef = useRef<number | null>(null);

  let currentDuration = repVersion?.duration_ms ? repVersion.duration_ms / 1000 : 1;
  if (isTrackActive) {
     const activeVer = allVersions.find((v:any) => v.id === activeVersionId);
     if (activeVer && activeVer.duration > 0) currentDuration = activeVer.duration;
  }

  useEffect(() => {
    if (isTrackActive && isPlaying) {
      const updateLoop = () => {
        const time = audioEngine.getCurrentTime();
        setProgress(time / currentDuration);
        setCurrentTimeStr(formatTime(time));
        rafRef.current = requestAnimationFrame(updateLoop);
      };
      rafRef.current = requestAnimationFrame(updateLoop);
    } else if (isTrackActive && !isPlaying) {
      const time = globalCurrentTime;
      setProgress(time / currentDuration);
      setCurrentTimeStr(formatTime(time));
    } else {
      setProgress(0);
      setCurrentTimeStr("00:00");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isTrackActive, isPlaying, globalCurrentTime, currentDuration]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isTrackActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = percent * currentDuration;
    seek(targetTime);
    setProgress(percent);
    setCurrentTimeStr(formatTime(targetTime));
  };

  const handleAction = async (version: any) => {
    const isReady = readyVersions.has(version.id);
    const isVersionActive = activeVersionId === version.id;

    if (isTrackActive) {
      if (isVersionActive) {
        if (isPlaying) pause();
        else resume();
      } else {
        if (!isReady) return;
        switchVersion(version.id);
      }
    } else {
      await playTrack(track.id, version.id, allVersions);
    }
  };

  if (track.versions.length === 0) {
    return (
      <div id={`track-${track.id}`} className="mb-16 pt-4">
        <h3 className="text-lg font-bold text-white truncate mb-4">{track.title}</h3>
        <div className="text-sm text-gray-600 italic">업로드된 버전이 없습니다.</div>
      </div>
    );
  }

  return (
    <div id={`track-${track.id}`} className="mb-16 pt-4">
      <h3 className="text-lg font-bold text-white truncate mb-4">{track.title}</h3>

      <div className="flex flex-col relative">
        <div className="grid grid-cols-[2.5rem_1fr_4rem] lg:grid-cols-[3rem_1fr_6rem] gap-x-2 relative z-10">
          {/* Left Column (Buttons) */}
          <div className="flex flex-col gap-2 relative z-20">
            {track.versions.map((v: any) => {
              const isRep = v.id === repVersion?.id;
              const isReady = readyVersions.has(v.id);
              const isVersionActive = activeVersionId === v.id;
              const isPlayingNow = isVersionActive && isPlaying;
              const isLoading = !isReady && isVersionActive;

              let Icon;
              let iconClass = "";
              if (isRep) {
                if (isLoading) {
                  Icon = Loader; iconClass = "animate-spin w-6 h-6 lg:w-8 lg:h-8 text-white";
                } else if (isPlayingNow) {
                  Icon = Pause; iconClass = "w-6 h-6 lg:w-8 lg:h-8 fill-white text-white";
                } else if (isTrackActive && isPlaying && !isVersionActive) {
                  Icon = Headphones; iconClass = "w-5 h-5 lg:w-6 lg:h-6 text-gray-400";
                } else {
                  Icon = Play; iconClass = "w-6 h-6 lg:w-8 lg:h-8 fill-white text-white";
                }
              } else {
                if (isLoading) {
                  Icon = Loader; iconClass = "animate-spin w-[18px] h-[18px] text-gray-400";
                } else if (isPlayingNow) {
                  Icon = Pause; iconClass = "w-[18px] h-[18px] fill-white text-white";
                } else {
                  Icon = Headphones; iconClass = "w-[18px] h-[18px] text-gray-400";
                }
              }

              return (
                <div key={v.id} className={`flex justify-center items-center ${isRep ? 'h-16' : 'h-8'}`}>
                  <button 
                    onClick={() => handleAction(v)}
                    disabled={!isReady && isTrackActive && !isVersionActive}
                    className={`flex items-center justify-center w-full h-full transition-colors cursor-pointer ${(!isReady && isTrackActive && !isVersionActive) ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'}`}
                  >
                    <Icon className={iconClass} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Middle Column (Waveforms & Global Playhead) */}
          <div className="flex flex-col gap-2 relative">
            <div 
              className="absolute top-0 bottom-0 left-0 right-0 z-30 cursor-pointer" 
              onClick={handleSeek}
              title={isTrackActive ? "재생 위치 탐색" : "재생을 먼저 시작하세요"}
            >
               {isTrackActive && (
                 <div 
                   className="absolute top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_8px_#f5a623] pointer-events-none"
                   style={{ left: `${progress * 100}%` }}
                 />
               )}
            </div>

            {track.versions.map((v: any) => {
              const isRep = v.id === repVersion?.id;
              const isVersionActive = activeVersionId === v.id;
              
              let peaks = new Array(100).fill(20);
              try {
                if (v.waveform_data) peaks = JSON.parse(v.waveform_data);
              } catch (e) {}

              return (
                <div key={v.id} className={`w-full ${isRep ? 'h-16' : 'h-8'} bg-[#1c2126] relative px-1 overflow-hidden transition-colors ${isVersionActive ? 'shadow-[0_0_15px_rgba(245,166,35,0.05)]' : ''}`}>
                  {/* Waveform Bar */}
                  <div className="absolute inset-0 flex items-center justify-between px-1 z-10 pointer-events-none">
                    {peaks.map((p:number, i:number) => {
                      const isPast = ((i + 1) / 100) <= progress;
                      return (
                        <div 
                          key={i} 
                          className={`w-[2px] sm:w-[3px] rounded-full ${isPast && isTrackActive ? 'bg-primary shadow-[0_0_5px_#f5a623]' : 'bg-gray-700/40'}`}
                          style={{ height: `${Math.max(15, p)}%` }}
                        />
                      );
                    })}
                  </div>
                  
                  {(!readyVersions.has(v.id) && isVersionActive) && (
                    <div className="absolute inset-0 bg-stripes animate-pulse z-0 pointer-events-none"></div>
                  )}

                  <div className="absolute right-1 bottom-1 flex gap-1 z-20 pointer-events-none">
                    <span className="bg-[#111416]/80 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#22272c] backdrop-blur-sm uppercase">{v.file_format?.split('/')[1]?.toUpperCase() || 'WAV'}</span>
                    {isRep && v.bitrate && (
                       <span className="bg-[#111416]/80 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#22272c] backdrop-blur-sm uppercase">{Math.round(v.bitrate / 1000)}kbps</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column (Filenames) */}
          <div className="flex flex-col gap-2 relative z-20">
            {track.versions.map((v: any) => {
              const isRep = v.id === repVersion?.id;
              const isVersionActive = activeVersionId === v.id;
              const fileName = v.title || v.audio_url.split('/').pop()?.split('_').slice(1).join('_') || 'Unknown_File';
              return (
                <div key={v.id} className={`flex items-center ${isRep ? 'h-16' : 'h-8'}`}>
                  <div className={`truncate text-xs lg:text-sm font-bold ${isVersionActive || isRep ? 'text-primary' : 'text-gray-500'} pl-1`}>
                    {fileName}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Timestamps at the very bottom */}
        <div className="grid grid-cols-[2.5rem_1fr_4rem] lg:grid-cols-[3rem_1fr_6rem] gap-x-2 mt-2">
          <div></div>
          <div className={`flex justify-between text-[10px] lg:text-xs font-bold px-1 ${isTrackActive ? 'text-primary' : 'text-gray-600'}`}>
            <span>{isTrackActive ? currentTimeStr : '00:00'}</span>
            <span>{formatTime(currentDuration)}</span>
          </div>
          <div></div>
        </div>

      </div>
    </div>
  );
}
