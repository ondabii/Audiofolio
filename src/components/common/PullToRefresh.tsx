'use client';

import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxPullDistance = 80;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let touchStartY = 0;
    let currentPull = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // 최상단 근처에서만 Pull-to-Refresh 작동
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop || el.scrollTop || 0;
      if (scrollTop <= 5) {
        touchStartY = e.touches[0].clientY;
        setStartY(touchStartY);
      } else {
        touchStartY = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY === 0 || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;

      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop || el.scrollTop || 0;

      if (diff > 0 && scrollTop <= 5) {
        // 저항감을 위한 수식 적용
        currentPull = Math.min(diff * 0.45, maxPullDistance + 20);
        setPullDistance(currentPull);
      } else {
        currentPull = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (currentPull >= maxPullDistance && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(maxPullDistance);
        
        // 부드러운 새로고침 트리거
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        setPullDistance(0);
      }
      touchStartY = 0;
      currentPull = 0;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing]);

  return (
    <div ref={containerRef} className="min-h-screen w-full relative">
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-transform duration-75"
          style={{ transform: `translateY(${Math.min(pullDistance, maxPullDistance)}px)` }}
        >
          <div className="bg-[#1c2126]/95 border border-[#22272c] text-primary rounded-full p-2.5 shadow-xl backdrop-blur-md flex items-center gap-2 px-4">
            <RefreshCw className={`w-5 h-5 text-primary ${isRefreshing || pullDistance >= maxPullDistance ? 'animate-spin' : ''}`} />
            <span className="text-xs font-extrabold text-white">
              {isRefreshing ? '새로고침 중...' : pullDistance >= maxPullDistance ? '놓아서 새로고침' : '당겨서 새로고침'}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
