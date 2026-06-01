import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  try {
    const env = process.env as any;
    if (!env.DB) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const body = await request.json() as any;
    const updates: string[] = [];
    const binds: any[] = [];
    
    if (body.is_visible !== undefined) {
      updates.push("is_visible = ?"); 
      binds.push(body.is_visible ? 1 : 0);
    }
    if (body.is_representative !== undefined) {
      updates.push("is_representative = ?"); 
      binds.push(body.is_representative ? 1 : 0);
    }
    if (body.status !== undefined) {
      updates.push("status = ?"); 
      binds.push(body.status);
    }
    
    if (updates.length > 0) {
      await env.DB.prepare(`UPDATE track_versions SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...binds, id)
        .run();
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Versions API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
