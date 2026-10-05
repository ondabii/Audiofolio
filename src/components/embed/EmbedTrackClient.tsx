'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { AudioEngine } from '@/components/audio/AudioEngine';
import { TrackItem } from '@/components/audio/TrackItem';
import { ExternalLink, Disc3 } from 'lucide-react';
import type { EmbedTrackResponse } from '@/lib/db';

interface EmbedTrackClientProps {
  initialData: EmbedTrackResponse;
}

export function EmbedTrackClient({ initialData }: EmbedTrackClientProps) {
  const setProject = useProjectStore(state => state.setProject);
  const isHydrated = useRef(false);

  const { track, project } = initialData;

  // 가상 프로젝트 구조 생성하여 projectStore에 주입 (TrackItem 호환 보장)
  useEffect(() => {
    if (!isHydrated.current) {
      setProject({
        id: project.id || 'embed-project',
        title: project.title || 'Audiofolio',
        custom_alias: project.custom_alias,
        categories: [
          {
            id: track.category_id || 'embed-category',
            project_id: project.id || 'embed-project',
            title: 'General',
            order_index: 0,
            tracks: [track]
          }
        ]
      });
      isHydrated.current = true;
    }
  }, [track, project, setProject]);

  const projectUrl = project.custom_alias ? `/${project.custom_alias}` : '/';

  return (
    <div className="w-full min-h-screen bg-[#111416] text-white flex flex-col justify-center px-3 py-3 select-none antialiased">
      {/* 1. 단일 트랙 오디오 엔진 (오토플레이 없음, 클릭 시에만 재생) */}
      <AudioEngine trackVersions={track.versions || []} />

      {/* 2. 임베드 헤더: 프로젝트 출처 & 로고 링크 */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#22272c]/80">
        <div className="flex items-center gap-1.5 min-w-0">
          <Disc3 className="w-3.5 h-3.5 text-primary shrink-0 animate-[spin_6s_linear_infinite]" />
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gray-400 hover:text-white transition-colors truncate font-medium flex items-center gap-1"
            title={`포트폴리오 보러가기: ${project.title}`}
          >
            <span>From</span>
            <span className="font-bold text-gray-200 underline decoration-gray-600 underline-offset-2">
              {project.title}
            </span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60 inline" />
          </a>
        </div>

        <a
          href="https://audiofolio.ondabii.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-bold text-gray-500 hover:text-primary transition-colors flex items-center gap-1 bg-[#161a1d] px-2 py-0.5 rounded border border-[#22272c]"
        >
          <span>Audiofolio</span>
        </a>
      </div>

      {/* 3. 사이트와 100% 동일한 트랙 플레이어 (가로폭 100% 가변 반응형) */}
      <div className="w-full">
        <TrackItem track={track} readOnly={true} />
      </div>
    </div>
  );
}
