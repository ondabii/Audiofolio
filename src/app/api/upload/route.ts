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

    const titleVal = fileName.split('.').slice(0, -1).join('.') || fileName;
    const formatVal = contentType.split('/')[1]?.toUpperCase() || 'WAV';
    const objectKey = `tracks/${trackId}/${versionId}_${fileName}`;

    // 1. D1 레코드 생성
    const sql = `
      INSERT INTO track_versions 
      (id, track_id, title, audio_url, is_representative, is_visible, duration_ms, file_format, bitrate, file_size_bytes, waveform_data, status)
      VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, 'active')
    `;
    const params = [
      versionId, 
      trackId, 
      titleVal,
      objectKey, 
      durationMs ? parseInt(durationMs) : null, 
      formatVal, 
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

    // 2. Upload to R2
    if (env.R2_BUCKET) {
      await env.R2_BUCKET.put(objectKey, request.body, {
        httpMetadata: { contentType: contentType }
      });
    } else {
      console.log(`ℹ️ No R2 binding. Local virtual upload success. Object key: ${objectKey}`);
    }

    const R2_PUBLIC_URL = env.R2_PUBLIC_URL || "https://afc.ondabii.com";
    const encodedKey = objectKey.split('/').map((seg: string) => encodeURIComponent(seg)).join('/');
    const publicUrl = `${R2_PUBLIC_URL}/${encodedKey}`;

    const newVersion = {
      id: versionId,
      track_id: trackId,
      title: titleVal,
      audio_url: objectKey,
      public_url: publicUrl,
      is_representative: false,
      is_visible: true,
      duration_ms: durationMs ? parseInt(durationMs) : 0,
      file_format: formatVal,
      bitrate: bitrate ? parseInt(bitrate) : 0,
      file_size_bytes: fileSizeBytes ? parseInt(fileSizeBytes) : 0,
      waveform_data: waveformData || null,
      order_index: 999
    };

    return NextResponse.json({ success: true, objectKey, version: newVersion });
  } catch (e: any) {
    console.error("Upload API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
