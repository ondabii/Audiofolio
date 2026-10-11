export interface AudioMetadata {
  durationMs: number;
  format: string;
  bitrateKbps: number;
  sizeBytes: number;
  waveformData: number[]; // 0~100 사이 100개 포인트 (스펙트럼 시각화용)
}

/**
 * 오디오 파일에서 메타데이터 + 파형 데이터 추출
 * Web Audio API를 사용해 브라우저 단에서 직접 분석 (서버 부하 없음)
 */
export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) throw new Error('파일 읽기 실패');

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

        const durationSeconds = decodedData.duration;
        const durationMs = Math.round(durationSeconds * 1000);

        // 비트레이트 추산: (파일 크기 × 8) / 재생 시간(초) / 1000 = kbps
        const bitrateKbps = Math.round((file.size * 8) / durationSeconds / 1000);

        // 포맷 추출
        let format = file.type.split('/')[1] || '';
        if (format.startsWith('x-')) format = format.substring(2);
        if (format === 'mpeg') format = 'mp3';
        format = format.toUpperCase();
        if (!format) {
          const ext = file.name.split('.').pop();
          format = ext ? ext.toUpperCase() : 'UNKNOWN';
        }

        // ── 파형 데이터 추출 (100개 포인트, 0~100 정규화) ──
        // 모노 채널(0번) 기준으로 다운샘플링
        const channelData = decodedData.getChannelData(0);
        const numPoints = 100;
        const blockSize = Math.floor(channelData.length / numPoints);
        const waveformData: number[] = [];

        for (let i = 0; i < numPoints; i++) {
          const start = i * blockSize;
          const end = start + blockSize;
          let peak = 0;
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > peak) peak = abs;
          }
          // 0~1 범위를 0~100 정수로 변환
          waveformData.push(Math.round(peak * 100));
        }

        if (audioCtx.state !== 'closed') audioCtx.close();

        resolve({
          durationMs,
          format,
          bitrateKbps,
          sizeBytes: file.size,
          waveformData,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
