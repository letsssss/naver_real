import { createClient } from '@supabase/supabase-js';
// 데이터베이스 타입이 있다면 아래 주석을 해제하세요
// import { Database } from '@/types/supabase.types';

// 싱글톤 인스턴스
let supabaseAdmin: ReturnType<typeof createClient>;

// 환경 변수 확인 및 로깅 함수
const checkEnvVars = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (isDevelopment) {
    console.log('[Supabase Admin 클라이언트] 환경 변수 확인:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✅' : '❌');
  }
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    // 환경변수가 없을 경우 하드코딩된 값으로 폴백 (개발용, 프로덕션에서는 사용하지 마세요)
    return {
      url: supabaseUrl || "https://jdubrjczdyqqtsppojgu.supabase.co",
      key: supabaseServiceRoleKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU"
    };
  }
  
  return {
    url: supabaseUrl,
    key: supabaseServiceRoleKey
  };
};

// 싱글톤 패턴으로 Supabase 클라이언트 생성
export function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }
  
  const { url, key } = checkEnvVars();
  
  // 데이터베이스 타입이 있다면 createClient<Database>로 변경하세요
  supabaseAdmin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  return supabaseAdmin;
}

// 기본 내보내기
export default getSupabaseAdmin(); 