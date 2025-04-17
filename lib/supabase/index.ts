import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';
import { createServerComponentClient, createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ✅ 안전한 환경변수 읽기
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU';

// 디버그 로그
console.log('[Supabase] 환경변수 상태:', {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌'
});

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('[Supabase] ⚠️ 환경변수가 누락되었습니다. 하드코딩된 폴백 값을 사용합니다.');
}

const options = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

// ✅ 싱글톤 인스턴스
let supabaseInstance: SupabaseClient<Database> | null = null;
let adminSupabaseInstance: SupabaseClient<Database> | null = null;
let browserClientInstance: SupabaseClient<Database> | null = null;

// ✅ 브라우저 클라이언트 (클라이언트 컴포넌트용)
export function createBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') return getSupabaseClient();

  if (browserClientInstance) return browserClientInstance;

  try {
    const client = createClientComponentClient<Database>();
    browserClientInstance = client;
    return browserClientInstance;
  } catch (error) {
    console.log('[Supabase] 브라우저 클라이언트 생성 실패, 대체 방식 사용', error);
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, options);
  }
}

// ✅ 기본 클라이언트
const createSupabaseInstance = (): SupabaseClient<Database> => {
  if (supabaseInstance) return supabaseInstance;

  if (typeof window !== 'undefined') return createBrowserClient();

  console.log(`[Supabase] 기본 클라이언트 생성 중 - URL: ${SUPABASE_URL.substring(0, 15)}...`);
  supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, options);
  return supabaseInstance;
};

// 기본 클라이언트 인스턴스 생성
const supabase = createSupabaseInstance();

// ✅ 서버용 Supabase Client (App Router)
export const createServerSupabaseClient = (cookieStore: any) => {
  try {
    // 환경 변수 상태 로깅
    console.log('[Supabase] 서버 컴포넌트 클라이언트 생성 시도');
    console.log('[Supabase] 환경변수 상태:', {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 설정됨' : '❌ 미설정',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 설정됨' : '❌ 미설정'
    });
    
    // App Router에서는 cookies만 전달하고, URL과 ANON_KEY는 자동으로 로드됨
    return createServerComponentClient<Database>({ 
      cookies: () => cookieStore 
    });
  } catch (err) {
    console.error('[Supabase] ❌ 서버 컴포넌트 클라이언트 생성 실패:', err);
    console.log('[Supabase] ♻️ 폴백 클라이언트 사용');
    
    // 실패 시 일반 클라이언트로 폴백
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
  }
};

// ✅ 레거시 서버 클라이언트
export function createLegacyServerClient(): SupabaseClient<Database> {
  console.log('[Supabase] 레거시 서버 클라이언트 생성');
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ✅ 관리자 클라이언트
export function createAdminClient(): SupabaseClient<Database> {
  // ❗ 클라이언트 환경에서 호출되면 중단
  if (typeof window !== 'undefined') {
    console.error('[createAdminClient] 이 함수는 클라이언트에서 호출되면 안 됩니다. 대신 createBrowserClient() 사용하세요.');
    return getSupabaseClient(); // 에러 대신 일반 클라이언트 반환
  }

  if (adminSupabaseInstance) return adminSupabaseInstance;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Supabase] 관리자 클라이언트 생성 실패: SUPABASE_SERVICE_ROLE_KEY가 없습니다');
    return getSupabaseClient();
  }

  console.log('[Supabase] 관리자 클라이언트 생성');
  adminSupabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return adminSupabaseInstance;
}

// ✅ 인증된 클라이언트
export function createAuthedClient(token: string) {
  if (!token) return getSupabaseClient();

  console.log('[Supabase] 인증된 클라이언트 생성');
  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// ✅ 공용 유틸
export function getSupabaseClient(): SupabaseClient<Database> {
  return supabase || createSupabaseInstance();
}

// adminSupabase 변수를 서버 환경에서만 생성
export const adminSupabase = typeof window === 'undefined' 
  ? createAdminClient() 
  : null; // 브라우저 환경에서는 null

export { supabase };
export default supabase; 