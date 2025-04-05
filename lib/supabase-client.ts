import { createBrowserClient } from "@supabase/ssr";

// 환경 변수를 먼저 확인하고, 존재하지 않으면 기본값 사용
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

// 실제 사용되는 값 로깅 (디버깅용, 프로덕션에서는 제거)
if (typeof window !== 'undefined') {
  console.log('🔄 클라이언트 환경에서 Supabase 초기화');
  console.log('📌 URL 사용 방법:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '환경 변수' : '하드코딩된 값');
}

export const supabase = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
); 