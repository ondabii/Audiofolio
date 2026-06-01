'use client';

import { useState } from 'react';
import { UploadCloud, Loader } from 'lucide-react';
import * as mm from 'music-metadata';

export function UploadControl() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setProgress(10);

    try {
      // 1. 브라우저에서 메타데이터 직접 추출 (서버 부하 감소 목적)
      const metadata = await mm.parseBlob(file);
      const durationMs = Math.floor((metadata.format.duration || 0) * 1000);
      const bitrate = Math.floor((metadata.format.bitrate || 0) / 1000); // kbps
      const fileFormat = metadata.format.container || file.name.split('.').pop()?.toUpperCase() || 'WAV';
      const fileSizeBytes = file.size;

      console.log('Extracted Metadata:', { durationMs, bitrate, fileFormat, fileSizeBytes });
      setProgress(40);

      // Edge Proxy 방식 업로드 (R2 버킷으로 바로 넘기기)
      // 트랙 및 버전 ID는 일단 임의로 생성 (실제로는 부모 컴포넌트나 상태에서 받아와야 함)
      const mockTrackId = 'temp_track_' + Math.random().toString(36).substr(2, 6);
      const mockVersionId = 'v_' + Math.random().toString(36).substr(2, 6);
      
      const queryParams = new URLSearchParams({
        trackId: mockTrackId,
        versionId: mockVersionId,
        fileName: encodeURIComponent(file.name),
        durationMs: durationMs.toString(),
        bitrate: bitrate.toString(),
        fileSizeBytes: fileSizeBytes.toString()
      });

      setProgress(60);

      const res = await fetch(`/api/upload?${queryParams.toString()}`, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'audio/wav',
        },
        body: file,
      });

      if (!res.ok) {
        throw new Error('업로드 실패');
      }

      setProgress(100);
      setIsExtracting(false);
      alert('업로드가 완료되었습니다!');

    } catch (error) {
      console.error('Upload Error:', error);
      setIsExtracting(false);
      setProgress(0);
      alert('오디오 메타데이터 추출에 실패했습니다.');
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4 text-white">Upload Track Version</h2>
      
      <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 hover:border-primary/50 transition-colors rounded-lg bg-[#15191d] relative overflow-hidden">
        <input 
          type="file" 
          accept="audio/*" 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={handleFileChange}
          disabled={isExtracting}
        />
        
        {isExtracting ? (
          <div className="flex flex-col items-center z-0">
            <Loader className="w-8 h-8 text-primary animate-spin mb-2" />
            <span className="text-sm font-bold text-gray-300">Processing... {progress}%</span>
          </div>
        ) : (
          <div className="flex flex-col items-center z-0 pointer-events-none">
            <UploadCloud className="w-8 h-8 text-gray-500 mb-2" />
            <span className="text-sm font-bold text-gray-300">클릭하거나 파일을 드래그하여 업로드</span>
            <span className="text-xs text-gray-500 mt-1">OGG, WAV, MP3 지원 (최대 100MB)</span>
          </div>
        )}

        {/* Progress Bar Background */}
        {isExtracting && (
          <div 
            className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-300 z-0"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
    </div>
  );
}
