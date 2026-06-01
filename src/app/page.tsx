import { redirect } from "next/navigation";

export const runtime = 'edge';

export default function Home() {
  // 기본적으로 어드민 생성 라우트로 리다이렉트
  redirect('/admin/new');
}
