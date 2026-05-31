import { executeQuery } from "@/lib/db";
import { getPublicUrl } from "@/lib/r2";
import { nanoid } from "nanoid";

export async function getDefaultProjectAlias() {
  let projRes = await executeQuery("SELECT * FROM projects LIMIT 1");
  
  if (projRes && projRes.success && projRes.result.length === 0) {
    // Seed default project
    const projectId = nanoid(10);
    const shortId = "bias";
    await executeQuery("INSERT INTO projects (id, user_id, title, short_id, custom_alias) VALUES (?, ?, ?, ?, ?)", [projectId, 'default_user', 'Summer Album EP', shortId, shortId]);
    
    const catId = nanoid(10);
    await executeQuery("INSERT INTO categories (id, project_id, title, order_index) VALUES (?, ?, ?, ?)", [catId, projectId, 'Commercial BGM', 0]);
    
    const trackId = nanoid(10);
    await executeQuery("INSERT INTO tracks (id, category_id, title, order_index) VALUES (?, ?, ?, ?)", [trackId, catId, 'Intro_SynthWave', 0]);
    
    return shortId;
  }
  
  if (projRes && projRes.success && projRes.result.length > 0) {
    return projRes.result[0].custom_alias || projRes.result[0].short_id;
  }
  
  return null;
}

export async function getProjectByAlias(alias: string, isAdmin: boolean = false) {
  try {
    let projRes = await executeQuery("SELECT * FROM projects WHERE custom_alias = ? OR short_id = ? OR id = ?", [alias, alias, alias]);
    
    if (!projRes || !projRes.success || projRes.result.length === 0) {
        return null;
    }
    
    const project = projRes.result[0];

    const catRes = await executeQuery("SELECT * FROM categories WHERE project_id = ? ORDER BY order_index", [project.id]);
    const categories = catRes?.result || [];
    
    if (categories.length === 0) {
      return { ...project, categories: [] };
    }

    const catIds = categories.map((c: any) => `'${c.id}'`).join(',');
    const trackRes = await executeQuery(`SELECT * FROM tracks WHERE category_id IN (${catIds}) ORDER BY order_index`);
    const tracks = trackRes?.result || [];

    if (tracks.length === 0) {
      return { ...project, categories: categories.map((c:any) => ({...c, tracks: []})) };
    }

    const trackIds = tracks.map((t: any) => `'${t.id}'`).join(',');
    
    let verQuery = `SELECT * FROM track_versions WHERE track_id IN (${trackIds}) ORDER BY order_index ASC, created_at DESC`;
    if (!isAdmin) {
      verQuery = `SELECT * FROM track_versions WHERE track_id IN (${trackIds}) AND is_visible = 1 AND status = 'active' ORDER BY order_index ASC, created_at DESC`;
    }
    const verRes = await executeQuery(verQuery);
    const versions = verRes?.result || [];

    const assembled = {
      ...project,
      categories: categories.map((c: any) => ({
        ...c,
        tracks: tracks.filter((t: any) => t.category_id === c.id).map((t: any) => ({
          ...t,
          versions: versions
            .filter((v: any) => v.track_id === t.id)
            .map((v: any) => ({
              ...v,
              public_url: getPublicUrl(v.audio_url)
            }))
        }))
      }))
    };

    return assembled;
  } catch (error) {
    console.error("Data Fetch Error:", error);
    return null;
  }
}
