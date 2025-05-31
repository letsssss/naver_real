import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';
import { createBrowserClient, createServerClient } from '@supabase/ssr';

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
let supabaseInstance: SupabaseClient<Database> | null = null;
let adminSupabaseInstance: SupabaseClient<Database> | null = null;
let browserClientInstance: SupabaseClient<Database> | null = null;
let initAttempted = false;

/**
 * 브라우저에서 사용하기 위한 Supabase 클라이언트를 생성합니다.
 * 이 클라이언트는 쿠키 기반 인증을 자동으로 처리합니다.
 * 브라우저 환경에서만 사용할 수 있습니다.
 */
export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  // 브라우저 환경이 아니면 일반 클라이언트 반환
  if (typeof window === 'undefined') {
    console.warn('브라우저 환경이 아닙니다. 일반 클라이언트를 반환합니다.');
    return getSupabaseClient();
  }
  
  // 이미 생성된 인스턴스가 있으면 재사용
  if (browserClientInstance) {
    return browserClientInstance;
  }
  
  try {
    console.log('✅ 브라우저 클라이언트 생성 (@supabase/ssr)');
    
    // 새로운 브라우저 클라이언트 생성
    const client = createBrowserClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return document.cookie.split('; ').find(row => row.startsWith(name))?.split('=')[1]
          },
          set(name: string, value: string, options: { path: string; maxAge?: number; domain?: string; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' }) {
            document.cookie = `${name}=${value}; path=${options.path}${options.maxAge ? `; max-age=${options.maxAge}` : ''}${options.domain ? `; domain=${options.domain}` : ''}${options.secure ? '; secure' : ''}${options.sameSite ? `; samesite=${options.sameSite}` : ''}`
          },
          remove(name: string, options: { path: string; domain?: string }) {
            document.cookie = `${name}=; path=${options.path}${options.domain ? `; domain=${options.domain}` : ''}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          },
        },
      }
    );
    
    browserClientInstance = client;
    console.log('✅ 브라우저 클라이언트 생성 성공');
    
    // 세션 확인 테스트
    browserClientInstance.auth.getSession().then(({ data }) => {
      console.log("✅ 브라우저 클라이언트 세션 확인:", data.session ? "세션 있음" : "세션 없음");
      
      // 세션이 있으면 세션 정보 출력
      if (data.session) {
        const expiresAt = data.session.expires_at;
        const expiresDate = expiresAt ? new Date(expiresAt * 1000).toLocaleString() : '알 수 없음';
        console.log(`✅ 세션 만료: ${expiresDate} (${data.session.user.email})`);
      }
    });
    
    return browserClientInstance;
  } catch (error) {
    console.error('브라우저 클라이언트 생성 오류:', error);
    // 오류 발생 시 일반 클라이언트로 폴백
    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, options);
    return supabaseInstance;
  }
}

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
    // 브라우저 환경에서는 createBrowserSupabaseClient 사용
    if (typeof window !== 'undefined') {
      return createBrowserSupabaseClient();
    }
    
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
 * @supabase/ssr의 createServerClient를 사용하여 쿠키 처리를 완벽하게 지원합니다.
 */
export const createServerSupabaseClient = () => {
  // 동적으로 cookies import (Pages Router 호환성을 위해)
  const { cookies } = require('next/headers');
  const cookieStore = cookies();

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // 서버 컴포넌트에서 쿠키 설정이 실패할 수 있음 (읽기 전용 컨텍스트)
            console.warn('[Supabase] 쿠키 설정 실패:', error);
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.delete({ name, ...options });
          } catch (error) {
            // 서버 컴포넌트에서 쿠키 삭제가 실패할 수 있음 (읽기 전용 컨텍스트)
            console.warn('[Supabase] 쿠키 삭제 실패:', error);
          }
        },
      },
    }
  );

  return supabase;
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
 * @param cookieStore 선택적으로 쿠키 스토어를 전달하여 인증된 세션을 유지할 수 있습니다.
 */
export function createAdminClient(cookieStore?: any): SupabaseClient<Database> {
  // ❗ 클라이언트 환경에서 호출되면 중단
  if (typeof window !== 'undefined') {
    console.error('[createAdminClient] 이 함수는 클라이언트에서 호출되면 안 됩니다. 대신 createBrowserSupabaseClient() 사용하세요.');
    return getSupabaseClient(); // 에러 대신 일반 클라이언트 반환 (기존 코드 깨지지 않도록)
  }
  
  // 쿠키가 제공된 경우 서버 컴포넌트 클라이언트 생성 시도
  if (cookieStore && typeof cookieStore === 'object') {
    try {
      const { createServerComponentClient } = require('@supabase/auth-helpers-nextjs');
      return createServerComponentClient({ cookies: () => cookieStore });
    } catch (error) {
      console.warn('[Supabase] 쿠키를 사용한 서버 컴포넌트 클라이언트 생성 실패:', error);
      // 실패 시 일반 관리자 클라이언트로 폴백
    }
  }
  
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
export const adminSupabase = typeof window === 'undefined' 
  ? createAdminClient() 
  : null; // 브라우저 환경에서는 null로 설정

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