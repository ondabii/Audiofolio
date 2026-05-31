"use client";
import MainClient from "@/components/MainClient";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader } from "lucide-react";

export default function ClientProjectPage() {
  const params = useParams();
  const alias = params?.alias as string;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!alias) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
    fetch(`${API_BASE}/api/projects/${alias}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setProject(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [alias]);

  if (loading) return <div className="flex h-screen items-center justify-center text-white"><Loader className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!project) return <div className="flex h-screen items-center justify-center text-white">Project not found.</div>;
  
  return <MainClient project={project} />;
}
