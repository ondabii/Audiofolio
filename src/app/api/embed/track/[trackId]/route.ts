import { NextRequest, NextResponse } from 'next/server';
import { getEmbedTrackData } from '@/lib/db';

export const runtime = 'edge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const resolvedParams = await params;
  const trackId = resolvedParams.trackId;

  if (!trackId) {
    return NextResponse.json(
      { error: "Track ID is required" },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const data = await getEmbedTrackData(trackId);
    if (!data) {
      return NextResponse.json(
        { error: "Track not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(data, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Embed Track API Error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500, headers: corsHeaders }
    );
  }
}
