"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';
const PKCE_AUTH_CODE_KEY = 'supabase.auth.code';
const PKCE_EXCHANGE_ATTEMPTED_KEY = 'supabase.auth.exchange_attempted';
const PKCE_SESSION_KEY = 'supabase.auth.session';

// 세션 저장 헬퍼 함수
const saveSessionToStorage = (session: any) => {
  try {
    // 기본 토큰 저장 (ASCII 안전)
    if (session.access_token) {
      sessionStorage.setItem('token', session.access_token);
      sessionStorage.setItem('auth-token', session.access_token);
      localStorage.setItem('auth-token', session.access_token);
    }
    if (session.refresh_token) {
      sessionStorage.setItem('refresh_token', session.refresh_token);
      localStorage.setItem('refresh_token', session.refresh_token);
    }
    
    const sessionData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user
    };
    
    // JSON으로 저장 (전체 세션 정보)
    localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
    sessionStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
    
    // 순수 토큰만 별도 저장 (헤더 사용용)
    if (session.access_token) {
      localStorage.setItem('supabase.auth.access_token', session.access_token);
      sessionStorage.setItem('supabase.auth.access_token', session.access_token);
    }
    
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

export default function AuthCallback() {
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
    const handleAuthCallback = async () => {
      try {
        const supabase = await getSupabaseClient();
        
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          router.push('/login?error=auth_failed');
          return;
        }

        if (data.session) {
          // 인증 성공 - 홈으로 리다이렉트
          router.push('/');
        } else {
          // 세션이 없는 경우 로그인 페이지로
          router.push('/login');
        }
      } catch (error) {
        // 인증 콜백 처리 오류
        router.push('/login?error=callback_failed');
      }
    };

    handleAuthCallback();
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