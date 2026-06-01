import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// 🗄️ Action query fallback helper for CUD database actions
async function executeActionQuery(sql: string, params: any[] = []) {
  let env = process.env as any;
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env) env = ctx.env;
  } catch (e) {}

  // 1. If DB binding exists, use it
  if (env.DB) {
    return await env.DB.prepare(sql).bind(...params).run();
  }

  // 2. Fallback to Cloudflare HTTP API using credentials in .env.local
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !dbId || !apiToken) {
    console.error("❌ CLOUDFLARE credentials missing in .env.local!");
    throw new Error("Cloudflare DB credentials not configured");
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params })
  });

  const data = await res.json() as any;
  if (!data.success) {
    console.error("Remote action query execution error:", data.errors);
    throw new Error(data.errors?.[0]?.message || "Remote D1 write transaction failed");
  }
  return data;
}

// 🗄️ Batch action helper supporting both D1 native batch and sequential HTTP fallback
async function executeActionBatch(statements: { sql: string, params: any[] }[]) {
  let env = process.env as any;
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env) env = ctx.env;
  } catch (e) {}

  if (env.DB) {
    const bindingStatements = statements.map(s => env.DB.prepare(s.sql).bind(...s.params));
    return await env.DB.batch(bindingStatements);
  }

  // HTTP Sequential Fallback for Local Dev
  const results = [];
  for (const s of statements) {
    const r = await executeActionQuery(s.sql, s.params);
    results.push(r);
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const env = process.env as any;
    const body = await request.json() as any;
    const { action, payload } = body;

    switch (action) {
      case "createProject":
        await executeActionQuery(
          "INSERT INTO projects (id, user_id, title, short_id, custom_alias) VALUES (?, ?, ?, ?, ?)",
          [payload.id, 'default_user', payload.title, payload.short_id, payload.short_id]
        );
        break;
      case "renameProject":
        await executeActionQuery("UPDATE projects SET title = ? WHERE id = ?", [payload.title, payload.id]);
        break;
      case "updateProjectSettings":
        await executeActionQuery("UPDATE projects SET custom_alias = ? WHERE id = ?", [payload.custom_alias, payload.id]);
        break;
      case "deleteProject":
        // 1. Fetch R2 files to delete
        let keysRes;
        try {
          const res = await executeActionQuery(`
            SELECT audio_url FROM track_versions 
            WHERE track_id IN (
              SELECT id FROM tracks WHERE category_id IN (
                SELECT id FROM categories WHERE project_id = ?
              )
            )
          `, [payload.id]);
          keysRes = res.results || [];
        } catch (e) {
          keysRes = [];
        }

        // 2. Delete R2 files
        if (keysRes && keysRes.length > 0 && env.R2_BUCKET) {
          for (const row of keysRes) {
            if (row.audio_url) {
              try {
                await env.R2_BUCKET.delete(row.audio_url);
              } catch (err) {
                console.error("Failed to delete R2 object:", row.audio_url, err);
              }
            }
          }
        }

        // 3. Delete Project from D1
        await executeActionQuery("DELETE FROM projects WHERE id = ?", [payload.id]);
        break;
      case "addCategory":
        let maxCatSort = 0;
        try {
          const catRes = await executeActionQuery("SELECT MAX(order_index) as max_sort FROM categories WHERE project_id = ?", [payload.project_id]);
          maxCatSort = catRes.results?.[0]?.max_sort || 0;
        } catch (e) {}
        await executeActionQuery(
          "INSERT INTO categories (id, project_id, title, order_index) VALUES (?, ?, ?, ?)",
          [payload.id, payload.project_id, payload.title, maxCatSort + 1]
        );
        break;
      case "renameCategory":
        await executeActionQuery("UPDATE categories SET title = ? WHERE id = ?", [payload.title, payload.id]);
        break;
      case "deleteCategory":
        await executeActionQuery("DELETE FROM categories WHERE id = ?", [payload.id]);
        break;
      case "reorderCategories":
        const catUpdates = payload.updates.map((u: any) => ({
          sql: "UPDATE categories SET order_index = ? WHERE id = ?",
          params: [u.order_index, u.id]
        }));
        await executeActionBatch(catUpdates);
        break;
      case "addTrack":
        let maxTrackSort = 0;
        try {
          const trackRes = await executeActionQuery("SELECT MAX(order_index) as max_sort FROM tracks WHERE category_id = ?", [payload.category_id]);
          maxTrackSort = trackRes.results?.[0]?.max_sort || 0;
        } catch (e) {}
        await executeActionQuery(
          "INSERT INTO tracks (id, category_id, title, order_index) VALUES (?, ?, ?, ?)",
          [payload.id, payload.category_id, payload.title, maxTrackSort + 1]
        );
        break;
      case "renameTrack":
        await executeActionQuery("UPDATE tracks SET title = ? WHERE id = ?", [payload.title, payload.id]);
        break;
      case "deleteTrack":
        await executeActionQuery("DELETE FROM tracks WHERE id = ?", [payload.id]);
        break;
      case "reorderTracks":
        const trackUpdates = payload.updates.map((u: any) => ({
          sql: "UPDATE tracks SET order_index = ? WHERE id = ?",
          params: [u.order_index, u.id]
        }));
        await executeActionBatch(trackUpdates);
        break;
      case "setRepresentativeVersion":
        await executeActionBatch([
          { sql: "UPDATE track_versions SET is_representative = 0 WHERE track_id = ?", params: [payload.track_id] },
          { sql: "UPDATE track_versions SET is_representative = 1 WHERE id = ?", params: [payload.id] }
        ]);
        break;
      case "toggleVersionVisibility":
        await executeActionQuery("UPDATE track_versions SET is_visible = ? WHERE id = ?", [payload.is_visible ? 1 : 0, payload.id]);
        break;
      case "renameVersion":
        await executeActionQuery("UPDATE track_versions SET title = ? WHERE id = ?", [payload.title, payload.id]);
        break;
      case "deleteVersion":
        let verRes;
        try {
          const res = await executeActionQuery("SELECT audio_url FROM track_versions WHERE id = ?", [payload.id]);
          verRes = res.results || [];
        } catch (e) {
          verRes = [];
        }
        const objectKey = verRes?.[0]?.audio_url;
        if (objectKey && env.R2_BUCKET) {
          try {
            await env.R2_BUCKET.delete(objectKey);
          } catch (e) {
            console.error("Failed to delete R2 file:", objectKey, e);
          }
        }
        await executeActionQuery("DELETE FROM track_versions WHERE id = ?", [payload.id]);
        break;
      case "reorderVersions":
        const verUpdates = payload.updates.map((u: any) => ({
          sql: "UPDATE track_versions SET order_index = ? WHERE id = ?",
          params: [u.order_index, u.id]
        }));
        await executeActionBatch(verUpdates);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Actions API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
