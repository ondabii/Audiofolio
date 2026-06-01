'use client';

import { useState } from 'react';
import { AudioLines, Menu } from 'lucide-react';

export function Sidebar({ projectTitle = 'Audiofolio Project', categories = [] }: { projectTitle?: string, categories?: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleSidebar = () => setIsOpen(!isOpen);

  // 모바일 뷰에서 링크 클릭 시 자동 닫힘 처리
  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Desktop Logo */}
      <div className="hidden lg:flex fixed top-8 right-10 z-40 text-xl font-extrabold tracking-tight text-white items-center gap-2 pointer-events-none">
        Audiofolio <AudioLines className="text-primary w-6 h-6" />
      </div>

      {/* Mobile/Tablet Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#111416]/95 backdrop-blur-md z-40 flex items-center px-4 border-b border-[#22272c]">
        <button onClick={toggleSidebar} className="p-2 text-gray-400 hover:text-white rounded-md flex-shrink-0">
          <Menu />
        </button>
        <button onClick={() => { document.getElementById('top-anchor')?.scrollIntoView({ behavior: 'smooth' }); handleLinkClick(); }} className="ml-2 text-sm font-bold text-white truncate flex-1 text-left">
          {projectTitle}
        </button>
        <div className="ml-4 text-sm font-extrabold text-white flex items-center gap-1 flex-shrink-0 pointer-events-none">
          <AudioLines className="text-primary w-5 h-5" />
        </div>
      </div>

      {/* Sidebar Overlay Backdrop */}
      {isOpen && (
        <div 
          onClick={toggleSidebar}
          className="fixed inset-0 bg-gray-500/50 z-20 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Content */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-main-bg transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col h-full pt-20 lg:pt-10`}>
        <div className="px-6 flex-1 overflow-y-auto scrollbar-hide">
          <div className="mb-10">
            <button onClick={() => { document.getElementById('top-anchor')?.scrollIntoView({ behavior: 'smooth' }); handleLinkClick(); }} className="text-sm font-medium text-white hover:text-gray-300 transition-colors text-left w-full outline-none">
              {projectTitle}
            </button>
          </div>

          {/* Render Categories */}
          {categories.length > 0 ? categories.map((cat, i) => (
            <div key={i} className="mb-10">
              <button onClick={() => { document.getElementById(`cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth' }); handleLinkClick(); }} className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3 hover:text-gray-400 transition-colors text-left w-full outline-none">
                {cat.title}
              </button>
              <ul className="space-y-3">
                {cat.tracks?.map((track: any) => (
                  <li key={track.id}>
                    <button onClick={() => { document.getElementById(`track-${track.id}`)?.scrollIntoView({ behavior: 'smooth' }); handleLinkClick(); }} className="block pl-4 text-gray-500 hover:text-gray-300 transition-colors text-left w-full">
                      {track.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )) : (
            <div className="mb-10">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3 block">
                No Categories
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
