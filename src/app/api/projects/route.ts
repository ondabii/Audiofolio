// D1 Direct Database All Projects Route (Updated 2026-08-13)
import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const projects = await getAllProjects();
    return NextResponse.json(projects);
  } catch (e: any) {
    console.error("GET /api/projects failed:", e);
    return NextResponse.json({ error: e.message || "Failed to fetch projects" }, { status: 500 });
  }
}
