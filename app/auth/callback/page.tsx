'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';
const PKCE_AUTH_CODE_KEY = 'supabase.auth.code';
const PKCE_EXCHANGE_ATTEMPTED_KEY = 'supabase.auth.exchange_attempted';
const PKCE_SESSION_KEY = 'supabase.auth.session';

export default function AuthCallbackPage() {
  const router = useRouter();
  const exchangeAttempted = useRef(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 이미 처리 중이면 중단
        if (exchangeAttempted.current) {
          console.log('🔄 Already processing callback');
          return;
        }
        exchangeAttempted.current = true;

        // 현재 세션 확인
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          console.log('✅ Active session found, redirecting...');
          router.push('/');
          return;
        }

        // URL에서 code 파라미터 추출
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        // code verifier 가져오기 (sessionStorage와 localStorage 모두 확인)
        let verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
        if (!verifier) {
          verifier = localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);
          if (verifier) {
            console.log('♻️ Restored verifier from backup');
            sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
          }
        }

        // 이전 교환 시도 기록 확인
        const previousAttempt = sessionStorage.getItem(PKCE_EXCHANGE_ATTEMPTED_KEY);
        if (previousAttempt === code) {
          console.log('🔄 Token exchange already attempted for this code');
          router.push('/');
          return;
        }

        if (!code || !verifier) {
          console.error('❌ Missing auth parameters:', { 
            code: !!code, 
            verifier: !!verifier,
            sessionVerifier: !!sessionStorage.getItem(PKCE_VERIFIER_KEY),
            localVerifier: !!localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY)
          });
          router.push('/login');
          return;
        }

        // 현재 교환 시도 기록
        sessionStorage.setItem(PKCE_EXCHANGE_ATTEMPTED_KEY, code);
        
        console.log('📦 Using code_verifier:', verifier.substring(0, 10) + '...');
        console.log('🔑 Using auth code:', code);

        // PKCE 토큰 교환
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('❌ 세션 교환 실패:', error.message);
          // 실패한 경우에만 교환 시도 기록 제거
          sessionStorage.removeItem(PKCE_EXCHANGE_ATTEMPTED_KEY);
          router.push('/login');
          return;
        }

        if (data.session) {
          console.log('✅ 세션 교환 성공');
          
          // 성공 후 스토리지 정리
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);
          localStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
          sessionStorage.removeItem(PKCE_AUTH_CODE_KEY);
          
          // 성공한 교환 기록
          const sessionData = {
            code,
            verifier,
            timestamp: Date.now()
          };
          sessionStorage.setItem(PKCE_SESSION_KEY, JSON.stringify(sessionData));
          
          router.push('/');
        }
      } catch (error) {
        console.error('❌ 콜백 처리 중 오류:', error);
        sessionStorage.removeItem(PKCE_EXCHANGE_ATTEMPTED_KEY);
        router.push('/login');
      }
    };

    handleCallback();
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">로그인 처리 중...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    </div>
  );
}