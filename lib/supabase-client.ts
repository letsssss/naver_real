'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';
import type { User } from '@supabase/supabase-js';

// ✅ 싱글톤 인스턴스를 위한 변수
let supabaseClientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * 브라우저에서 사용할 Supabase 클라이언트를 생성합니다.
 * 같은 클라이언트 인스턴스를 재사용하여 불필요한 인스턴스 생성을 방지합니다.
 */
export function getBrowserClient() {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  // 브라우저에서 실행 중인지 확인
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient는 클라이언트 컴포넌트에서만 사용해야 합니다.');
  }

  console.log('✅ 브라우저 클라이언트 생성 (@supabase/ssr)');
  
  // createBrowserClient 사용 (@supabase/ssr)
  // 보안 및 새로고침 관련 기본 설정 적용
  supabaseClientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 클라이언트 자동화된 쿠키 관리 사용
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7일 (쿠키 유효기간 명시적 설정)
      }
    }
  );
  
  // 클라이언트 초기화 후 세션 복원 시도
  initializeClientSession(supabaseClientInstance);
  
  return supabaseClientInstance;
}

/**
 * 클라이언트 세션 초기화 및 세션 복원 시도
 */
async function initializeClientSession(client: ReturnType<typeof createBrowserClient<Database>>) {
  try {
    // 로컬 스토리지에서 세션 데이터 확인
    const localStorageKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || key.includes('sb-') || key.includes('auth')
    );
    
    console.log('📋 인증 관련 로컬 스토리지 키:', localStorageKeys);
    
    // 세션 상태 확인
    const { data, error } = await client.auth.getSession();
    
    if (error) {
      console.error("❌ 세션 로드 오류:", error.message);
      return;
    }
    
    if (data.session) {
      console.log("✅ 브라우저 세션 감지됨:", data.session.user.email);
      const expiresAt = data.session.expires_at;
      const expiresDate = expiresAt ? new Date(expiresAt * 1000).toLocaleString() : '알 수 없음';
      console.log(`✅ 세션 만료: ${expiresDate}`);
      
      // 세션 토큰이 만료 예정이면 갱신 시도
      const expiresInSecs = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : 0;
      
      if (expiresInSecs < 60 * 60 * 24) { // 24시간 이내 만료 예정
        console.log('🔄 세션 토큰 만료 임박, 갱신 시도');
        const { data: refreshData, error: refreshError } = await client.auth.refreshSession();
        
        if (refreshError) {
          console.error('🔄 세션 갱신 실패:', refreshError.message);
        } else if (refreshData.session) {
          console.log('🔄 세션 갱신 성공:', new Date(refreshData.session.expires_at! * 1000).toLocaleString());
        }
      }
    } else {
      console.log("⚠️ 세션 없음, 복원 시도");
      
      // URL에서 토큰 파라미터 확인
      const url = new URL(window.location.href);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        console.log('🔑 URL에서 토큰 발견, 세션 설정 시도');
        
        // 토큰으로 세션 설정
        const { data, error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) {
          console.error('❌ URL 토큰으로 세션 설정 실패:', error.message);
        } else {
          console.log('✅ URL 토큰으로 세션 설정 성공');
          
          // URL에서 토큰 파라미터 제거
          url.searchParams.delete('access_token');
          url.searchParams.delete('refresh_token');
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        // 로컬 스토리지에서 토큰 추출 시도
        try {
          const sbAccessToken = localStorage.getItem('sb-access-token');
          const sbRefreshToken = localStorage.getItem('sb-refresh-token');
          
          if (sbAccessToken && sbRefreshToken) {
            console.log('🔑 로컬 스토리지에서 토큰 발견, 세션 설정 시도');
            
            const { data, error } = await client.auth.setSession({
              access_token: sbAccessToken,
              refresh_token: sbRefreshToken
            });
            
            if (error) {
              console.error('❌ 로컬 스토리지 토큰으로 세션 설정 실패:', error.message);
            } else {
              console.log('✅ 로컬 스토리지 토큰으로 세션 설정 성공');
            }
          } else {
            // 쿠키 상태 확인
            try {
              const response = await fetch('/api/auth/check');
              const cookieData = await response.json();
              console.log('🍪 쿠키 상태 확인:', cookieData);
              
              if (cookieData.hasAuthCookies && !cookieData.hasSession) {
                console.log('🔄 쿠키는 있지만 세션이 없음, 세션 수동 복원 필요할 수 있음');
              }
            } catch (fetchError) {
              console.error('❌ 쿠키 상태 확인 중 오류:', fetchError);
            }
          }
        } catch (localStorageError) {
          console.error('❌ 로컬 스토리지 접근 중 오류:', localStorageError);
        }
      }
    }
  } catch (error) {
    console.error('❌ 세션 초기화 중 오류 발생:', error);
  }
}

