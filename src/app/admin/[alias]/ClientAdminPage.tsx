"use client";
import AdminClient from "@/components/AdminClient";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader } from "lucide-react";

export default function ClientAdminPage() {
  const params = useParams();
  let alias = params?.alias as string;

  // ⚡️ 초강력 비상용 URL 꼬임 복구 백신!
  // Next.js 라우터 매핑이 일시적으로 실패해 alias가 '[alias]' 템플릿 이름 그대로 넘어왔다면,
  // 쿼리 파라미터(?alias=... 또는 ?nxtPalias=...)에서 실제 프로젝트명을 파싱하여 실시간으로 복원합니다.
  if (!alias || alias === "[alias]") {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const backupAlias = searchParams.get("alias") || searchParams.get("nxtPalias");
      if (backupAlias && backupAlias !== "[alias]") {
        alias = backupAlias;
      }
    }
  }

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshProject = () => {
    if (!alias || alias === "[alias]") return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API_BASE}/api/projects/${alias}?admin=true`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setProject(data);
      });
  };

  useEffect(() => {
    if (!alias || alias === "[alias]") {
      setLoading(false);
      return;
    }
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API_BASE}/api/projects/${alias}?admin=true`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setProject(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [alias]);

  // ⚡️ 실시간 주소창 강제 정화 코드!
  // 주소창이 지저분한 템플릿 파라미터로 꼬여있다면, 자바스크립트가 실행되는 즉시 원래의 아름답고 깨끗한 주소로 주소창을 리라이트합니다.
  useEffect(() => {
    if (typeof window !== "undefined" && alias && alias !== "[alias]") {
      const search = window.location.search;
      if (search.includes("nxtPalias") || search.includes("alias")) {
        const cleanPath = `/admin/${alias}`;
        window.history.replaceState(null, "", cleanPath);
      }
    }
  }, [alias]);

  if (loading) return <div className="flex h-screen items-center justify-center text-white"><Loader className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!project) return <div className="flex h-screen items-center justify-center text-white">Project not found. DB 연동을 확인해 주세요.</div>;
  
  return <AdminClient project={project} onRefresh={refreshProject} />;
}
