"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Star, Download, Trash2, Edit2, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteVersion, renameVersion } from "@/app/actions";
import InlineEditor from "./InlineEditor";

export default function AdminVersionItem({ version, isFirstInList, hasNoRep, dragListeners }: { version: any, isFirstInList: boolean, hasNoRep: boolean, dragListeners?: any }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const toggleVisibility = async () => {
    setIsUpdating(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    await fetch(`${API_BASE}/api/versions/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_visible: !version.is_visible })
    });
    setIsUpdating(false);
    router.refresh();
  };

  const toggleRepresentative = async () => {
    setIsUpdating(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    await fetch(`${API_BASE}/api/versions/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_representative: !version.is_representative })
    });
    setIsUpdating(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (window.confirm("정말로 이 버전을 삭제하시겠습니까?")) {
      setIsUpdating(true);
      await deleteVersion(version.id);
      setIsUpdating(false);
    }
  };

  const handleRename = async (newName: string) => {
    setIsUpdating(true);
    await renameVersion(version.id, newName);
    setIsUpdating(false);
  };

  const displayName = version.title || version.audio_url.split('/').pop()?.split('_').slice(1).join('_') || 'Unknown';
  
  const isTargetRep = version.is_representative;
  const isAutoRep = !isTargetRep && hasNoRep && isFirstInList;

  return (
    <li className={`flex justify-between items-center bg-[#111416] p-3 rounded text-sm border ${isTargetRep || isAutoRep ? 'border-primary/50' : 'border-[#22272c]'} ${isUpdating ? 'opacity-50 pointer-events-none' : 'transition-opacity duration-300'}`}>
      <div className="flex items-center gap-2 lg:gap-3 overflow-hidden flex-1 mr-4">
        {dragListeners && (
          <div {...dragListeners} className="cursor-grab text-gray-600 hover:text-gray-300 p-1 -ml-1">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <button onClick={toggleRepresentative} className={`shrink-0 p-1 rounded transition-colors ${isTargetRep ? 'text-primary' : isAutoRep ? 'text-primary opacity-70' : 'text-gray-500 hover:text-gray-300'}`} title={isTargetRep ? "대표버전 지정 해제" : "대표버전으로 지정"}>
          <Star className={`w-4 h-4 ${isTargetRep ? 'fill-primary' : ''}`} />
        </button>
        <div className="flex-1 min-w-0 font-bold truncate group-hover:text-primary transition-colors flex items-center gap-1 group/edit cursor-pointer">
          <InlineEditor value={version.title || version.audio_url.split('/').pop()?.split('_').slice(1).join('_') || 'Unknown_File'} onSave={(val) => handleRename(val)} className="truncate" />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        <span className="text-gray-600 text-[10px] font-bold uppercase hidden lg:block">{version.file_format?.split('/')[1] || 'WAV'}</span>
        
        <div className="flex items-center gap-2">
          {/* Visibility Toggle */}
          <button onClick={toggleVisibility} className={`p-1 transition-colors ${version.is_visible ? 'text-green-500' : 'text-gray-600 hover:text-gray-400'}`} title="공개/비공개 토글">
            {version.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Download */}
          <a href={version.public_url} download target="_blank" className="p-1 text-blue-400 hover:text-blue-300 transition-colors" title="다운로드">
            <Download className="w-4 h-4" />
          </a>
          
          {/* Delete */}
          <button onClick={handleDelete} className="p-1 text-red-500 hover:text-red-400 transition-colors" title="삭제">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
