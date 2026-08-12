'use client';

import { useEffect, useState } from 'react';
import { HardDrive, CloudLightning, RefreshCw, CheckCircle, WifiOff } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { 
  generateProjectHash, 
  cacheProjectAudioFiles, 
  isProjectOfflineCached, 
  getOfflineCachedHash, 
  setOfflineCachedHash 
} from '@/lib/offlineCache';

export function OfflineDownloadBanner() {
  const project = useProjectStore(state => state.project);
  
  const [isOffline, setIsOffline] = useState(false);
  const [cached, setCached] = useState(false);
  const [outdated, setOutdated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // 1. 네트워크 및 캐시 메타데이터 상태 실시간 모니터링
  useEffect(() => {
    if (typeof window === 'undefined' || !project) return;
    
    // 네트워크 체크
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 캐시 상태 체크
    const isCached = isProjectOfflineCached(project.id);
    setCached(isCached);

    if (isCached) {
      const cachedHash = getOfflineCachedHash(project.id);
      const currentHash = generateProjectHash(project);
      setOutdated(cachedHash !== currentHash);
    } else {
      setOutdated(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [project]);

  if (!project) return null;

  // 오프라인 저장 실행 핸들러
  const handleStartOfflineSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(0);
    try {
      await cacheProjectAudioFiles(project, (p) => {
        setSyncProgress(p);
      });
      // 캐시 해시 등록
      const currentHash = generateProjectHash(project);
      setOfflineCachedHash(project.id, currentHash, true);
      setCached(true);
      setOutdated(false);
    } catch (e) {
      console.error(e);
      alert('오프라인 저장 중 에러가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  // UI 상태 분기 렌더링
  return (
    <div className="w-full mb-6 relative overflow-hidden rounded-xl border border-gray-800/40 bg-[#161a1d]/60 backdrop-blur-md p-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none">
      
      {/* 상태 설명부 */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="p-2 rounded-lg bg-black/40 border border-gray-800/60 flex items-center justify-center shrink-0">
          {isOffline ? (
            <WifiOff className="w-5 h-5 text-gray-500 animate-pulse" />
          ) : isSyncing ? (
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          ) : cached && outdated ? (
            <CloudLightning className="w-5 h-5 text-[#f5a623]" />
          ) : cached ? (
            <CheckCircle className="w-5 h-5 text-[#2ecc71]" />
          ) : (
            <HardDrive className="w-5 h-5 text-gray-400" />
          )}
        </div>
        
        <div>
          <h4 className="text-xs font-extrabold text-white tracking-wider uppercase">
            {isOffline 
              ? 'Offline Mode' 
              : isSyncing 
              ? `Syncing Audio (${syncProgress}%)` 
              : cached && outdated 
              ? 'Update Available' 
              : cached 
              ? 'Offline Saved' 
              : 'Save Project Offline'}
          </h4>
          <p className="text-[10px] text-gray-400 font-medium leading-normal mt-0.5 max-w-[400px]">
            {isOffline 
              ? '네트워크 연결이 끊겼습니다. 이미 오프라인으로 저장된 음원을 로컬 캐시에서 지연 없이 바로 재생합니다.' 
              : isSyncing 
              ? '이 프로젝트에 등록된 모든 오디오 파일 원본을 다운로드하여 브라우저 로컬 저장소에 적재하고 있습니다.' 
              : cached && outdated 
              ? '프로젝트 설정(트랙명, 음원 정보)이 변경되었습니다. 오프라인 음원을 최신 상태로 업데이트하세요.' 
              : cached 
              ? '이 프로젝트의 모든 음원 파일이 로컬 캐시에 저장되어 오프라인에서도 끊김 없이 재생할 수 있습니다.' 
              : '어플리케이션을 인터넷이 끊긴 비행기 모드나 외부 환경에서도 들으시려면 미리 원본 음원들을 로컬 캐시에 저장해 두세요.'}
          </p>
        </div>
      </div>

      {/* 액션 제어부 */}
      <div className="w-full md:w-auto shrink-0 flex flex-col items-stretch md:items-end gap-2 relative z-10">
        {isOffline ? (
          <div className="px-3.5 py-1.5 rounded bg-gray-800/30 border border-gray-700/30 text-gray-400 text-xs font-bold text-center">
            오프라인 모드 실행 중
          </div>
        ) : isSyncing ? (
          <div className="w-full md:w-44 flex flex-col gap-1">
            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-gray-800">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out" 
                style={{ width: `${syncProgress}%` }}
              ></div>
            </div>
            <div className="text-[9px] text-primary font-bold text-center uppercase tracking-widest animate-pulse">
              Downloading...
            </div>
          </div>
        ) : cached && outdated ? (
          <button
            onClick={handleStartOfflineSync}
            className="px-4 py-2 rounded text-xs font-extrabold bg-[#f5a623] hover:bg-[#f5a623]/90 text-black shadow-lg shadow-[#f5a623]/10 hover:shadow-[#f5a623]/20 border border-[#f5a623]/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 오프라인 데이터 업데이트
          </button>
        ) : cached ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2ecc71] font-bold uppercase tracking-wider bg-[#2ecc71]/10 border border-[#2ecc71]/20 px-2.5 py-1 rounded">
              저장 완료
            </span>
            <button
              onClick={handleStartOfflineSync}
              className="px-3 py-1.5 rounded text-[10px] font-bold bg-[#1c2126] hover:bg-[#252b31] border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
              title="오프라인 저장 데이터 덮어쓰기"
            >
              다시 저장
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartOfflineSync}
            className="px-4 py-2 rounded text-xs font-extrabold bg-primary hover:bg-primary/90 text-black shadow-lg shadow-primary/10 hover:shadow-primary/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5" /> 오프라인 저장 실행
          </button>
        )}
      </div>

    </div>
  );
}
