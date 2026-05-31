import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await context.params;
  
  try {
    const body = await request.json();

    if (body.status === "active") {
      const sql = `UPDATE track_versions SET status = 'active' WHERE id = ?`;
      const dbRes = await executeQuery(sql, [versionId]);
      
      if (!dbRes || !dbRes.success) {
        return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
    
    if (body.is_visible !== undefined) {
      const sql = `UPDATE track_versions SET is_visible = ? WHERE id = ?`;
      await executeQuery(sql, [body.is_visible ? 1 : 0, versionId]);
      return NextResponse.json({ success: true });
    }

    if (body.is_representative !== undefined) {
      // 1. Get track_id of this version
      const getRes = await executeQuery(`SELECT track_id FROM track_versions WHERE id = ?`, [versionId]);
      const trackId = getRes?.result?.[0]?.track_id;
      
      if (trackId) {
        // 2. Reset all versions for this track
        await executeQuery(`UPDATE track_versions SET is_representative = 0 WHERE track_id = ?`, [trackId]);
        // 3. Set the chosen version as representative if requested
        if (body.is_representative) {
          await executeQuery(`UPDATE track_versions SET is_representative = 1 WHERE id = ?`, [versionId]);
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("API Error in versions PATCH:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
