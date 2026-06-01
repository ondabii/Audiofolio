'use client';

import { useEffect } from 'react';

export function CleanUrlClient() {
  useEffect(() => {
    // Cloudflare Pages 환경에서 Next.js 동적 라우팅 시 nxtPalias 쿼리가 주소창에 노출되는 버그 방어
    const url = new URL(window.location.href);
    let changed = false;
    
    // nxtP... 형태의 모든 파라미터 제거
    const keysToDelete: string[] = [];
    url.searchParams.forEach((value, key) => {
      if (key.startsWith('nxtP')) {
        keysToDelete.push(key);
      }
    });

    if (keysToDelete.length > 0) {
      keysToDelete.forEach(key => url.searchParams.delete(key));
      changed = true;
    }

    if (changed) {
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  return null;
}
