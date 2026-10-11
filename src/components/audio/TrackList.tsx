'use client';

import { TrackItem } from './TrackItem';

export function TrackList({ categories = [] }: { categories: any[] }) {
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>등록된 트랙이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {categories.map((cat, catIdx) => (
        <div key={cat.id || catIdx} id={`cat-${cat.id}`} className="mb-20 pt-4">
          <h2 className="text-[20px] font-bold text-primary mb-10">
            {cat.title}
          </h2>
          {cat.tracks?.map((track: any) => (
            <TrackItem key={track.id} track={track} />
          ))}
        </div>
      ))}
    </div>
  );
}
