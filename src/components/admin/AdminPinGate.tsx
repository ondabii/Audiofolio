'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AdminPinGateProps {
  children: React.ReactNode;
}

export default function AdminPinGate({ children }: AdminPinGateProps) {
  const [verified, setVerified] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. 세션 스토리지에서 기존 인증 여부 검사
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isVerified = sessionStorage.getItem('admin_verified') === 'true';
      if (isVerified) {
        setVerified(true);
      }
      setCheckingSession(false);
    }
  }, []);

  // 2. 키보드 입력 핸들러 추가
  useEffect(() => {
    if (verified) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) {
          setError(false);
          setPin(prev => prev + e.key);
        }
      } else if (e.key === 'Backspace') {
        setError(false);
        setPin(prev => prev.slice(0, -1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, verified, loading]);

  // 3. 6자리가 다 차면 자동 검증 API 트리거
  useEffect(() => {
    if (pin.length === 6) {
      handleVerify(pin);
    }
  }, [pin]);

  const handleVerify = async (inputPin: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verifyAdminPin',
          payload: { pin: inputPin }
        })
      });

      const data = await res.json() as { verified: boolean };
      if (res.ok && data.verified) {
        sessionStorage.setItem('admin_verified', 'true');
        setVerified(true);
      } else {
        triggerErrorEffect();
      }
    } catch (e) {
      console.error('PIN verification failed:', e);
      triggerErrorEffect();
    } finally {
      setLoading(false);
    }
  };

  const triggerErrorEffect = () => {
    setError(true);
    setPin('');
    // 좌우 흔들림 애니메이션 효과 트리거
    if (containerRef.current) {
      containerRef.current.classList.add('animate-shake');
      setTimeout(() => {
        containerRef.current?.classList.remove('animate-shake');
      }, 500);
    }
  };

  const handleKeypadClick = (num: string) => {
    if (loading || pin.length >= 6) return;
    setError(false);
    setPin(prev => prev + num);
  };

  const handleBackspace = () => {
    if (loading) return;
    setError(false);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setError(false);
    setPin('');
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#111416] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (verified) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#111416] flex flex-col items-center justify-center p-4 select-none relative overflow-hidden font-sans">
      {/* 백그라운드 디자인 발광 글로우 */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#f5a623]/5 blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#f5a623]/5 blur-[100px] pointer-events-none"></div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>

      <div 
        ref={containerRef}
        className="w-full max-w-sm bg-[#161a1d] border border-[#22272c] rounded-2xl p-8 shadow-2xl flex flex-col items-center relative z-10 transition-all duration-300"
      >
        {/* 자물쇠 로고 아이콘 */}
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
          error ? 'bg-red-500/10 text-red-500 border border-red-500/30' : 'bg-[#f5a623]/10 text-[#f5a623] border border-[#f5a623]/20'
        }`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h2 className="text-xl font-extrabold tracking-tight mb-2 text-white">관리자 인증</h2>
        <p className="text-xs text-gray-400 mb-8 text-center leading-relaxed">
          어드민 대시보드에 접근하려면 D1에 저장된<br />6자리 PIN 코드를 입력해 주세요.
        </p>

        {/* 6개 슬롯 도트 인디케이터 */}
        <div className="flex gap-3 mb-10">
          {[...Array(6)].map((_, i) => {
            const hasValue = pin.length > i;
            return (
              <div 
                key={i}
                className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
                  error 
                    ? 'border-red-500 bg-red-500/5 text-red-500' 
                    : hasValue 
                      ? 'border-[#f5a623] bg-[#f5a623]/5 text-[#f5a623] scale-105' 
                      : 'border-[#22272c] bg-[#111416]/50 text-gray-600'
                }`}
              >
                {hasValue ? (
                  <div className="w-2.5 h-2.5 bg-[#f5a623] rounded-full"></div>
                ) : (
                  <span className="text-xs opacity-20">•</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 숫자 키패드 그리드 */}
        <div className="grid grid-cols-3 gap-3 w-full mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              onClick={() => handleKeypadClick(num)}
              className="bg-[#111416] hover:bg-[#111416]/80 text-white font-bold py-4 rounded-xl border border-[#22272c]/40 hover:border-[#f5a623]/20 transition-all active:scale-95 text-lg"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="text-xs font-bold text-gray-500 hover:text-white transition-colors"
          >
            초기화
          </button>
          <button
            onClick={() => handleKeypadClick('0')}
            className="bg-[#111416] hover:bg-[#111416]/80 text-white font-bold py-4 rounded-xl border border-[#22272c]/40 hover:border-[#f5a623]/20 transition-all active:scale-95 text-lg"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="flex items-center justify-center text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-[#161a1d]/80 rounded-2xl flex items-center justify-center z-20">
            <div className="w-8 h-8 border-4 border-[#f5a623] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}