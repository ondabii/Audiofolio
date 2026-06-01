export const runtime = 'edge';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#111416] flex flex-col items-center justify-center text-center p-6 text-white font-sans">
      <h1 className="text-6xl font-extrabold text-primary tracking-tight mb-4">404</h1>
      <h2 className="text-xl font-bold mb-2">페이지를 찾을 수 없습니다</h2>
      <p className="text-sm text-gray-500 font-bold mb-6">요청하신 주소가 올바르지 않거나 삭제된 프로젝트일 수 있습니다.</p>
      <a 
        href="/admin" 
        className="text-sm bg-primary hover:bg-primary/95 text-black font-extrabold px-6 py-2.5 rounded transition-all shadow-lg shadow-primary/10"
      >
        관리자 대시보드로 이동
      </a>
    </div>
  );
}
