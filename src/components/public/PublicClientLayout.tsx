'use client';

import { useProjectStore } from '@/store/projectStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { TrackItem } from '@/components/audio/TrackItem';
import { AudioEngine } from '@/components/audio/AudioEngine';
import { BottomBarPlayer } from '@/components/audio/BottomBarPlayer';
import { OfflineDownloadBanner } from '@/components/audio/OfflineDownloadBanner';
import { Lock } from 'lucide-react';

import { useRef } from 'react';

export function PublicClientLayout() {
  const project = useProjectStore(state => state.project);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  
  if (!project) return null;

  const allVersions = project.categories.flatMap(cat => 
    cat.tracks.flatMap(t => t.versions)
  );

  // 💡 좌측 사이드바 버튼을 제외한 모든 외부 배경 공간에서 휠 조작 시 메인 재생 영역 스크롤
  const handleOuterWheel = (e: React.WheelEvent) => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop += e.deltaY;
    }
  };

  return (
    <div 
      onWheel={handleOuterWheel}
      className="w-full h-full flex bg-[#111416] overflow-hidden justify-center relative pl-0 lg:pl-64 touch-pan-y"
    >
      <AudioEngine trackVersions={allVersions} />
      <BottomBarPlayer />

      <Sidebar projectTitle={project.title} categories={project.categories} />
      
      <main 
        ref={mainScrollRef}
        className="w-full max-w-4xl h-full overflow-y-auto pt-24 lg:pt-20 px-4 lg:px-10 pb-40 z-10 relative scrollbar-hide touch-pan-y"
      >
        <div id="top-anchor" className="absolute top-0 left-0 w-full h-1"></div>
        <div className="flex items-center justify-between mb-16">
          <h1 className="hidden lg:block text-2xl font-bold text-white tracking-tight flex-1">
            {project.title}
          </h1>
          {project.is_protected ? (
            <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
              <Lock className="w-4 h-4" /> PIN Protected
            </div>
          ) : null}
        </div>
        
        {project.categories.map((category) => (
          <div key={category.id} id={`cat-${category.id}`} className="mb-20 pt-4 relative group/cat">
            <h2 className="text-[20px] font-bold text-primary mb-10">
              {category.title}
            </h2>
            
            <div>
              {category.tracks.map((track) => (
                <TrackItem key={track.id} track={track} readOnly={true} />
              ))}
            </div>
          </div>
        ))}
        
        {project.categories.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            등록된 카테고리가 없습니다.
          </div>
        )}
      </main>
    </div>
  );
}
