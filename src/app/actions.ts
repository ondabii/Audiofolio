const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function callWorker(action: string, payload: any) {
  const res = await fetch(`${API_BASE}/api/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload })
  });
  if (!res.ok) throw new Error("Worker action failed");
  return res.json();
}

export async function renameProject(id: string, title: string) {
  await callWorker("renameProject", { id, title });
}

export async function updateProjectSettings(id: string, custom_alias: string | null) {
  await callWorker("updateProjectSettings", { id, custom_alias });
}

export async function addCategory(projectId: string, title: string) {
  const id = (Math.random() + 1).toString(36).substring(7); // temp fallback if nanoid missing client-side
  await callWorker("addCategory", { id, project_id: projectId, title });
}

export async function renameCategory(id: string, title: string) {
  await callWorker("renameCategory", { id, title });
}

export async function deleteCategory(id: string) {
  await callWorker("deleteCategory", { id });
}

export async function reorderCategories(updates: {id: string, order_index: number}[]) {
  await callWorker("reorderCategories", { updates });
}

export async function addTrack(categoryId: string, title: string) {
  const id = (Math.random() + 1).toString(36).substring(7);
  await callWorker("addTrack", { id, category_id: categoryId, title });
}

export async function renameTrack(id: string, title: string) {
  await callWorker("renameTrack", { id, title });
}

export async function deleteTrack(id: string) {
  await callWorker("deleteTrack", { id });
}

export async function reorderTracks(updates: {id: string, order_index: number}[]) {
  await callWorker("reorderTracks", { updates });
}

export async function renameVersion(id: string, title: string) {
  await callWorker("renameVersion", { id, title });
}

export async function deleteVersion(id: string) {
  await callWorker("deleteVersion", { id });
}

export async function reorderVersions(updates: {id: string, order_index: number}[]) {
  await callWorker("reorderVersions", { updates });
}
