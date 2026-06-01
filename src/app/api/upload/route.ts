import { NextRequest, NextResponse } from 'next/server';
import { executeD1Query } from '@/lib/db';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function PUT(request: NextRequest) {
  try {
    let env: any = process.env || {};
    try {
      const ctx = getRequestContext();
      if (ctx && ctx.env) env = ctx.env;
    } catch (e) {}

    const url = new URL(request.url);
    const trackId = url.searchParams.get("trackId");
    const versionId = url.searchParams.get("versionId");
    const fileName = url.searchParams.get("fileName");
    
    if (!trackId || !versionId || !fileName) {
      return NextResponse.json({ error: "Missing metadata (trackId, versionId, fileName)" }, { status: 400 });
    }

    const contentType = request.headers.get("Content-Type") || "audio/wav";
    const durationMs = url.searchParams.get("durationMs");
    const fileSizeBytes = url.searchParams.get("fileSizeBytes");
    const bitrate = url.searchParams.get("bitrate");
    const waveformData = url.searchParams.get("waveformData");

    const objectKey = `tracks/${trackId}/${versionId}_${fileName}`;

    // 1. D1 레코드 생성 (바인딩이 있으면 바인딩 쿼리, 없으면 HTTP fallback 엔진 사용)
    const sql = `
      INSERT INTO track_versions 
      (id, track_id, audio_url, is_representative, is_visible, duration_ms, file_format, bitrate, file_size_bytes, waveform_data, status)
      VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?, 'active')
    `;
    const params = [
      versionId, 
      trackId, 
      objectKey, 
      durationMs ? parseInt(durationMs) : null, 
      contentType, 
      bitrate ? parseInt(bitrate) : null, 
      fileSizeBytes ? parseInt(fileSizeBytes) : null, 
      waveformData || null
    ];

    if (env.DB) {
      await env.DB.prepare(sql).bind(...params).run();
    } else {
      console.log("ℹ️ No D1 binding. Using remote D1 Fallback HTTP API to insert version.");
      await executeD1Query(sql, params);
    }

    // 2. Upload to R2 (바인딩이 있으면 실제 R2 버킷 저장, 없으면 가상 업로드 성공 처리)
    if (env.R2_BUCKET) {
      await env.R2_BUCKET.put(objectKey, request.body, {
        httpMetadata: { contentType: contentType }
      });
    } else {
      console.log(`ℹ️ No R2 binding. Local virtual upload success. Object key: ${objectKey}`);
    }

    return NextResponse.json({ success: true, objectKey });
  } catch (e: any) {
    console.error("Upload API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
