import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    const DB = (process.env as any).DB;
    const R2_BUCKET = (process.env as any).R2_BUCKET;

    if (!DB) {
      return NextResponse.json({ error: "Database binding not found" }, { status: 500 });
    }

    switch (action) {
      case "createProject":
        await DB.prepare(
          "INSERT INTO projects (id, user_id, title, short_id, custom_alias) VALUES (?, ?, ?, ?, ?)"
        ).bind(payload.id, 'default_user', payload.title, payload.short_id, payload.short_id).run();
        break;

      case "renameProject":
        await DB.prepare("UPDATE projects SET title = ? WHERE id = ?").bind(payload.title, payload.id).run();
        break;

      case "updateProjectSettings":
        await DB.prepare("UPDATE projects SET custom_alias = ? WHERE id = ?").bind(payload.custom_alias, payload.id).run();
        break;

      case "deleteProject":
        if (R2_BUCKET) {
          const { results: keysRes } = await DB.prepare(`
            SELECT audio_url FROM track_versions 
            WHERE track_id IN (
              SELECT id FROM tracks WHERE category_id IN (
                SELECT id FROM categories WHERE project_id = ?
              )
            )
          `).bind(payload.id).all();

          if (keysRes && keysRes.length > 0) {
            for (const row of keysRes) {
              if (row.audio_url) {
                try {
                  await R2_BUCKET.delete(row.audio_url);
                } catch (err) {
                  console.error("Failed to delete R2 object in Next.js API:", row.audio_url, err);
                }
              }
            }
          }
        }
        await DB.prepare("DELETE FROM projects WHERE id = ?").bind(payload.id).run();
        break;

      case "addCategory": {
        const { results: catRes } = await DB.prepare(
          "SELECT MAX(order_index) as max_sort FROM categories WHERE project_id = ?"
        ).bind(payload.project_id).all();
        const maxCatSort = catRes?.[0]?.max_sort || 0;
        await DB.prepare(
          "INSERT INTO categories (id, project_id, title, order_index) VALUES (?, ?, ?, ?)"
        ).bind(payload.id, payload.project_id, payload.title, maxCatSort + 1).run();
        break;
      }

      case "renameCategory":
        await DB.prepare("UPDATE categories SET title = ? WHERE id = ?").bind(payload.title, payload.id).run();
        break;

      case "deleteCategory":
        await DB.prepare("DELETE FROM categories WHERE id = ?").bind(payload.id).run();
        break;

      case "reorderCategories": {
        const catStatements = payload.updates.map((u: any) =>
          DB.prepare("UPDATE categories SET order_index = ? WHERE id = ?").bind(u.order_index, u.id)
        );
        await DB.batch(catStatements);
        break;
      }

      case "addTrack": {
        const { results: trackRes } = await DB.prepare(
          "SELECT MAX(order_index) as max_sort FROM tracks WHERE category_id = ?"
        ).bind(payload.category_id).all();
        const maxTrackSort = trackRes?.[0]?.max_sort || 0;
        await DB.prepare(
          "INSERT INTO tracks (id, category_id, title, order_index) VALUES (?, ?, ?, ?)"
        ).bind(payload.id, payload.category_id, payload.title, maxTrackSort + 1).run();
        break;
      }

      case "renameTrack":
        await DB.prepare("UPDATE tracks SET title = ? WHERE id = ?").bind(payload.title, payload.id).run();
        break;

      case "deleteTrack":
        await DB.prepare("DELETE FROM tracks WHERE id = ?").bind(payload.id).run();
        break;

      case "reorderTracks": {
        const trackStatements = payload.updates.map((u: any) =>
          DB.prepare("UPDATE tracks SET order_index = ? WHERE id = ?").bind(u.order_index, u.id)
        );
        await DB.batch(trackStatements);
        break;
      }

      case "renameVersion":
        await DB.prepare("UPDATE track_versions SET title = ? WHERE id = ?").bind(payload.title, payload.id).run();
        break;

      case "deleteVersion": {
        const { results: verRes } = await DB.prepare("SELECT audio_url FROM track_versions WHERE id = ?").bind(payload.id).all();
        const objectKey = verRes?.[0]?.audio_url;
        if (objectKey && R2_BUCKET) {
          await R2_BUCKET.delete(objectKey);
        }
        await DB.prepare("DELETE FROM track_versions WHERE id = ?").bind(payload.id).run();
        break;
      }

      case "reorderVersions": {
        const verStatements = payload.updates.map((u: any) =>
          DB.prepare("UPDATE track_versions SET order_index = ? WHERE id = ?").bind(u.order_index, u.id)
        );
        await DB.batch(verStatements);
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
