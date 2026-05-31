import { NextRequest, NextResponse } from "next/server";
import { executeQuery } from "@/lib/db";
import { generatePresignedUrl } from "@/lib/r2";
import { nanoid } from "nanoid";

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

    // 1. D1 레코드 생성 (pending 상태)
    const sql = `
      INSERT INTO track_versions 
      (id, track_id, audio_url, is_representative, is_visible, duration_ms, file_format, bitrate, file_size_bytes, waveform_data, status)
      VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?, 'pending')
    `;
    const params = [
      versionId,
      trackId,
      objectKey,
      durationMs || null,
      contentType,
      bitrate || null,
      fileSizeBytes || null,
      waveformData || null
    ];

    const dbRes = await executeQuery(sql, params);
    
    if (!dbRes || !dbRes.success) {
      console.error("Failed to insert into D1", dbRes);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 2. S3 Pre-signed URL 발급
    const uploadUrl = await generatePresignedUrl(objectKey, contentType);
    
    return NextResponse.json({
      versionId,
      uploadUrl,
      objectKey
    });
  } catch (error) {
    console.error("API Error in versions POST:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
