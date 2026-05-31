"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader, Plus, Folder, Trash2 } from "lucide-react";

export default function AdminHome() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAlias, setNewAlias] = useState("");

  const fetchProjects = () => {
    setLoading(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API_BASE}/api/projects`)
      .then((res) => res.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    // Alias가 비어있으면 자동으로 고유한 임시 alias 부여
    const finalAlias = newAlias.trim() || `project-${Math.random().toString(36).substring(2, 8)}`;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    
    // Create Project
    await fetch(`${API_BASE}/api/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "createProject",
        payload: {
          id: (Math.random() + 1).toString(36).substring(7),
          title: newTitle,
          short_id: finalAlias
        }
      })
    });
    
    setIsCreating(false);
    setNewTitle("");
    setNewAlias("");
    fetchProjects();
  };

  const handleDelete = async (projectId: string, projectTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmDelete = window.confirm(
      `"${projectTitle}" 프로젝트와 그 하위의 모든 트랙, R2에 저장된 오디오 파일들이 완전히 영구 삭제됩니다.\n정말로 삭제하시겠습니까?`
    );
    if (!confirmDelete) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      const res = await fetch(`${API_BASE}/api/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteProject",
          payload: { id: projectId }
        })
      });
      if (res.ok) {
        fetchProjects();
      } else {
        alert("프로젝트 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 통신 중 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-white bg-[#111416]">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111416] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-2xl font-bold">Projects</h1>
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-black font-semibold px-4 py-2 rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </header>

        {isCreating && (
          <form onSubmit={handleCreate} className="bg-[#1c2126] p-6 rounded-lg mb-8 border border-white/10">
            <h2 className="text-lg font-bold mb-4">Create New Project</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Project Name (e.g. My New Album)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 bg-[#111416] border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                autoFocus
              />
              <input
                type="text"
                placeholder="Short Alias (e.g. my-album)"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                className="flex-1 bg-[#111416] border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
              <button type="submit" className="bg-primary text-black px-4 py-2 rounded text-sm font-bold">
                Create
              </button>
              <button type="button" onClick={() => setIsCreating(false)} className="bg-white/10 text-white px-4 py-2 rounded text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No projects found. Create one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div 
                key={p.id}
                onClick={() => router.push(`/admin/${p.custom_alias || p.short_id}`)}
                className="bg-[#1c2126] hover:bg-[#23292e] border border-white/5 hover:border-primary/50 transition-all p-6 rounded-lg cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 truncate">
                    <Folder className="w-5 h-5 text-primary shrink-0" />
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors truncate">{p.title}</h3>
                  </div>
                  <button
                    onClick={(e) => handleDelete(p.id, p.title, e)}
                    className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded transition-all shrink-0"
                    title="프로젝트 영구 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-white/40 ml-8">/{p.custom_alias || p.short_id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
