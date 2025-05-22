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
      // 사용자 지정 쿠키 핸들러는 삭제 (기본값 사용)
      cookieOptions: {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      }
    }
  );
  
  // 세션 상태 디버깅
  supabaseClientInstance.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("❌ 세션 로드 오류:", error.message);
      return;
    }
    
    console.log("✅ 브라우저 클라이언트 세션 확인:", data.session ? "세션 있음" : "세션 없음");
    
    if (data.session) {
      const expiresAt = data.session.expires_at;
      const expiresDate = expiresAt ? new Date(expiresAt * 1000).toLocaleString() : '알 수 없음';
      console.log(`✅ 세션 만료: ${expiresDate} (${data.session.user.email})`);
      
      // 세션 토큰이 만료 예정이면 갱신 시도
      const expiresInSecs = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : 0;
      
      if (expiresInSecs < 60 * 60 * 24) { // 24시간 이내 만료 예정
        console.log('🔄 세션 토큰 만료 임박, 갱신 시도');
        supabaseClientInstance.auth.refreshSession().then(({ data, error }) => {
          if (error) {
            console.error('🔄 세션 갱신 실패:', error.message);
          } else if (data.session) {
            console.log('🔄 세션 갱신 성공:', new Date(data.session.expires_at! * 1000).toLocaleString());
          }
        });
      }
    } else {
      // 로컬 스토리지 확인을 통한 디버깅
      try {
        const authKeys = Object.keys(localStorage).filter(key =>
          key.includes('supabase') || key.includes('auth')
        );
        
        if (authKeys.length > 0) {
          console.log('🧐 로컬 스토리지에 인증 키가 있지만 세션이 로드되지 않음', authKeys);
        }
      } catch (error) {
        console.error('🧐 로컬 스토리지 접근 오류:', error);
      }
    }
  });
  
  return supabaseClientInstance;
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