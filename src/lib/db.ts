import { getRequestContext } from '@cloudflare/next-on-pages';

export interface VersionData {
  id: string;
  track_id: string;
  title?: string;
  audio_url: string;
  public_url: string;
  is_representative: boolean;
  is_visible: boolean;
  duration_ms?: number;
  file_format?: string;
  bitrate?: number;
  file_size_bytes?: number;
  order_index: number;
}

export interface TrackData {
  id: string;
  category_id: string;
  title: string;
  order_index: number;
  versions: VersionData[];
}

export interface CategoryData {
  id: string;
  project_id: string;
  title: string;
  order_index: number;
  tracks: TrackData[];
}

export interface ProjectData {
  id: string;
  title: string;
  custom_alias: string;
  short_id?: string;
  is_protected?: boolean;
  pin_hash?: string;
  categories: CategoryData[];
}

// 🗄️ D1 Hybrid Query Engine: Supports local env.DB binding and remote Cloudflare HTTP Query API fallback
export async function executeD1Query(sql: string, params: any[] = []): Promise<{ results: any[] }> {
  let env: any = process.env || {};
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env) env = ctx.env;
  } catch (e) {
    // getRequestContext may fail in non-edge local environments
  }

  // 1. If real D1 binding exists (e.g. pages build or edge serverless binding), use prepare/all
  if (env.DB) {
    try {
      const bindingRes = await env.DB.prepare(sql).bind(...params).all();
      return { results: bindingRes.results || [] };
    } catch (err) {
      console.error("Binding D1 Query Error:", err);
      throw err;
    }
  }

  // 2. Fallback to Cloudflare D1 HTTP API using credentials in .env.local
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const dbId = env.CLOUDFLARE_D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !dbId || !apiToken) {
    console.warn("⚠️ D1 Database credentials missing. Check .env.local credentials.");
    throw new Error("D1 credentials not configured");
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
    cache: 'no-store'
  });

  const data = await res.json() as any;
  if (!data.success) {
    console.error("Remote D1 API execution error:", data.errors);
    throw new Error(data.errors?.[0]?.message || "Remote D1 query failed");
  }

  // HTTP D1 response structure returns: { success: true, result: [ { results: [...] } ] }
  return {
    results: data.result?.[0]?.results || []
  };
}

export async function getProjectData(alias: string) {
  try {
    const { results: projRes } = await executeD1Query(
      "SELECT * FROM projects WHERE custom_alias = ? OR short_id = ? OR id = ?",
      [alias, alias, alias]
    );

    if (!projRes || projRes.length === 0) {
      return null;
    }

    const project = projRes[0];
    const { results: categories } = await executeD1Query(
      "SELECT * FROM categories WHERE project_id = ? ORDER BY order_index",
      [project.id]
    );

    if (!categories || categories.length === 0) {
      return { ...project, categories: [] };
    }

    const catIds = categories.map((c: any) => `'${c.id}'`).join(',');
    const { results: tracks } = await executeD1Query(
      `SELECT * FROM tracks WHERE category_id IN (${catIds}) ORDER BY order_index`
    );

    if (!tracks || tracks.length === 0) {
      return { ...project, categories: categories.map((c: any) => ({...c, tracks: []})) };
    }

    const trackIds = tracks.map((t: any) => `'${t.id}'`).join(',');
    const { results: versions } = await executeD1Query(
      `SELECT * FROM track_versions WHERE track_id IN (${trackIds}) ORDER BY order_index ASC, created_at DESC`
    );

    let env: any = process.env;
    try {
      const ctx = getRequestContext();
      if (ctx && ctx.env) env = ctx.env;
    } catch (e) {}
    
    const R2_PUBLIC_URL = env.R2_PUBLIC_URL || "https://afc.ondabii.com";

    const assembled = {
      ...project,
      categories: categories.map((c: any) => ({
        ...c,
        tracks: tracks.filter((t: any) => t.category_id === c.id).map((t: any) => ({
          ...t,
          versions: (versions || []).filter((v: any) => v.track_id === t.id).map((v: any) => ({
            ...v,
            public_url: R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${v.audio_url}` : v.audio_url
          }))
        }))
      }))
    };

    return assembled;
  } catch (error) {
    console.error("❌ D1 Database Fetching failed for alias:", alias, error);
    throw error;
  }
}

function getMockProjectData(alias: string) {
  return {
    id: 'mock-project-123',
    alias: alias,
    title: `Project: ${alias}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    categories: [
      {
        id: 'cat-1',
        project_id: 'mock-project-123',
        title: 'Commercial BGM',
        order_index: 0,
        tracks: [
          {
            id: 'track-1',
            category_id: 'cat-1',
            title: 'Intro_SynthWave',
            order_index: 0,
            versions: [
              { id: 'v1', track_id: 'track-1', title: 'v1_Draft', is_representative: false, order_index: 1, file_format: 'WAV', audio_url: '' },
              { id: 'v2', track_id: 'track-1', title: 'v2_Mix', is_representative: true, order_index: 2, file_format: 'OGG', bitrate: 320, audio_url: '' }
            ]
          }
        ]
      }
    ]
  };
}

export async function getAllProjects() {
  try {
    const { results } = await executeD1Query("SELECT * FROM projects ORDER BY created_at DESC");
    return results || [];
  } catch (error) {
    console.error("❌ Database query in getAllProjects failed:", error);
    throw error;
  }
}
