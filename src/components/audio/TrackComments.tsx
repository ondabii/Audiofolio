'use client';

import { useState, useEffect, useCallback } from 'react';

interface CommentItem {
  id: string;
  track_id: string;
  author_name: string;
  content: string;
  is_admin: boolean;
  ip_address?: string;
  created_at: string;
}

interface TrackCommentsProps {
  trackId: string;
  isAdmin?: boolean;
}

// 텍스트 내 URL을 감지하여 안전한 하이퍼링크(<a>)로 렌더링
function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:opacity-80 break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function formatCommentDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

export function TrackComments({ trackId, isAdmin = false }: TrackCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 로컬 스토리지에 마지막 작성자 이름 기억
  useEffect(() => {
    const savedName = localStorage.getItem('audiofolio_comment_author');
    if (savedName) {
      setAuthorName(savedName);
    } else if (isAdmin) {
      setAuthorName('작성자');
    }
  }, [isAdmin]);

  const loadComments = useCallback(async () => {
    if (!trackId) return;
    try {
      const url = `/api/comments?track_id=${trackId}${isAdmin ? '&admin=true' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.comments) {
          setComments(data.comments);
        }
      }
    } catch (e) {
      console.error("Failed to load comments:", e);
    }
  }, [trackId, isAdmin]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const author = authorName.trim();
    const body = content.trim();

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: trackId,
          author_name: author,
          content: body,
          is_admin: isAdmin
        })
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.comment) {
          setComments(prev => [...prev, data.comment]);
          setContent('');
          localStorage.setItem('audiofolio_comment_author', author);
        }
      }
    } catch (e) {
      console.error("Failed to post comment:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editAuthorName, setEditAuthorName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);

  const handleStartEdit = (c: CommentItem) => {
    setEditingCommentId(c.id);
    setEditAuthorName(c.author_name);
    setEditContent(c.content);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditAuthorName('');
    setEditContent('');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editAuthorName.trim() || !editContent.trim() || isEditingSubmitting) return;

    setIsEditingSubmitting(true);
    const author = editAuthorName.trim();
    const body = editContent.trim();

    try {
      const res = await fetch('/api/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          author_name: author,
          content: body
        })
      });

      if (res.ok) {
        setComments(prev => prev.map(c => 
          c.id === id ? { ...c, author_name: author, content: body } : c
        ));
        setEditingCommentId(null);
      } else {
        alert("댓글 수정에 실패했습니다.");
      }
    } catch (e) {
      console.error("Failed to edit comment:", e);
      alert("댓글 수정 중 오류가 발생했습니다.");
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/comments?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete comment:", e);
    }
  };

  return (
    <div className="pt-3 mt-2 border-t border-[#1c2126]">
      {/* ── 작성 내역 (상단 배치) ── */}
      {comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {comments.map(c => (
            <div key={c.id} className="py-1.5 border-b border-[#1c2126]/60 text-xs">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white">{c.author_name}</span>
                  {c.is_admin && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
                      작성자
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500">
                    {formatCommentDate(c.created_at)}
                  </span>
                  {isAdmin && c.ip_address && (
                    <span className="text-[10px] text-gray-500 font-mono">
                      {c.ip_address}
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {editingCommentId === c.id ? (
                      <button
                        onClick={handleCancelEdit}
                        className="text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                      >
                        취소
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(c)}
                          className="text-[11px] text-gray-400 hover:text-primary transition-colors cursor-pointer"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-[11px] text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {editingCommentId === c.id ? (
                <div className="mt-1 space-y-1.5 pt-0.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editAuthorName}
                      onChange={e => setEditAuthorName(e.target.value)}
                      placeholder="이름"
                      className="w-24 sm:w-32 bg-[#161a1d] text-xs text-white border border-[#262b30] rounded px-2.5 py-1 outline-none focus:border-primary"
                      required
                    />
                    <input
                      type="text"
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit(c.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      placeholder="댓글 내용"
                      className="flex-1 bg-[#161a1d] text-xs text-white border border-[#262b30] rounded px-2.5 py-1 outline-none focus:border-primary"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] rounded transition-colors cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={isEditingSubmitting}
                      onClick={() => handleSaveEdit(c.id)}
                      className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-black font-bold text-[11px] rounded transition-colors cursor-pointer disabled:opacity-50"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-300 leading-relaxed pl-0.5 select-text">
                  {renderTextWithLinks(c.content)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 입력칸 (하단 배치) ── */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          placeholder="이름"
          className="w-28 sm:w-36 bg-[#161a1d] text-xs text-white border border-[#262b30] rounded px-2.5 py-1.5 outline-none focus:border-primary"
          required
        />
        <input
          type="text"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="댓글"
          className="flex-1 bg-[#161a1d] text-xs text-white border border-[#262b30] rounded px-3 py-1.5 outline-none focus:border-primary"
          required
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-black font-bold text-xs rounded transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
        >
          작성
        </button>
      </form>
    </div>
  );
}