/**
 * 클라이언트 컴포넌트에서 사용할 supabase 인스턴스
 * 참고: 클라이언트 컴포넌트에서만 import해야 합니다.
 */
export const supabase = getBrowserClient();

/**
 * 사용자 세션 변경을 감지하는 함수를 설정합니다.
 * @param callback 세션 변경 시 호출될 콜백 함수
 */
export function setupAuthListener(
  callback: (user: User | null) => void
) {
  const client = getBrowserClient();
  
  // 초기 세션 상태 가져오기
  client.auth.getSession().then(({ data }) => {
    callback(data.session?.user || null);
  });
  
  // 인증 상태 변경 감지
  const { data: { subscription } } = client.auth.onAuthStateChange(
    (event, session) => {
      console.log('🔄 Auth 상태 변경:', event, session ? '세션 있음' : '세션 없음');
      callback(session?.user || null);
      
      // SIGNED_IN 이벤트에서 세션이 없는 경우 강제로 세션 검사
      if (event === 'SIGNED_IN' && !session) {
        console.log('⚠️ SIGNED_IN 이벤트 발생했으나 세션이 없음, 세션 재확인');
        client.auth.getSession().then(({ data: { session } }) => {
          callback(session?.user || null);
        });
      }
    }
  );
  
  // 클린업 함수 리턴
  return () => {
    subscription.unsubscribe();
  };
}

/**
 * 토큰을 이용하여 세션을 복원합니다.
 * 다양한 소스에서 세션 토큰을 찾아 복원을 시도합니다.
 */
export async function recoverSession() {
  const client = getBrowserClient();
  
  try {
    // 1. URL 파라미터에서 세션 토큰 확인
    const url = new URL(window.location.href);
    const accessToken = url.searchParams.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token');
    
    if (accessToken && refreshToken) {
      console.log('🔑 URL에서 세션 토큰 발견, 복원 시도');
      
      const { data, error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (error) {
        console.error('❌ URL 토큰으로 세션 복원 실패:', error.message);
      } else {
        console.log('✅ URL 토큰으로 세션 복원 성공');
        
        // URL에서 토큰 파라미터 제거
        url.searchParams.delete('access_token');
        url.searchParams.delete('refresh_token');
        window.history.replaceState({}, '', url.toString());
        
        return true;
      }
    }
    
    // 2. 로컬 스토리지에서 세션 토큰 확인
    const sbAccessToken = localStorage.getItem('sb-access-token');
    const sbRefreshToken = localStorage.getItem('sb-refresh-token');
    
    if (sbAccessToken && sbRefreshToken) {
      console.log('🔑 로컬 스토리지에서 세션 토큰 발견, 복원 시도');
      
      const { data, error } = await client.auth.setSession({
        access_token: sbAccessToken,
        refresh_token: sbRefreshToken
      });
      
      if (error) {
        console.error('❌ 로컬 스토리지 토큰으로 세션 복원 실패:', error.message);
      } else {
        console.log('✅ 로컬 스토리지 토큰으로 세션 복원 성공');
        return true;
      }
    }
    
    // 3. 현재 세션 확인
    const { data, error } = await client.auth.getSession();
    
    if (error) {
      console.error('❌ 세션 확인 중 오류:', error.message);
      return false;
    }
    
    return !!data.session;
  } catch (error) {
    console.error('❌ 세션 복원 중 오류 발생:', error);
    return false;
  }
} 