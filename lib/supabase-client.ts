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
  supabaseClientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // 세션 상태 디버깅
  supabaseClientInstance.auth.getSession().then(({ data }) => {
    console.log("✅ 브라우저 클라이언트 세션 확인:", data.session ? "세션 있음" : "세션 없음");
    
    if (data.session) {
      const expiresAt = data.session.expires_at;
      const expiresDate = expiresAt ? new Date(expiresAt * 1000).toLocaleString() : '알 수 없음';
      console.log(`✅ 세션 만료: ${expiresDate} (${data.session.user.email})`);
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
    }
  );
  
  // 클린업 함수 리턴
  return () => {
    subscription.unsubscribe();
  };
} 