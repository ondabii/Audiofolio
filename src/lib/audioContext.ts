/**
 * 모듈 레벨 AudioContext 싱글톤
 *
 * 브라우저 Autoplay 정책:
 *  - AudioContext는 user gesture(클릭 등) 컨텍스트에서 생성/재개해야 합니다.
 *  - useEffect 안에서 생성하면 gesture 컨텍스트를 놓쳐 suspended 상태로 남습니다.
 *  - 해결: 클릭 핸들러에서 initAudioContext()를 직접 호출해 즉시 생성/재개합니다.
 */

let _ctx: AudioContext | null = null;

/** 클릭 핸들러에서 호출 — user gesture 컨텍스트 안에서 AudioContext 생성/재개 */
export function initAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

/** 어디서든 현재 AudioContext를 가져옴 (없으면 생성) */
export function getAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx;
}

/** 언마운트 또는 명시적 해제 시 호출 */
export function closeAudioContext() {
  if (_ctx && _ctx.state !== 'closed') {
    _ctx.close();
    _ctx = null;
  }
}
