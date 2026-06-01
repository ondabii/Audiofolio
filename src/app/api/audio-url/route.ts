import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

/**
 * 🎵 오디오 스트리밍 프록시
 * 
 * R2 Public Domain에 CORS 헤더가 없어 브라우저에서 직접 fetch 불가.
 * 이 라우트가 서버 사이드에서 R2에서 오디오를 가져와 CORS 헤더를 붙여 응답.
 * 
 * 사용법: GET /api/audio-url?key=tracks/xxx/yyy.ogg
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'key 파라미터가 필요합니다' }, { status: 400 });
  }

  // 보안: 경로 순회 방지
  if (key.includes('..') || key.startsWith('/')) {
    return NextResponse.json({ error: '유효하지 않은 경로입니다' }, { status: 400 });
  }

  let env: any = process.env;
  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    if (ctx?.env) env = ctx.env;
  } catch (e) {}

  const R2_PUBLIC_URL = env.R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || 'https://afc.ondabii.com';
  const audioUrl = `${R2_PUBLIC_URL}/${key}`;

  try {
    const upstream = await fetch(audioUrl, {
      headers: {
        // Range 헤더 전달 (오디오 스트리밍 범위 요청 지원)
        ...(request.headers.get('range') ? { Range: request.headers.get('range')! } : {}),
      },
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `R2에서 오디오 로드 실패: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    // 응답 헤더 복사 + CORS 추가
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'audio/ogg');
    responseHeaders.set('Content-Length', upstream.headers.get('Content-Length') || '');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=86400'); // 24시간 캐시
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

    if (upstream.headers.get('Content-Range')) {
      responseHeaders.set('Content-Range', upstream.headers.get('Content-Range')!);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('오디오 프록시 오류:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
