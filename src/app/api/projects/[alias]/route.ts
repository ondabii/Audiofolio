import { NextRequest, NextResponse } from 'next/server';
import { getProjectData } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: NextRequest, { params }: { params: Promise<{ alias: string }> }) {
  const resolvedParams = await params;
  const alias = resolvedParams.alias;
  
  try {
    const data = await getProjectData(alias);
    if (!data) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    
    // Note: getProjectData currently returns all versions (admin view).
    // To support a strictly non-admin view, we can filter versions here if needed based on URL params.
    const url = new URL(request.url);
    const isAdmin = url.searchParams.get("admin") === "true";
    
    if (!isAdmin) {
      // Filter out non-visible versions
      data.categories = data.categories.map((c: any) => ({
        ...c,
        tracks: c.tracks.map((t: any) => ({
          ...t,
          versions: t.versions.filter((v: any) => v.is_visible && v.status === 'active')
        }))
      }));
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error("Projects API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
