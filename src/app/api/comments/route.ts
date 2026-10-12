import { NextRequest, NextResponse } from 'next/server';
import { executeD1Query } from '@/lib/db';

export const runtime = 'edge';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// ─── 1. 댓글 목록 조회 (GET) ───
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const trackId = url.searchParams.get('track_id');
  const isAdmin = url.searchParams.get('admin') === 'true';

  if (!trackId) {
    return NextResponse.json({ error: "track_id is required" }, { status: 400, headers: corsHeaders });
  }

  try {
    const { results } = await executeD1Query(
      "SELECT * FROM comments WHERE track_id = ? ORDER BY created_at ASC",
      [trackId]
    );

    const comments = (results || []).map((row: any) => ({
      id: String(row.id),
      track_id: String(row.track_id),
      author_name: String(row.author_name),
      content: String(row.content),
      is_admin: row.is_admin === 1 || row.is_admin === true,
      created_at: String(row.created_at),
      // 💡 어드민 요청일 때만 실제 IP 주소를 전달하고, 일반 방문자에게는 철저히 은닉
      ip_address: isAdmin ? (row.ip_address ? String(row.ip_address) : 'Unknown') : undefined
    }));

    return NextResponse.json({ success: true, comments }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("GET comments error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch comments" }, { status: 500, headers: corsHeaders });
  }
}

// ─── 2. 댓글 작성 등록 (POST) ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      track_id?: string;
      author_name?: string;
      content?: string;
      is_admin?: boolean;
    };

    const { track_id, author_name, content, is_admin } = body;

    if (!track_id || !author_name?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    // 클라이언트 IP 추출 (Cloudflare Edge 헤더 최우선)
    const clientIp = request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';

    const id = crypto.randomUUID();
    const cleanAuthor = author_name.trim().slice(0, 50);
    const cleanContent = content.trim().slice(0, 1000);
    const adminFlag = is_admin ? 1 : 0;
    const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

    await executeD1Query(
      `INSERT INTO comments (id, track_id, author_name, content, is_admin, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, track_id, cleanAuthor, cleanContent, adminFlag, clientIp, createdAt]
    );

    const createdComment = {
      id,
      track_id,
      author_name: cleanAuthor,
      content: cleanContent,
      is_admin: Boolean(is_admin),
      created_at: createdAt,
      ip_address: is_admin ? clientIp : undefined
    };

    return NextResponse.json({ success: true, comment: createdComment }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("POST comment error:", error);
    return NextResponse.json({ error: error.message || "Failed to post comment" }, { status: 500, headers: corsHeaders });
  }
}

// ─── 3. 댓글 삭제 (DELETE) ───
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400, headers: corsHeaders });
  }

  try {
    await executeD1Query("DELETE FROM comments WHERE id = ?", [id]);
    return NextResponse.json({ success: true, id }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("DELETE comment error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete comment" }, { status: 500, headers: corsHeaders });
  }
}

// ─── 4. 댓글 수정 (PATCH) ───
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      id?: string;
      author_name?: string;
      content?: string;
    };

    const { id, author_name, content } = body;

    if (!id || (!author_name?.trim() && !content?.trim())) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    const cleanAuthor = author_name ? author_name.trim().slice(0, 50) : undefined;
    const cleanContent = content ? content.trim().slice(0, 1000) : undefined;

    if (cleanAuthor !== undefined && cleanContent !== undefined) {
      await executeD1Query(
        "UPDATE comments SET author_name = ?, content = ? WHERE id = ?",
        [cleanAuthor, cleanContent, id]
      );
    } else if (cleanContent !== undefined) {
      await executeD1Query(
        "UPDATE comments SET content = ? WHERE id = ?",
        [cleanContent, id]
      );
    } else if (cleanAuthor !== undefined) {
      await executeD1Query(
        "UPDATE comments SET author_name = ? WHERE id = ?",
        [cleanAuthor, id]
      );
    }

    return NextResponse.json({
      success: true,
      comment: { id, author_name: cleanAuthor, content: cleanContent }
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("PATCH comment error:", error);
    return NextResponse.json({ error: error.message || "Failed to update comment" }, { status: 500, headers: corsHeaders });
  }
}
