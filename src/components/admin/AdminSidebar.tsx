'use client';

import { AudioLines, Plus, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export function AdminSidebar({ projects, currentProjectId }: { projects: any[], currentProjectId: string }) {
  return (
    <aside className="w-64 bg-[#161a1d] border-r border-[#22272c] flex flex-col h-full flex-shrink-0 fixed left-0 top-0 bottom-0 z-40">
      <div className="p-6">
        <Link href="/admin" className="flex items-center gap-2 text-xl font-extrabold text-white mb-8 hover:text-primary transition-colors">
          Audiofolio <AudioLines className="text-primary w-5 h-5" />
          <span className="text-xs text-primary font-bold ml-1 px-1.5 py-0.5 bg-primary/10 rounded">ADMIN</span>
        </Link>

        <button className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-2 rounded-md font-bold transition-colors mb-6 text-sm">
          <Plus className="w-4 h-4" /> New Project
        </button>

        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Projects</h3>
        <ul className="space-y-2 overflow-y-auto max-h-[60vh] scrollbar-hide">
          {projects.map((proj: any) => {
            const isActive = proj.id === currentProjectId;
            return (
              <li key={proj.id}>
                <Link 
                  href={`/admin/${proj.custom_alias || proj.short_id || proj.id}`} 
                  className={`flex items-center justify-between p-2 rounded-md transition-colors ${isActive ? 'text-primary font-bold bg-[#1c2126]' : 'text-gray-400 hover:text-white hover:bg-[#1c2126]'}`}
                >
                  <span className="truncate">{proj.title}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      
      <div className="mt-auto p-6 border-t border-[#22272c]">
        <div className="text-xs text-gray-500 mb-1 font-bold">Total Storage Used</div>
        <div className="text-lg text-white font-bold">0 MB <span className="text-xs text-gray-500 font-normal">/ Unlimited</span></div>
      </div>
    </aside>
  );
}
