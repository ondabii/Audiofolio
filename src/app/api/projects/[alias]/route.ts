import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ alias: string }> }
) {
  try {
    const alias = (await params).alias;
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get("admin") === "true";

    const DB = (process.env as any).DB;
    const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_URL || process.env.R2_PUBLIC_URL || "";

    if (!DB) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }

    const { results: projRes } = await DB.prepare(
      "SELECT * FROM projects WHERE custom_alias = ? OR short_id = ? OR id = ?"
    ).bind(alias, alias, alias).all();

    if (!projRes || projRes.length === 0) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const project = projRes[0];

    const { results: categories } = await DB.prepare(
      "SELECT * FROM categories WHERE project_id = ? ORDER BY order_index"
    ).bind(project.id).all();

    if (!categories || categories.length === 0) {
      return NextResponse.json({ ...project, categories: [] });
    }

    const catIds = categories.map((c: any) => `'${c.id}'`).join(',');
    const { results: tracks } = await DB.prepare(
      `SELECT * FROM tracks WHERE category_id IN (${catIds}) ORDER BY order_index`
    ).all();

    if (!tracks || tracks.length === 0) {
      return NextResponse.json({
        ...project,
        categories: categories.map((c: any) => ({ ...c, tracks: [] }))
      });
    }

    const trackIds = tracks.map((t: any) => `'${t.id}'`).join(',');
    let verQuery = `SELECT * FROM track_versions WHERE track_id IN (${trackIds}) ORDER BY order_index ASC, created_at DESC`;
    if (!isAdmin) {
      verQuery = `SELECT * FROM track_versions WHERE track_id IN (${trackIds}) AND is_visible = 1 AND status = 'active' ORDER BY order_index ASC, created_at DESC`;
    }
    const { results: versions } = await DB.prepare(verQuery).all();

    const assembled = {
      ...project,
      categories: categories.map((c: any) => ({
        ...c,
        tracks: tracks.filter((t: any) => t.category_id === c.id).map((t: any) => ({
          ...t,
          versions: (versions || []).filter((v: any) => v.track_id === t.id).map((v: any) => ({
            ...v,
            public_url: `${R2_PUBLIC_URL}/${v.audio_url}`
          }))
        }))
      }))
    };

    return NextResponse.json(assembled);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
