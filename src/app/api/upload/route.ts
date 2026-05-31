import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get("trackId");
    const versionId = searchParams.get("versionId");
    const fileName = searchParams.get("fileName");
    const durationMs = searchParams.get("durationMs");
    const fileSizeBytes = searchParams.get("fileSizeBytes");
    const bitrate = searchParams.get("bitrate");
    const waveformData = searchParams.get("waveformData");
    const contentType = request.headers.get("Content-Type") || "audio/wav";

    const DB = (process.env as any).DB;
    const R2_BUCKET = (process.env as any).R2_BUCKET;

    if (!DB || !R2_BUCKET) {
      return NextResponse.json({ error: "DB or R2 binding not found" }, { status: 500 });
    }

    if (!trackId || !versionId || !fileName) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const objectKey = `tracks/${trackId}/${versionId}_${fileName}`;

    await DB.prepare(`
      INSERT INTO track_versions 
      (id, track_id, audio_url, is_representative, is_visible, duration_ms, file_format, bitrate, file_size_bytes, waveform_data, status)
      VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      versionId, trackId, objectKey, 
      durationMs ? parseInt(durationMs) : null, 
      contentType, 
      bitrate ? parseInt(bitrate) : null, 
      fileSizeBytes ? parseInt(fileSizeBytes) : null, 
      waveformData || null
    ).run();

    const arrayBuffer = await request.arrayBuffer();
    await R2_BUCKET.put(objectKey, arrayBuffer, {
      httpMetadata: { contentType: contentType }
    });

    return NextResponse.json({ success: true, objectKey });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
