import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const body = await request.json();

    const DB = (process.env as any).DB;
    if (!DB) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }

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
      await DB.prepare(`UPDATE track_versions SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...binds, versionId)
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
