"use client";

import { useState } from "react";
import { AudioLines, Menu } from "lucide-react";
import TrackPlayer from "@/components/TrackPlayer";

export default function MainClient({ project }: { project: any }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!project) {
    return <div className="text-white flex items-center justify-center h-screen font-bold">프로젝트 데이터가 없습니다. DB를 확인해 주세요.</div>;
  }

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebarOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleScrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    closeSidebarOnMobile();
  };

  return (
    <div className="h-screen w-screen overflow-hidden antialiased bg-main-bg relative flex justify-center">
      {/* Desktop Logo */}
      <div className="hidden lg:flex fixed top-8 right-10 z-40 text-xl font-extrabold tracking-tight text-white items-center gap-2 pointer-events-none">
        Audiofolio <AudioLines className="text-primary w-6 h-6" />
      </div>

      {/* Mobile/Tablet Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#111416]/95 backdrop-blur-md z-40 flex items-center px-4 border-b border-[#22272c]">
        <button onClick={toggleSidebar} className="p-2 text-gray-400 hover:text-white rounded-md flex-shrink-0">
          <Menu />
        </button>
        <button onClick={() => handleScrollTo('top-anchor')} className="ml-2 text-sm font-bold text-white truncate flex-1 text-left">
          {project.title}
        </button>
        <div className="ml-4 text-sm font-extrabold text-white flex items-center gap-1 flex-shrink-0 pointer-events-none">
          <AudioLines className="text-primary w-5 h-5" />
        </div>
      </div>

      {/* Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-500/50 z-20 lg:hidden transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-main-bg transform transition-transform duration-300 ease-in-out flex flex-col h-full pt-20 lg:pt-10 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="px-6 flex-1 overflow-y-auto scrollbar-hide">
          <div className="mb-10">
            <button onClick={() => handleScrollTo('top-anchor')} className="text-sm font-medium text-white hover:text-gray-300 transition-colors text-left w-full outline-none">
              {project.title}
            </button>
          </div>
          
          {project.categories.map((cat: any) => (
            <div key={cat.id} className="mb-10">
              <button onClick={() => handleScrollTo(`cat-${cat.id}`)} className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3 hover:text-gray-400 transition-colors text-left w-full outline-none">
                {cat.title}
              </button>
              <ul className="space-y-3">
                {cat.tracks.map((track: any) => (
                  <li key={track.id}>
                    <button onClick={() => handleScrollTo(`track-${track.id}`)} className="block pl-4 text-gray-500 hover:text-gray-300 transition-colors text-left w-full truncate">
                      {track.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="w-full max-w-4xl h-full overflow-y-auto pt-24 lg:pt-20 px-4 lg:px-10 pb-32 z-10 relative scrollbar-hide">
        <div id="top-anchor" className="absolute top-0 left-0 w-full h-1"></div>
        <h1 className="hidden lg:block text-2xl font-bold text-white mb-16 tracking-tight">{project.title}</h1>
        
        {project.categories.map((cat: any) => (
          <div key={cat.id} id={`cat-${cat.id}`} className="mb-20 pt-4">
            <h2 className="text-[20px] font-bold text-primary mb-10">
              {cat.title}
            </h2>

            {cat.tracks.map((track: any) => (
              <TrackPlayer key={track.id} track={track} />
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}
