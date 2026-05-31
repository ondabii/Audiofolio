import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

export const runtime = "edge";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await context.params;
  
  try {
    const body = await request.json();
    const { fileName, contentType, durationMs, bitrate, fileSizeBytes, waveformData } = body;

    if (!fileName || !contentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const versionId = nanoid(10);
    const objectKey = `tracks/${trackId}/${versionId}_${fileName}`;

    const DB = (process.env as any).DB;
    if (!DB) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }

    // 1. D1 레코드 생성 (pending 상태)
    const sql = `
      INSERT INTO track_versions 
      (id, track_id, audio_url, is_representative, is_visible, duration_ms, file_format, bitrate, file_size_bytes, waveform_data, status)
      VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?, 'pending')
    `;
    
    await DB.prepare(sql).bind(
      versionId,
      trackId,
      objectKey,
      durationMs ? parseInt(durationMs) : null,
      contentType,
      bitrate ? parseInt(bitrate) : null,
      fileSizeBytes ? parseInt(fileSizeBytes) : null,
      waveformData || null
    ).run();

    // 풀스택 환경에서 R2에 직접 PUT 업로드할 수 있도록 동일 도메인의 /api/upload 상대경로 주소를 리턴해 줍니다.
    const uploadUrl = `/api/upload?trackId=${trackId}&versionId=${versionId}&fileName=${encodeURIComponent(fileName)}&durationMs=${durationMs || 0}&fileSizeBytes=${fileSizeBytes || 0}&bitrate=${bitrate || 0}`;

    return NextResponse.json({
      versionId,
      uploadUrl,
      objectKey
    });
  } catch (error: any) {
    console.error("API Error in versions POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
