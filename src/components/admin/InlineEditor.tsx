'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface InlineEditorProps {
  initialValue: string;
  onSave: (newValue: string) => Promise<void>;
  textClassName?: string;
  isTitle?: boolean;
  readOnly?: boolean;
}

export function InlineEditor({ initialValue, onSave, textClassName = "", isTitle = false, readOnly = false }: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value.trim() === initialValue || !value.trim()) {
      setIsEditing(false);
      setValue(initialValue);
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(value.trim());
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      setValue(initialValue); // revert on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setValue(initialValue);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1 max-w-full">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`bg-gray-800 text-white border border-primary/50 rounded px-2 py-1 outline-none w-full max-w-sm ${textClassName}`}
        />
        <button onClick={handleSave} disabled={isSaving} className="text-green-500 hover:text-green-400 p-1">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => { setIsEditing(false); setValue(initialValue); }} disabled={isSaving} className="text-red-500 hover:text-red-400 p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 max-w-full relative">
      <span className={`truncate ${textClassName}`}>{initialValue}</span>
      {!readOnly && (
        <button 
          onClick={() => setIsEditing(true)} 
          className={`text-gray-500 hover:text-primary transition-opacity ${isTitle ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          title="이름 수정"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
