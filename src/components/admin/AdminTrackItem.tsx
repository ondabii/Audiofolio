import { useState, useRef } from 'react';
import { Star, Download, X, Eye, EyeOff, UploadCloud, Trash2, Loader } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { InlineEditor } from '@/components/admin/InlineEditor';
import { extractAudioMetadata } from '@/lib/audioUtils';

export function AdminTrackItem({ track }: { track: any }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadText, setUploadText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteTrack = async () => {
    if (confirm("이 트랙과 속해있는 모든 버전을 삭제하시겠습니까? (R2 파일 포함)")) {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_track', id: track.id })
      });
      useProjectStore.getState().deleteTrack(track.id);
    }
  };

  const handleUpdateTrack = async (newTitle: string) => {
    useProjectStore.getState().updateTrackTitle(track.id, newTitle);
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_track', id: track.id, title: newTitle })
    });
  };

  const handleUpdateVersion = async (versionId: string, newTitle: string) => {
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_version', id: versionId, title: newTitle })
    });
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (confirm("이 버전을 영구 삭제하시겠습니까?")) {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_version', id: versionId })
      });
      window.location.reload();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadText(`Analyzing ${file.name}...`);

    try {
      // 1. Extract Metadata
      const meta = await extractAudioMetadata(file);
      
      const versionId = crypto.randomUUID();
      const fileName = encodeURIComponent(file.name);
      const url = `/api/upload?trackId=${track.id}&versionId=${versionId}&fileName=${fileName}&durationMs=${meta.durationMs}&fileSizeBytes=${meta.sizeBytes}&bitrate=${meta.bitrateKbps}`;

      setUploadText(`Uploading ${file.name}...`);
      
      // 2. Upload via XHR for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type || 'audio/wav');
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload network error'));
        
        xhr.send(file);
      });

      // 3. Complete
      setUploadProgress(100);
      setUploadText('Processing complete.');
      
      // Reload UI
      window.location.reload();
      
    } catch (err) {
      console.error(err);
      alert("업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-[#161a1d] border border-[#22272c] rounded-lg p-5 mb-4 group/track">
      
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#22272c]">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <InlineEditor 
            initialValue={track.title} 
            onSave={handleUpdateTrack}
            textClassName="text-lg font-bold text-white"
          />
        </h3>
        <button onClick={handleDeleteTrack} className="text-red-500/80 hover:text-red-400 text-xs flex items-center gap-1 opacity-0 group-hover/track:opacity-100 transition-opacity">
          <Trash2 className="w-3 h-3" /> Delete Track
        </button>
      </div>

      <div className="space-y-2 mb-6">
        {track.versions?.map((version: any) => {
          const isRep = version.is_representative;
          return (
            <div key={version.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded border transition-colors group/version gap-3 sm:gap-0 ${isRep ? 'bg-[#1c2126] border-[#22272c]' : 'bg-transparent border-transparent hover:bg-[#1c2126] hover:border-[#22272c]'}`}>
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full cursor-pointer ${isRep ? 'bg-primary/20 text-primary' : 'bg-transparent text-gray-600 group-hover/version:text-gray-400'}`}>
                  <Star className={`w-3 h-3 ${isRep ? 'fill-primary' : ''}`} />
                </div>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <InlineEditor 
                    initialValue={version.title || `v${version.order_index}`}
                    onSave={async (newTitle) => handleUpdateVersion(version.id, newTitle)}
                    textClassName={`text-sm font-bold ${isRep ? 'text-white' : 'text-gray-400'}`}
                  />
                  {isRep && <span className="text-xs text-primary/70 font-semibold">(Rep)</span>}
                </div>
                <div className="hidden md:flex gap-2 text-xs">
                  <span className="bg-black/50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700/50 uppercase">{version.file_format || 'WAV'}</span>
                  {version.bitrate ? (
                    <span className="bg-black/50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700/50 uppercase">{version.bitrate}kbps</span>
                  ) : null}
                </div>
              </div>
              <div className={`flex items-center gap-3 ${!isRep && 'opacity-0 group-hover/version:opacity-100'} transition-opacity self-end sm:self-auto`}>
                <button className="text-gray-500 hover:text-white transition-colors" title="Download">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteVersion(version.id)} className="text-red-500/50 hover:text-red-400 transition-colors" title="Delete Version">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Uploading State UI */}
        {isUploading && (
          <div className="bg-[#1c2126] p-4 rounded border border-primary/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/10 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            <div className="relative z-10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Loader className="w-4 h-4 text-primary animate-spin" />
                <div className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-[300px]">{uploadText}</div>
                <div className="text-xs text-primary font-bold">{uploadProgress}%</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`border-2 border-dashed border-[#22272c] rounded-lg p-6 text-center transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer group/upload'} relative`}>
        <div className={`w-10 h-10 mx-auto bg-[#1c2126] rounded-full flex items-center justify-center mb-3 transition-colors ${!isUploading && 'group-hover/upload:bg-primary/20'}`}>
          <UploadCloud className={`w-5 h-5 text-gray-400 transition-colors ${!isUploading && 'group-hover/upload:text-primary'}`} />
        </div>
        <p className="text-sm text-gray-300 font-medium mb-1">{isUploading ? 'Upload in progress...' : 'Click to upload or drag & drop'}</p>
        <p className="text-xs text-gray-500">WAV, FLAC, MP3, OGG (Max 200MB)</p>
        {!isUploading && (
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="audio/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            title="" 
          />
        )}
      </div>
    </div>
  );
}
