'use client';

import { useState } from 'react';
import { AudioLines, Plus, Pencil, ExternalLink, Trash2, Lock, HardDrive } from 'lucide-react';
import Link from 'next/link';

interface DashboardClientProps {
  initialProjects: any[];
}

export function DashboardClient({ initialProjects }: DashboardClientProps) {
  const [projects, setProjects] = useState<any[]>(initialProjects);

  const handleCreateProject = async () => {
    const title = prompt("새 프로젝트 제목을 입력하세요:");
    if (!title) return;

    const shortId = 'project-' + Math.random().toString(36).substring(2, 8);
    const id = crypto.randomUUID();

    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createProject',
        payload: { id, title, short_id: shortId }
      })
    });

    if (res.ok) {
      // Redirect directly to the editor of the new project
      window.location.href = `/admin/${shortId}`;
    } else {
      alert("프로젝트 생성 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteProject = async (id: string, title: string) => {
    if (confirm(`'${title}' 프로젝트와 모든 오디오 데이터를 영구 삭제하시겠습니까?`)) {
      setProjects(prev => prev.filter(p => p.id !== id));
      
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteProject',
          payload: { id }
        })
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#111416] w-full text-white">
      {/* Global Top Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-[#22272c] shrink-0 bg-[#111416] w-full">
        <Link href="/admin" className="relative z-20 flex items-center gap-2 font-extrabold tracking-tight text-xl text-white hover:text-primary transition-colors cursor-pointer select-none">
          <AudioLines className="text-primary w-6 h-6" />
          Audiofolio
          <span className="text-xs text-primary font-bold ml-1 px-1.5 py-0.5 bg-primary/10 rounded">ADMIN</span>
        </Link>
        <div className="flex-1"></div>
        <div className="flex justify-end">
          <button 
            onClick={() => window.location.href = '/'}
            className="text-sm bg-[#1c2126] text-gray-300 font-bold px-4 py-2 rounded hover:text-white hover:bg-[#252b31] transition-colors border border-[#22272c]"
          >
            메인으로 돌아가기
          </button>
        </div>
      </header>

      {/* Main Dashboard Panel (Centered 2/3 width) */}
      <div className="flex-1 flex justify-center bg-[#111416] py-12 px-6">
        <div className="w-full lg:w-[66%] max-w-6xl flex flex-col">
          
          {/* Action Header */}
          <div className="flex justify-between items-center mb-8 shrink-0">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">프로젝트 대시보드</h1>
              <p className="text-xs text-gray-500 font-bold mt-1">포트폴리오 프로젝트 목록을 관리하고 새 프로젝트를 생성합니다.</p>
            </div>
            <button 
              onClick={handleCreateProject}
              className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-black font-extrabold px-4 py-2 rounded transition-colors text-sm shadow-lg shadow-primary/10"
            >
              <Plus className="w-4 h-4" /> 새 프로젝트 생성
            </button>
          </div>

          {/* Projects Card Grid (No dotted quick button card) */}
          {projects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-[#22272c] rounded-xl text-center text-gray-500">
              <AudioLines className="w-12 h-12 text-gray-700 mb-3" />
              <p className="font-bold text-sm">등록된 프로젝트가 없습니다.</p>
              <button 
                onClick={handleCreateProject}
                className="mt-4 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-4 py-2 rounded font-bold transition-all text-xs"
              >
                첫 번째 프로젝트 생성하기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((proj: any) => {
                const editUrl = `/admin/${proj.custom_alias || proj.short_id || proj.id}`;
                const publicUrl = `/${proj.custom_alias || proj.short_id || proj.id}`;
                const formattedDate = proj.created_at 
                  ? new Date(proj.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
                  : 'N/A';
                  
                return (
                  <div 
                    key={proj.id} 
                    className="bg-[#161a1d] border border-[#22272c] rounded-xl p-6 flex flex-col justify-between hover:border-primary/30 transition-all shadow-md group/card min-h-[180px]"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3 min-w-0">
                        <h3 className="font-extrabold text-white text-lg truncate pr-3 flex-1">{proj.title}</h3>
                        {proj.is_protected ? (
                          <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded border border-primary/20 shrink-0 flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> 보호됨
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-800 text-gray-400 font-bold px-1.5 py-0.5 rounded border border-[#22272c] shrink-0">
                            공개됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-bold mb-6">최종 수정: {formattedDate}</p>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-[#22272c]/40 pt-4 mt-auto">
                      <div className="text-xs text-gray-500 font-bold flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-gray-600" />
                        <span>Storage: Unlimited</span>
                      </div>
                      <div className="flex gap-2">
                        <Link 
                          href={editUrl} 
                          className="p-1.5 rounded bg-[#1c2126] border border-[#22272c] text-gray-300 hover:text-white hover:bg-[#252b31] transition-colors" 
                          title="프로젝트 편집기 진입"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <Link 
                          href={publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded bg-[#1c2126] border border-[#22272c] text-gray-300 hover:text-primary hover:bg-[#252b31] transition-colors" 
                          title="게스트 공개 페이지 보기"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDeleteProject(proj.id, proj.title)}
                          className="p-1.5 rounded bg-[#1c2126] border border-[#22272c] text-gray-500 hover:text-red-400 hover:bg-[#252b31] transition-colors" 
                          title="프로젝트 영구 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
