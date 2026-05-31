"use client";

import React, { useState, useRef, useEffect } from "react";
import { Edit2 } from "lucide-react";

interface InlineEditorProps {
  value: string;
  onSave: (val: string) => void;
  onTextClick?: () => void;
  className?: string;
  textClassName?: string;
  inputClassName?: string;
  placeholder?: string;
}

export default function InlineEditor({ value, onSave, onTextClick, className, textClassName, inputClassName, placeholder }: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    if (val !== value && val.trim() !== '') {
      onSave(val.trim());
    } else {
      setVal(value); // revert
    }
  };

  if (isEditing) {
    return (
      <input 
        ref={inputRef}
        type="text" 
        value={val} 
        onChange={e => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setVal(value);
            setIsEditing(false);
          }
        }}
        placeholder={placeholder}
        className={`bg-[#1c2126] border border-primary text-white rounded px-2 py-0.5 outline-none w-full ${inputClassName}`}
        onClick={e => e.stopPropagation()}
      />
    );
  }
  
  return (
    <div className={`flex items-center gap-1 group w-full ${className}`}>
      <span 
        onClick={(e) => {
          if (onTextClick) {
            e.stopPropagation();
            onTextClick();
          }
        }} 
        className={`${textClassName || ''} ${onTextClick ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
      >
        {value}
      </span>
      <button 
        onClick={(e) => { 
          e.stopPropagation(); 
          setIsEditing(true); 
        }} 
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-white transition-opacity shrink-0"
        title="이름 수정"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
