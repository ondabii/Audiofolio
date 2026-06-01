export interface AudioMetadata {
  durationMs: number;
  format: string;
  bitrateKbps: number;
  sizeBytes: number;
}

export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) throw new Error("Failed to read file");

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Decode the audio data to get duration
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        
        const durationSeconds = decodedData.duration;
        const durationMs = Math.round(durationSeconds * 1000);
        
        // Estimate Bitrate: (File Size in bits) / (Duration in seconds)
        // Bitrate in kbps
        let bitrateKbps = Math.round((file.size * 8) / durationSeconds / 1000);
        
        // Format extraction (e.g. "audio/wav" -> "WAV")
        let format = file.type.split('/')[1] || '';
        if (format.startsWith('x-')) format = format.substring(2); // x-wav -> wav
        if (format === 'mpeg') format = 'mp3';
        format = format.toUpperCase();
        if (!format) {
          const ext = file.name.split('.').pop();
          format = ext ? ext.toUpperCase() : 'UNKNOWN';
        }

        resolve({
          durationMs,
          format,
          bitrateKbps,
          sizeBytes: file.size,
        });
        
        // Cleanup AudioContext to free memory
        if (audioCtx.state !== 'closed') {
          audioCtx.close();
        }
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
