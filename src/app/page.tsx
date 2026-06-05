import { AudioLines } from 'lucide-react';

export const runtime = 'edge';

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-[#111416] flex flex-col items-center justify-center text-center p-6 text-white font-sans relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px] pointer-events-none z-0"></div>

      <div className="flex flex-col items-center gap-4 relative z-10 animate-fade-in">
        {/* Main Logo Mark */}
        <div className="flex items-center gap-3.5 text-4xl lg:text-5xl font-extrabold tracking-tight text-white select-none">
          <AudioLines className="text-primary w-11 h-11 lg:w-14 lg:h-14 animate-pulse shrink-0" />
          Audiofolio
        </div>
        
        {/* Made by Description */}
        <p className="text-[10px] lg:text-xs text-gray-500 font-bold tracking-[0.2em] mt-3 uppercase select-none">
          made by ondabii
        </p>
      </div>
    </div>
  );
}
