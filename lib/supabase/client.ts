import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';

// ✅ 하드코딩된 환경 변수 사용 (로컬 환경 변수 로딩 실패 시)
// 클라이언트 코드에서는 NEXT_PUBLIC_ 접두사가 붙은 환경 변수만 사용 가능
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

// 환경 변수가 없는 경우 경고 출력
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️ 환경 변수 누락: 하드코딩된 값 사용 중입니다. 실제 프로덕션에서는 환경 변수를 설정하세요.');
}

// 클라이언트 옵션
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

// 싱글톤 패턴으로 Supabase 클라이언트 생성
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

const createSupabaseClient = () => {
  if (!supabaseInstance) {
    console.log(`[클라이언트] Supabase 클라이언트 생성: ${SUPABASE_URL.substring(0, 20)}...`);
    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions);
    
    // 브라우저에서만 실행
    if (typeof window !== 'undefined') {
      console.log('✅ Supabase 클라이언트 생성 성공 (브라우저)');
    }
  }
  
  return supabaseInstance;
};

// 클라이언트 생성
const supabase = createSupabaseClient();

export default supabase; 