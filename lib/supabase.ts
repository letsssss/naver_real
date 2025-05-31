import { createClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase.types';
import { cookies } from 'next/headers';

// env.ts에서 환경변수 가져오기
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '@/lib/env';

// ✅ Supabase 클라이언트 옵션
const options = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
};

// ✅ 싱글톤 인스턴스 관리용 변수들
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;
let adminSupabaseInstance: ReturnType<typeof createClient<Database>> | null = null;
let browserClientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;
let initAttempted = false;

/**
 * 브라우저에서 사용하기 위한 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 쿠키 기반 인증을 자동으로 처리합니다.
 * 브라우저 환경에서만 사용할 수 있습니다.
 */
export function createBrowserSupabaseClient() {
  if (!browserClientInstance) {
    browserClientInstance = createBrowserClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }
  return browserClientInstance;
}

/**
 * 서버에서 사용하기 위한 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 쿠키 기반 인증을 자동으로 처리합니다.
 * 서버 컴포넌트나 API 라우트에서 사용할 수 있습니다.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, '', ...options, maxAge: 0 });
        },
      },
    }
  );
}

/**
 * 일반 Supabase 클라이언트를 생성하거나 반환합니다.
 * 이미 생성된 인스턴스가 있다면 그것을 재사용합니다.
 */
export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, options);
  }
  return supabaseInstance;
}

/**
 * 관리자 권한을 가진 Supabase 클라이언트를 생성하거나 반환합니다.
 * 이미 생성된 인스턴스가 있다면 그것을 재사용합니다.
 */
export function getAdminSupabaseClient() {
  if (!adminSupabaseInstance) {
    adminSupabaseInstance = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        ...options,
        auth: {
          ...options.auth,
          persistSession: false,
        },
      }
    );
  }
  return adminSupabaseInstance;
}

// ✅ 기본 Supabase 클라이언트 인스턴스 생성
export const supabase = getSupabaseClient();

// ✅ 관리자 권한을 가진 Supabase 클라이언트 인스턴스 생성
export const adminSupabase = getAdminSupabaseClient();

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
        autoRefreshToken: false,
        persistSession: false,
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

export function createTokenClient(token: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
  return supabase;
}

// ✅ named + default export 둘 다 제공
export { supabase };
export default supabase; 