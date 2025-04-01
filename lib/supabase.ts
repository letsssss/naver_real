import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase.types';

// 하드코딩된 값으로 설정
const SUPABASE_URL = 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU';

// 환경 변수 로깅
console.log('=== Supabase 환경 변수 디버깅 ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE_URL 설정 여부:', !!SUPABASE_URL);
console.log('SUPABASE_ANON_KEY 설정 여부:', !!SUPABASE_ANON_KEY);
console.log('SUPABASE_SERVICE_ROLE_KEY 설정 여부:', !!SUPABASE_SERVICE_ROLE_KEY);
console.log('===============================');

// 개발 환경 확인
const IS_DEV = process.env.NODE_ENV === 'development';

// Supabase 클라이언트 싱글톤 인스턴스
let supabaseInstance: SupabaseClient<Database> | null = null;

// 클라이언트 옵션 구성
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
};

/**
 * 기본 Supabase 클라이언트를 가져옵니다.
 * 이 클라이언트는 공개 API에 액세스하는 데 사용됩니다.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance;
  
  // 로깅 추가
  console.log(`[Supabase] 클라이언트 생성 - URL: ${SUPABASE_URL.substring(0, 15)}... / 키: ${SUPABASE_ANON_KEY.substring(0, 10)}...`);
  
  try {
    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, supabaseOptions);
    return supabaseInstance;
  } catch (error) {
    console.error('[Supabase] 클라이언트 생성 오류:', error);
    throw error;
  }
}

/**
 * 관리자 권한 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 서버 측에서만 사용되어야 합니다.
 */
export function createAdminClient(): SupabaseClient<Database> {
  console.log(`[Supabase] 관리자 클라이언트 생성 - URL: ${SUPABASE_URL.substring(0, 15)}...`);
  
  try {
    return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error('[Supabase] 관리자 클라이언트 생성 오류:', error);
    throw error;
  }
}

/**
 * 서버 컴포넌트용 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 토큰 기반 인증을 사용합니다.
 */
export function createServerSupabaseClient(jwt?: string): SupabaseClient<Database> {
  // 클라이언트 생성
  console.log(`[Supabase] 서버 클라이언트 생성 - URL: ${SUPABASE_URL.substring(0, 15)}... / JWT 제공: ${!!jwt}`);
  
  try {
    const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
    
    // JWT가 제공된 경우 세션 설정
    if (jwt) {
      client.auth.setSession({
        access_token: jwt,
        refresh_token: ''
      });
    }
    
    return client;
  } catch (error) {
    console.error('[Supabase] 서버 클라이언트 생성 오류:', error);
    throw error;
  }
}

/**
 * 사용자 인증 클라이언트를 생성합니다.
 * @param token 인증 토큰 (선택적)
 */
export function createAuthClient(token?: string): SupabaseClient<Database> {
  const client = getSupabaseClient();
  
  if (token) {
    client.auth.setSession({
      access_token: token,
      refresh_token: ''
    });
  }
  
  return client;
}

/**
 * 싱글톤 Supabase 인스턴스를 내보냅니다.
 */
export const supabase = getSupabaseClient();

/**
 * ID 값을 문자열로 변환합니다.
 * UUID 또는 숫자 ID를 항상 문자열로 처리합니다.
 */
export function formatUserId(id: string | number): string {
  return String(id);
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

export default supabase; 