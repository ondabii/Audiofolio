import { getEmbedTrackData } from '@/lib/db';
import { EmbedTrackClient } from '@/components/embed/EmbedTrackClient';
import type { Metadata } from 'next';

export const runtime = 'edge';
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ trackId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const trackId = resolvedParams.trackId;

  try {
    const data = await getEmbedTrackData(trackId);
    if (!data) {
      return { title: 'Track Not Found - Audiofolio' };
    }
    return {
      title: `${data.track.title} - ${data.project.title} (Audiofolio Embed)`,
      description: `Listen to ${data.track.title} on Audiofolio.`,
      robots: 'noindex, nofollow'
    };
  } catch {
    return { title: 'Audiofolio Embed Player' };
  }
}

export default async function EmbedTrackPage({ params }: PageProps) {
  const resolvedParams = await params;
  const trackId = resolvedParams?.trackId;

  if (!trackId) {
    return (
      <div className="w-full min-h-screen bg-[#111416] text-gray-500 flex items-center justify-center text-xs">
        Invalid Track ID
      </div>
    );
  }

  let embedData = null;
  try {
    embedData = await getEmbedTrackData(trackId);
  } catch (error) {
    console.error("Embed page error:", error);
  }

  if (!embedData) {
    return (
      <div className="w-full min-h-screen bg-[#111416] text-gray-400 flex flex-col items-center justify-center p-4 text-center">
        <p className="text-sm font-semibold mb-1">트랙을 찾을 수 없습니다.</p>
        <p className="text-xs text-gray-600">트랙이 비공개 상태이거나 삭제되었을 수 있습니다.</p>
      </div>
    );
  }

  return <EmbedTrackClient initialData={embedData} />;
}
