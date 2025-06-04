'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';
const PKCE_AUTH_CODE_KEY = 'supabase.auth.code';
const PKCE_EXCHANGE_ATTEMPTED_KEY = 'supabase.auth.exchange_attempted';
const PKCE_SESSION_KEY = 'supabase.auth.session';

// 세션 저장 헬퍼 함수
const saveSessionToStorage = (session: any) => {
  try {
    sessionStorage.setItem('token', session.access_token);
    sessionStorage.setItem('auth-token', session.access_token);
    sessionStorage.setItem('refresh_token', session.refresh_token);
    
    const sessionData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user
    };
    
    localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
    sessionStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      const supabaseKey = `sb-${projectRef}-auth-token`;
      localStorage.setItem(supabaseKey, JSON.stringify(sessionData));
      sessionStorage.setItem(supabaseKey, JSON.stringify(sessionData));
    }
    
    if (session.user) {
      const userData = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || 
              session.user.user_metadata?.full_name || 
              session.user.user_metadata?.display_name || '',
        profileImage: session.user.user_metadata?.avatar_url || 
                    session.user.user_metadata?.picture || '',
        provider: session.user.app_metadata?.provider || 'kakao'
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem('user', JSON.stringify(userData));
    }
    
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    
    document.cookie = `auth-status=authenticated; path=/; expires=${expires.toUTCString()}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    
    const verification = {
      localStorage: {
        token: !!localStorage.getItem('token'),
        user: !!localStorage.getItem('user'),
        supabaseToken: !!localStorage.getItem('supabase.auth.token')
      },
      sessionStorage: {
        token: !!sessionStorage.getItem('token'),
        user: !!sessionStorage.getItem('user'),
        supabaseToken: !!sessionStorage.getItem('supabase.auth.token')
      }
    };
    
    const allSuccess = verification.localStorage.token && 
                      verification.localStorage.user && 
                      verification.sessionStorage.token && 
                      verification.sessionStorage.user;
    
    if (!allSuccess) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const exchangeAttempted = useRef(false);

  // localStorage/sessionStorage 접근 권한 테스트
  useEffect(() => {
    const testStorage = () => {
      try {
        const testKey = 'test-storage-access';
        const testValue = 'test-value-' + Date.now();
        
        localStorage.setItem(testKey, testValue);
        const retrievedValue = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        sessionStorage.setItem(testKey, testValue);
        const retrievedSessionValue = sessionStorage.getItem(testKey);
        sessionStorage.removeItem(testKey);
        
        document.cookie = `${testKey}=${testValue}; path=/`;
        const cookieExists = document.cookie.includes(testKey);
        document.cookie = `${testKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        
        const existingKeys = {
          localStorage: Object.keys(localStorage).filter(k => 
            k.includes('token') || k.includes('auth') || k.includes('user') || k.includes('supabase')
          ),
          sessionStorage: Object.keys(sessionStorage).filter(k => 
            k.includes('token') || k.includes('auth') || k.includes('user') || k.includes('supabase')
          )
        };
        
      } catch (error) {
        // Storage 접근 실패 시 무시
      }
    };
    
    testStorage();
  }, []);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 이미 처리 중이면 중단
        if (exchangeAttempted.current) {
          return;
        }
        exchangeAttempted.current = true;

        // 현재 세션 확인 (약간의 지연을 두고)
        
        // Supabase 인증 상태가 안정화될 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          // 현재 세션 확인 오류 처리
        }
        
        if (currentSession) {
          const saved = saveSessionToStorage(currentSession);
          if (saved) {
            router.push('/');
          } else {
            // 기존 세션 저장 실패 처리
          }
          return;
        }
        
        // URL에서 code 파라미터 추출
        const urlParams = new URLSearchParams(window.location.search);
        const urlString = window.location.href;
        const codeMatch = urlString.match(/[?&]code=([^&]+)/);
        const errorMatch = urlString.match(/[?&]error=([^&]+)/);
        
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : urlParams.get('code');
        const error = errorMatch ? decodeURIComponent(errorMatch[1]) : urlParams.get('error');
        
        if (error) {
          // OAuth 오류 발생 시 처리
          router.push('/login');
          return;
        }
        
        // code verifier 가져오기
        let verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
        
        if (!verifier) {
          verifier = localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);
          if (verifier) {
            sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
          }
        }
        
        if (!code) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (retrySession) {
            const saved = saveSessionToStorage(retrySession);
            if (saved) {
              router.push('/');
              return;
            }
          }
          
          router.push('/login');
          return;
        }
        
        if (!verifier) {
          // verifier 누락 시 처리
          router.push('/login');
          return;
        }

        // 현재 교환 시도 기록
        sessionStorage.setItem(PKCE_EXCHANGE_ATTEMPTED_KEY, code);
        
        // PKCE 토큰 교환
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          // 세션 교환 실패 시 처리
          router.push('/login');
          return;
        }

        if (data.session) {
          // 세션을 localStorage와 sessionStorage에 저장
          const saved = saveSessionToStorage(data.session);
          
          if (!saved) {
            // 세션 저장 실패 시 처리
            router.push('/login');
            return;
          }
          
          // 성공 후 스토리지 정리
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);
          localStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
          sessionStorage.removeItem(PKCE_AUTH_CODE_KEY);
          
          // 성공한 교환 기록
          const sessionRecord = {
            code,
            verifier,
            timestamp: Date.now(),
            success: true
          };
          sessionStorage.setItem(PKCE_SESSION_KEY, JSON.stringify(sessionRecord));
          
          // 리다이렉트 전에 잠시 대기 (저장 완료 확인)
          setTimeout(() => {
            router.push('/');
          }, 500);
        } else {
          // 세션 데이터가 비어있을 시 처리
          router.push('/login');
        }
      } catch (error) {
        // 콜백 처리 중 치명적 오류 처리
        sessionStorage.removeItem(PKCE_EXCHANGE_ATTEMPTED_KEY);
        router.push('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">카카오 로그인 처리 중...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="text-gray-600 mt-4">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}