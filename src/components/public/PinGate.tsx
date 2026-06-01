'use client';

import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';

export function PinGate({ children }: { children: React.ReactNode }) {
  const project = useProjectStore(state => state.project);
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!project?.is_protected) {
      setIsUnlocked(true);
    }
  }, [project]);

  // Handle lock timeout
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockedUntil && Date.now() < lockedUntil) {
      timer = setInterval(() => {
        if (Date.now() >= lockedUntil) {
          setLockedUntil(null);
          setAttempts(0);
          setError('');
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockedUntil]);

  if (!project) return null;
  if (isUnlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockedUntil && Date.now() < lockedUntil) {
      return;
    }

    // MVP Simple comparison
    if (pinInput === project.pin_hash) {
      setIsUnlocked(true);
      setError('');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockedUntil(Date.now() + 5 * 60 * 1000); // 5 minutes
        setError('PIN 5회 입력 실패. 5분 후 다시 시도해주세요.');
      } else {
        setError(`잘못된 PIN 번호입니다. (${newAttempts}/5)`);
      }
    }
  };

  const isLockedOut = lockedUntil && Date.now() < lockedUntil;

  return (
    <div className="fixed inset-0 bg-[#111416] z-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-[#1c2126] border border-[#22272c] rounded-xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">{project.title}</h1>
        <p className="text-gray-400 text-sm mb-8">
          이 프로젝트는 PIN 번호로 보호되어 있습니다.<br/>
          접근을 위해 4자리 PIN을 입력해주세요.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} // only numbers
            disabled={!!isLockedOut}
            className="w-full bg-[#111416] border border-[#22272c] text-white text-center text-2xl tracking-[1em] font-mono py-3 rounded-lg focus:outline-none focus:border-primary disabled:opacity-50"
            placeholder="****"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={pinInput.length !== 4 || !!isLockedOut}
            className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLockedOut ? '접근 잠금 중' : '접속하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
