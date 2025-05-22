'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase.types'

// 브라우저에서 사용할 Supabase 클라이언트 생성
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    // 브라우저 쿠키 옵션 설정
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 7일간 유효
    }
  }
)

// 세션 상태 확인
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('세션 로드 오류:', error.message);
  } else {
    console.log('세션 상태:', data.session ? '있음' : '없음');
    
    if (data.session) {
      const expiresAt = new Date(data.session.expires_at! * 1000);
      console.log('세션 만료 시간:', expiresAt.toLocaleString());
      
      // 만료 시간이 24시간 이내인 경우 토큰 갱신 시도
      const timeUntilExpiry = expiresAt.getTime() - Date.now();
      if (timeUntilExpiry < 24 * 60 * 60 * 1000) {
        console.log('토큰 갱신 시도 중...');
        supabase.auth.refreshSession();
      }
    } else {
      // 세션이 없지만 인증 관련 쿠키나 로컬 스토리지 항목이 있는지 확인
      try {
        const authKeys = Object.keys(localStorage).filter(key => 
          key.includes('supabase') || key.includes('sb-') || key.includes('auth')
        );
        
        if (authKeys.length > 0) {
          console.log('인증 관련 로컬 스토리지 키 발견. 세션 복구 시도...', authKeys);
          
          // 자동 세션 복구 시도
          fetch('/api/auth/refresh')
            .then(res => res.json())
            .then(data => {
              if (data.status === 'success') {
                console.log('세션 복구 성공:', data.user.email);
                // 페이지 새로고침 (선택적)
                // window.location.reload();
              } else {
                console.log('세션 복구 실패:', data.error);
                // 복구 실패 시 로컬 스토리지 정리
                cleanupAuthStorage();
              }
            })
            .catch(err => {
              console.error('세션 복구 요청 실패:', err);
              // 요청 실패 시 로컬 스토리지 정리
              cleanupAuthStorage();
            });
        }
      } catch (err) {
        console.error('로컬 스토리지 확인 중 오류:', err);
      }
    }
  }
});

// 로그아웃 시 호출할 함수 (다른 컴포넌트에서 사용 가능)
export async function signOut() {
  try {
    // Supabase 로그아웃
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('로그아웃 오류:', error.message);
      return { success: false, error: error.message };
    }
    
    // 로컬 스토리지 정리
    cleanupAuthStorage();
    
    // 인증 상태 쿠키 제거
    document.cookie = 'auth-status=; path=/; max-age=0';
    
    console.log('로그아웃 성공');
    return { success: true };
  } catch (err) {
    console.error('로그아웃 중 예외 발생:', err);
    return { success: false, error: 'Unknown error during sign out' };
  }
}

// 인증 관련 스토리지 정리 함수
export function cleanupAuthStorage() {
  try {
    // 인증 관련 로컬 스토리지 항목 찾기
    const authKeys = Object.keys(localStorage).filter(key => 
      key.includes('supabase') || key.includes('sb-') || key.includes('auth')
    );
    
    // 모든 인증 관련 항목 제거
    authKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`로컬 스토리지 항목 제거: ${key}`);
    });
    
    console.log('인증 스토리지 정리 완료');
  } catch (err) {
    console.error('스토리지 정리 중 오류:', err);
  }
}

// 세션 수동 갱신 함수
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('세션 갱신 실패:', error.message);
      return { success: false, error: error.message };
    }
    
    if (data.session) {
      console.log('세션 갱신 성공:', data.session.user.email);
      console.log('새 만료 시간:', new Date(data.session.expires_at! * 1000).toLocaleString());
      return { success: true, session: data.session };
    } else {
      console.log('세션 갱신 후 세션 객체가 없음');
      return { success: false, error: 'No session after refresh' };
    }
  } catch (err) {
    console.error('세션 갱신 중 예외 발생:', err);
    return { success: false, error: 'Unknown error during refresh' };
  }
} 