/**
 * 모듈 레벨 AudioContext 싱글톤 (크로스 브라우저 & iOS Safari 완벽 대응)
 *
 * 브라우저 Autoplay 정책:
 *  - AudioContext는 user gesture(클릭/터치 등) 컨텍스트에서 생성/재개해야 합니다.
 *  - 특히 iOS Safari는 단순히 resume()만 호출하면 소리가 나지 않으며, 1샘플짜리 묵음 버퍼를 재생해야 하드웨어 오디오가 활성화됩니다.
 *  - React 컴포넌트 라이프사이클이나 StrictMode로 인해 context가 'closed'된 경우 자동으로 새로 인스턴스를 생성합니다.
 */

let _ctx: AudioContext | null = null;

function createNewContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser");
  }
  return new AudioContextClass();
}

/** 클릭/터치 핸들러에서 호출 — user gesture 컨텍스트 안에서 AudioContext 생성/재개 및 iOS Safari 언락 */
export function initAudioContext(): AudioContext {
  if (typeof window === 'undefined') return {} as AudioContext;

  if (!_ctx || _ctx.state === 'closed') {
    _ctx = createNewContext();
  }

  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }

  // 💡 iOS Safari / 모바일 브라우저 하드웨어 언락 트릭
  // 사용자 제스처 컨텍스트 내에서 1샘플짜리 묵음 버퍼를 즉시 start(0)하여 브라우저의 오디오 엔진 잠금을 영구 해제
  try {
    const buffer = _ctx.createBuffer(1, 1, 22050);
    const source = _ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(_ctx.destination);
    source.start(0);
  } catch (e) {
    // 이미 언락되었거나 지원되지 않는 경우 안전하게 무시
  }

  return _ctx;
}

/** 어디서든 현재 활성 AudioContext를 가져옴 (없거나 닫혀있으면 자동 생성) */
export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') return {} as AudioContext;

  if (!_ctx || _ctx.state === 'closed') {
    _ctx = createNewContext();
  }

  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }

  return _ctx;
}

/** 언마운트 또는 명시적 완전 해제 시 호출 */
export function closeAudioContext() {
  if (_ctx && _ctx.state !== 'closed') {
    try {
      _ctx.close();
    } catch (e) {}
    _ctx = null;
  }
}
