'use client';

import { useState } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Volume } from 'lucide-react';
import { useAudioStore } from '@/store/audioStore';
import { useProjectStore } from '@/store/projectStore';

export function BottomBarPlayer() {
  const project = useProjectStore(state => state.project);
  const playingVersionId = useAudioStore(state => state.playingVersionId);
  const isPlaying = useAudioStore(state => state.isPlaying);
  const setIsPlaying = useAudioStore(state => state.setIsPlaying);
  const volume = useAudioStore(state => state.volume);
  const setVolume = useAudioStore(state => state.setVolume);

  const [prevVolume, setPrevVolume] = useState(0.8);

  if (!project) return null;

  // Find active track and version details
  const getPlayingInfo = () => {
    if (!playingVersionId) return null;
    for (const category of project.categories) {
      for (const track of category.tracks) {
        const version = track.versions.find(v => v.id === playingVersionId);
        if (version) {
          return {
            trackTitle: track.title,
            versionTitle: version.title || `v${version.order_index}`
          };
        }
      }
    }
    return null;
  };

  const playingInfo = getPlayingInfo();

  // Volume icon logic based on level
  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX className="w-5 h-5 text-gray-500" />;
    if (volume < 0.3) return <Volume className="w-5 h-5 text-gray-400" />;
    if (volume < 0.7) return <Volume1 className="w-5 h-5 text-primary" />;
    return <Volume2 className="w-5 h-5 text-primary" />;
  };

  const handleMuteToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#161a1d]/95 border-t border-[#22272c] backdrop-blur-md z-40 flex items-center justify-center select-none shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
      <div className="w-full lg:w-[66%] max-w-6xl px-6 flex items-center justify-between gap-4 h-full">
        {/* Left: Active Version Title */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {playingInfo ? (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">재생 중</span>
              <span className="text-sm font-bold text-white truncate">
                {playingInfo.trackTitle} <span className="text-primary font-medium ml-1.5">{playingInfo.versionTitle}</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 text-sm font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse"></span>
              재생 중인 트랙이 없습니다
            </div>
          )}
        </div>

        {/* Center: Play/Pause Button */}
        <div className="flex items-center justify-center">
          <button
            disabled={!playingVersionId}
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              playingVersionId
                ? 'bg-primary text-black hover:scale-105 active:scale-95 shadow-md shadow-primary/20'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
            aria-label={isPlaying ? '일시정지' : '재생'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-black text-black" />
            ) : (
              <Play className="w-5 h-5 fill-black text-black ml-0.5" />
            )}
          </button>
        </div>

        {/* Right: Master Volume Slider */}
        <div className="flex-1 flex items-center justify-end gap-2.5">
          <button
            onClick={handleMuteToggle}
            className="p-1 hover:bg-[#22272c] rounded-md transition-colors"
            title={volume === 0 ? '음소거 해제' : '음소거'}
          >
            {getVolumeIcon()}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 sm:w-28 h-1 bg-[#111416] rounded-lg appearance-none cursor-pointer accent-primary"
            style={{
              background: `linear-gradient(to right, #f5a623 0%, #f5a623 ${volume * 100}%, #111416 ${volume * 100}%, #111416 100%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
