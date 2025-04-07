import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
// 직접 import하지 않고 필요할 때 동적으로 가져오도록 수정
// import { cookies } from 'next/headers';

// ✅ 환경 변수 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("❌ Supabase 환경 변수가 누락되었습니다.");
}

// ✅ Supabase 클라이언트 옵션
const options = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

// ✅ 싱글톤 인스턴스 관리용 변수들
let supabaseInstance: SupabaseClient<Database> | null = null;
let adminSupabaseInstance: SupabaseClient<Database> | null = null;
let initAttempted = false;

// ✅ 싱글톤 Supabase 인스턴스 생성
const createSupabaseInstance = (): SupabaseClient<Database> => {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  if (initAttempted) {
    console.warn('[Supabase] 이전 초기화 시도가 있었지만 생성되지 않았습니다. 재시도합니다.');
  }
  
  initAttempted = true;
  
  try {
    supabaseInstance = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      options
    );
    
    // 디버깅용 로그
    if (typeof window !== 'undefined') {
      console.log('✅ Supabase 클라이언트 초기화 완료');
      console.log('🔗 URL:', SUPABASE_URL.substring(0, 15) + '...');
    }
    
    return supabaseInstance;
  } catch (error) {
    console.error('[Supabase] 클라이언트 생성 오류:', error);
    throw error;
  }
};

// 초기 인스턴스 생성
const supabase = createSupabaseInstance();

/**
 * Next.js 서버 컴포넌트에서 사용하기 위한 Supabase 클라이언트를 생성합니다.
 * 이 함수는 App Router(/app)에서만 사용해야 합니다.
 */
export const createServerSupabaseClient = () => {
  try {
    // 동적으로 cookies 가져오기
    const { cookies } = require('next/headers');
    
    // createServerComponentClient 사용
    try {
      // 기본 호출 시도
      return createServerComponentClient({ cookies });
    } catch (e) {
      console.error('기본 서버 컴포넌트 클라이언트 생성 실패:', e);
      
      // 대체: 싱글톤 인스턴스 반환
      return getSupabaseClient();
    }
  } catch (error) {
    console.error('[Supabase] 서버 컴포넌트 클라이언트 생성 오류:', error);
    // Pages Router에서는 대체 메서드 사용
    return createLegacyServerClient();
  }
};

/**
 * 서버 사이드에서 사용하기 위한 Supabase 클라이언트를 생성합니다.
 * 이 함수는 Pages Router(/pages)와 App Router 모두에서 사용 가능합니다.
 * @deprecated createServerSupabaseClient 함수를 대신 사용하세요.
 */
export function createLegacyServerClient(): SupabaseClient<Database> {
  console.log('[Supabase] 레거시 서버 클라이언트 생성');
  // 기존 인스턴스를 재사용하는 대신, 서버용 옵션이 필요한 경우에만 새 인스턴스 생성
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * 권한 확인을 위한 인증 전용 클라이언트를 생성합니다.
 */
export function createAuthClient(): SupabaseClient<Database> {
  // 새 인스턴스를 생성하지 않고 기존 인스턴스 재사용
  return getSupabaseClient();
}

/**
 * 관리자 권한 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 서버 측에서만 사용되어야 합니다.
 * 싱글톤 패턴으로 한 번만 생성됩니다.
 */
export function createAdminClient(): SupabaseClient<Database> {
  // 이미 생성된 인스턴스가 있으면 재사용
  if (adminSupabaseInstance) {
    return adminSupabaseInstance;
  }
  
  console.log(`[Supabase] 관리자 클라이언트 생성 - URL: ${SUPABASE_URL.substring(0, 15)}...`);
  
  try {
    // 새 인스턴스 생성 및 저장
    adminSupabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return adminSupabaseInstance;
  } catch (error) {
    console.error('[Supabase] 관리자 클라이언트 생성 오류:', error);
    throw error;
  }
}

/**
 * 관리자 권한의 Supabase 클라이언트 인스턴스 (서버에서만 사용)
 * 싱글톤 패턴으로 생성
 */
export const adminSupabase = createAdminClient();

/**
 * 현재 클라이언트나 서버 환경에 맞는 Supabase 클라이언트를 반환합니다.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  return supabase || createSupabaseInstance();
}

/**
 * ID 값을 문자열로 변환합니다.
 * UUID 또는 숫자 ID를 항상 문자열로 처리합니다.
 */
export function formatUserId(id: string | number): string {
  return String(id);
}

/**
 * 인증 토큰으로 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 RLS 정책에 따라 인증된 사용자로 작동합니다.
 * @param token JWT 형식의 인증 토큰
 * @returns 인증된 Supabase 클라이언트
 */
export function createAuthedClient(token: string) {
  if (!token) {
    console.warn("⚠️ 토큰이 제공되지 않았습니다. 익명 클라이언트를 반환합니다.");
    return getSupabaseClient();
  }
  
  console.log("✅ 인증된 Supabase 클라이언트 생성 - 토큰:", token.substring(0, 10) + "...");
  
  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      }
    }
  );
}

/**
 * 데이터 변환 유틸리티
 */
export const transformers = {
  /**
   * snake_case에서 camelCase로 변환
   */
  snakeToCamel: (obj: Record<string, any>): Record<string, any> => {
    if (!obj || typeof obj !== 'object') return obj;
    
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      let value = obj[key];
      
      // 중첩 객체 재귀적 변환
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        value = transformers.snakeToCamel(value);
      } else if (Array.isArray(value)) {
        value = value.map(item => 
          typeof item === 'object' ? transformers.snakeToCamel(item) : item
        );
      }
      
      result[camelKey] = value;
      return result;
    }, {} as Record<string, any>);
  },
  
  /**
   * ISO 문자열을 Date 객체로 변환
   */
  parseDate: (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch (e) {
      console.error('날짜 파싱 오류:', e);
      return null;
    }
  },
  
  /**
   * 날짜를 상대적인 시간 형식으로 변환
   */
  formatRelativeTime: (dateString: string | Date | null | undefined): string => {
    if (!dateString) return '방금 전';
    
    try {
      const date = dateString instanceof Date ? dateString : new Date(dateString);
      if (isNaN(date.getTime())) return '방금 전';

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      
      // 미래 날짜인 경우 (서버 시간 차이 등으로 발생 가능)
      if (diffSeconds < 0) return '방금 전';
      
      if (diffSeconds < 60) return '방금 전';
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}분 전`;
      if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}시간 전`;
      if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}일 전`;
      
      // 1주일 이상인 경우 날짜 표시
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      return '방금 전';
    }
  }
};

// ✅ named + default export 둘 다 제공
export { supabase };
export default supabase; 