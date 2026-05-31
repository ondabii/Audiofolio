class AudioEngine {
  private ctx: AudioContext | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private activeSource: AudioBufferSourceNode | null = null;
  private currentVersionId: string | null = null;
  private startTime: number = 0;
  private offsetAtStart: number = 0;
  
  init() {
    if (typeof window !== 'undefined' && !this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
  }

  async loadBuffer(versionId: string, url: string): Promise<AudioBuffer> {
    if (this.bufferCache.has(versionId)) {
      return this.bufferCache.get(versionId)!;
    }
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    
    if (!this.ctx) this.init();
    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
    
    this.bufferCache.set(versionId, audioBuffer);
    return audioBuffer;
  }

  play(versionId: string, offset: number = 0, loop: boolean = true) {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    
    const buffer = this.bufferCache.get(versionId);
    if (!buffer) return;

    if (this.activeSource) {
      this.activeSource.stop();
      this.activeSource.disconnect();
    }

    const source = this.ctx!.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(this.ctx!.destination);

    // 트랙 길이 불일치 (Out of range) 대응: 
    // 목표 시간이 해당 버전의 전체 길이보다 길면 강제로 0초로 롤백 (Gapless 룰)
    const safeOffset = offset >= buffer.duration ? 0 : offset;

    source.start(0, safeOffset);
    
    this.activeSource = source;
    this.currentVersionId = versionId;
    this.startTime = this.ctx!.currentTime;
    this.offsetAtStart = safeOffset;
  }

  pause() {
    if (this.activeSource) {
      this.activeSource.stop();
      this.activeSource.disconnect();
      this.activeSource = null;
      
      if (this.ctx) {
        this.offsetAtStart += this.ctx.currentTime - this.startTime;
      }
    }
  }

  seek(time: number) {
    this.offsetAtStart = time;
    if (this.activeSource && this.currentVersionId) {
      this.play(this.currentVersionId, time);
    }
  }

  getCurrentTime(): number {
    if (!this.activeSource || !this.ctx) return this.offsetAtStart;
    
    // 루프 처리로 인해 시간이 duration을 넘어갈 수 있으므로 나머지 연산으로 제한
    const rawTime = this.offsetAtStart + (this.ctx.currentTime - this.startTime);
    const buffer = this.currentVersionId ? this.bufferCache.get(this.currentVersionId) : null;
    
    if (buffer && buffer.duration > 0) {
      return rawTime % buffer.duration;
    }
    return rawTime;
  }

  hasBuffer(versionId: string): boolean {
    return this.bufferCache.has(versionId);
  }
}

// 싱글톤 패턴으로 엔진 익스포트
export const audioEngine = new AudioEngine();
