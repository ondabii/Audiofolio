"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader, Plus } from "lucide-react";
import * as musicMetadata from "music-metadata-browser";

interface UploadDropzoneProps {
  trackId: string;
  onUploadSuccess?: () => void;
  compact?: boolean;
}

export default function UploadDropzone({ trackId, onUploadSuccess, compact = false }: UploadDropzoneProps) {
  const [uploadState, setUploadState] = useState<"IDLE" | "EXTRACTING" | "UPLOADING" | "COMPLETED" | "ERROR">("IDLE");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUpload(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processUpload(file);
  };

  const processUpload = async (file: File) => {
    try {
      setUploadState("EXTRACTING");
      setStatusText("Extracting metadata...");
      setProgress(10);

      // 1. 메타데이터 파싱 (길이, 비트레이트)
      let durationMs = 0;
      let bitrate = 0;
      try {
        const metadata = await musicMetadata.parseBlob(file);
        durationMs = metadata.format.duration ? Math.round(metadata.format.duration * 1000) : 0;
        bitrate = metadata.format.bitrate || 0;
      } catch (e) {
        console.warn("Failed to parse metadata", e);
      }

      setStatusText("Generating Waveform...");
      setProgress(20);

      // 2. 파형(Waveform) 파싱 연산 (SoundCloud Style)
      let waveformData = "";
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const points = 100;
        const blockSize = Math.floor(channelData.length / points);
        const peaks = [];
        
        for (let i = 0; i < points; i++) {
          let start = i * blockSize;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[start + j]);
          }
          peaks.push(sum / blockSize);
        }
        
        const maxPeak = Math.max(...peaks);
        const normalized = peaks.map(p => Math.round((p / maxPeak) * 100));
        waveformData = JSON.stringify(normalized);
      } catch (err) {
        console.warn("Waveform extraction failed", err);
      }

      setStatusText("Uploading directly to R2 Storage...");
      setProgress(30);

      // 3. Worker 직접 업로드 요청
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
      const versionId = (Math.random() + 1).toString(36).substring(7); // 임시 ID 생성
      
      const queryParams = new URLSearchParams({
        trackId: trackId,
        versionId: versionId,
        fileName: file.name,
        durationMs: durationMs.toString(),
        fileSizeBytes: file.size.toString(),
        bitrate: bitrate.toString(),
        waveformData: waveformData
      });

      const res = await fetch(`${API_BASE}/api/upload?${queryParams.toString()}`, {
        method: "PUT",
        headers: { "Content-Type": file.type || "audio/wav" },
        body: file // Direct streaming
      });

      if (!res.ok) {
        throw new Error("Failed to upload file to backend");
      }

      setStatusText("Finalizing...");
      setProgress(100);

      // 5. 완료 후 DB 액티브 전환
      const API_BASE2 = process.env.NEXT_PUBLIC_API_URL || "";
      await fetch(`${API_BASE2}/api/versions/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" })
      });

      setUploadState("COMPLETED");
      setStatusText("Upload complete!");
      
      if (onUploadSuccess) onUploadSuccess();
      router.refresh();

      setTimeout(() => {
        setUploadState("IDLE");
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 3000);

    } catch (err) {
      console.error("Upload error:", err);
      setUploadState("ERROR");
      setStatusText("Upload failed.");
      setTimeout(() => {
        setUploadState("IDLE");
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 3000);
    }
  };

  if (uploadState !== "IDLE") {
    return (
      <div className={`bg-[#1c2126] rounded border border-primary/30 relative overflow-hidden ${compact ? 'p-3' : 'p-4 mb-4'}`}>
        <div className="absolute inset-0 bg-primary/10 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
        <div className="relative z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {uploadState === "ERROR" ? (
              <div className="w-4 h-4 rounded-full bg-red-500" />
            ) : uploadState === "COMPLETED" ? (
              <div className="w-4 h-4 rounded-full bg-green-500" />
            ) : (
              <Loader className="w-4 h-4 text-primary animate-spin" />
            )}
            <div className="text-sm font-medium text-white">{statusText}</div>
          </div>
          <div className="text-xs text-primary font-bold">{progress}%</div>
        </div>
      </div>
    );
  }

  // Compact Mode
  if (compact) {
    return (
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="group border border-dashed border-[#22272c] hover:border-primary/50 hover:bg-primary/5 bg-[#111416] rounded-lg p-4 flex items-center justify-center cursor-pointer transition-all h-[52px]"
      >
        <input type="file" className="hidden" ref={fileInputRef} accept="audio/*" onChange={handleFileChange} />
        <div className="flex items-center gap-2">
          <div className="bg-[#1c2126] group-hover:bg-primary/20 p-1.5 rounded-full transition-colors">
            <Plus className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-bold text-gray-500 group-hover:text-primary transition-colors hidden group-hover:block ml-2">Click to Upload New Version</span>
        </div>
      </div>
    );
  }

  // Normal Mode
  return (
    <div 
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="border-2 border-dashed border-[#22272c] rounded-lg p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer group mb-4"
    >
      <input type="file" className="hidden" ref={fileInputRef} accept="audio/*" onChange={handleFileChange} />
      <div className="w-10 h-10 mx-auto bg-[#1c2126] rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
        <UploadCloud className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
      </div>
      <p className="text-sm text-gray-300 font-medium mb-1">Click to upload or drag & drop</p>
      <p className="text-xs text-gray-500">WAV, FLAC, MP3, OGG (Max 200MB)</p>
    </div>
  );
}
