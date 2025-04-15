// lib/supabase/server.ts - Supabase SSR 클라이언트

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// ⚡ 하드코딩된 환경 변수 - 환경 변수 로딩 문제 해결
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU';

// 디버깅 로그: Supabase 서버 클라이언트 초기화
console.log(`[Supabase 서버 클라이언트 초기화] URL: ${SUPABASE_URL.substring(0, 15)}... ANON_KEY: ${SUPABASE_ANON_KEY.substring(0, 15)}...`);

// 프로젝트 참조 ID (쿠키 이름에 사용)
export const projectRef = SUPABASE_URL.split('.')[0].split('//')[1];
export const supabaseAuthCookieName = `sb-${projectRef}-auth-token`;
const accessTokenName = `sb-${projectRef}-access-token`;
const refreshTokenName = `sb-${projectRef}-refresh-token`;
const authStatusName = 'auth-status';

/**
 * 관리자 권한을 가진 Supabase 클라이언트를 생성합니다.
 * 주의: 서비스 롤 키는 보안에 민감하므로 서버 사이드에서만 사용해야 합니다.
 */
export function createAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[Supabase Admin 클라이언트] 서비스 롤 키가 설정되지 않았습니다.');
  }
  
  try {
    console.log('[Supabase Admin 클라이언트] 생성 시도');
    return createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  } catch (error) {
    console.error('[Supabase Admin 클라이언트] 생성 오류:', error);
    throw error;
  }
}

// Admin 클라이언트 인스턴스 생성
export const adminSupabase = createAdminClient();

/**
 * 서버 컴포넌트에서 사용할 Supabase 클라이언트를 생성합니다.
 * 쿠키에서 세션 정보를 읽어 인증 상태를 유지합니다.
 */
export function createServerClient() {
  try {
    const cookieStore = cookies();
    
    // 디버깅: 쿠키 이름 로깅
    console.log('[Supabase Server 클라이언트] 쿠키 확인:');
    const allCookies = cookieStore.getAll();
    allCookies.forEach(cookie => {
      const value = cookie.value.length > 20 
        ? `${cookie.value.substring(0, 20)}...` 
        : cookie.value;
      console.log(`- ${cookie.name}: ${value}`);
    });
    
    // 인증 토큰 쿠키 특별 확인
    const accessToken = cookieStore.get(accessTokenName);
    const refreshToken = cookieStore.get(refreshTokenName);
    const authStatus = cookieStore.get(authStatusName);
    
    console.log('[Supabase Server 클라이언트] 인증 쿠키 상태:');
    console.log(`- 액세스 토큰: ${accessToken ? '✅ 있음' : '❌ 없음'}`);
    console.log(`- 리프레시 토큰: ${refreshToken ? '✅ 있음' : '❌ 없음'}`);
    console.log(`- 인증 상태: ${authStatus ? authStatus.value : '❌ 없음'}`);
    
    // 쿠키 소스 객체 생성 (Supabase가 쿠키를 처리하는 방식 조정)
    // 명시적으로 쿠키 함수를 제공하여 세션 문제 해결
    return createServerComponentClient<Database>({ 
      cookies: () => {
        // 모든 쿠키를 콘솔에 출력하여 디버깅
        console.log(`[Supabase] 쿠키 함수 호출됨, 쿠키 수: ${allCookies.length}`);
        return cookieStore;
      }
    });
  } catch (error) {
    console.error('[Supabase Server 클라이언트] 생성 오류:', error);
    
    // 오류 발생 시 기본 클라이언트 반환 (인증되지 않은 상태)
    console.log('[Supabase Server 클라이언트] 대체 클라이언트 생성');
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

/**
 * Supabase 세션을 가져오고 유효성을 검사합니다.
 * 세션이 없거나 만료된 경우 null을 반환합니다.
 */
export async function getServerSession() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('[Supabase 세션] 가져오기 오류:', error.message);
      return null;
    }
    
    if (!data.session) {
      console.log('[Supabase 세션] 세션 없음');
      return null;
    }
    
    console.log('[Supabase 세션] 세션 존재:', data.session.user.id);
    return data.session;
  } catch (error) {
    console.error('[Supabase 세션] 처리 중 오류:', error);
    return null;
  }
}

/**
 * 인증된 세션이 필요한 서버 컴포넌트에서 사용합니다.
 * 세션이 없을 경우 오류를 던져 처리할 수 있게 합니다.
 */
export async function requireSession() {
  try {
    const session = await getServerSession();
    if (!session) {
      throw new Error('인증 세션이 필요합니다.');
    }
    return session;
  } catch (error) {
    console.error('[Supabase 인증] 세션 필요:', error);
    throw error;
  }
} 