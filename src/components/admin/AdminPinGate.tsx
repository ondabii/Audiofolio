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
  const inputRef = useRef<HTMLInputElement>(null);

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

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#111416] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#f5a623] border-t-transparent rounded-full animate-spin"></div>
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

      {/* 전체 카드 영역을 클릭하면 보이지 않는 input에 강제 포커싱 */}
      <div 
        ref={containerRef}
        onClick={() => inputRef.current?.focus()}
        className="w-full max-w-sm bg-[#161a1d] border border-[#22272c] rounded-2xl p-8 shadow-2xl flex flex-col items-center relative z-10 transition-all duration-300 cursor-text"
      >
        {/* 모바일/데스크톱 입력을 우회 수신하기 위한 숨겨진 실제 input */}
        <input
          ref={inputRef}
          type="text"
          pattern="[0-9]*"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            setError(false);
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (val.length <= 6) {
              setPin(val);
            }
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text z-30"
          autoFocus
        />

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
        <div className="flex gap-3 mb-4">
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

        <span className="text-[10px] text-gray-500 font-bold mt-4 tracking-wider uppercase">
          {loading ? '검증 중...' : '키보드로 숫자를 입력하세요'}
        </span>

        {loading && (
          <div className="absolute inset-0 bg-[#161a1d]/80 rounded-2xl flex items-center justify-center z-20">
            <div className="w-8 h-8 border-4 border-[#f5a623] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}