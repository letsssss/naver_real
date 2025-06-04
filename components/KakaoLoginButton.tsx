"use client";

import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface KakaoLoginButtonProps {
  mode?: 'login' | 'signup';
  text?: string;
}

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';

export default function KakaoLoginButton({ mode = 'login', text }: KakaoLoginButtonProps) {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';

  async function signInWithKakao() {
    try {
      console.log('🚀 카카오 로그인 시작');
      console.log(`현재 URL: ${window.location.origin}`);
      
      // localStorage 초기화 (이전 인증 데이터 정리)
      const keysToRemove = [
        'token', 'user', 'auth-token', 'auth-status', 
        'supabase-auth-token', 'supabase_token',
        'sb-access-token', 'sb-refresh-token',
        PKCE_VERIFIER_KEY, PKCE_VERIFIER_BACKUP_KEY
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      console.log('✅ 이전 인증 데이터 초기화 완료');
      
      // Supabase OAuth 요청
      console.log('📋 Supabase OAuth 요청 시작...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `http://localhost:3000/auth/callback?redirect=${redirectTo}`,
          queryParams: {
            response_type: 'code'
          }
        },
      });
      
      if (error) {
        console.error('❌ 카카오 OAuth 요청 실패:', error);
        throw error;
      }
      
      console.log('📋 OAuth 요청 성공, PKCE verifier 확인 중...');
      
      // PKCE verifier를 찾아서 백업 저장 (여러 방법 시도)
      await new Promise(resolve => setTimeout(resolve, 100)); // 잠시 대기
      
      let verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
      console.log('🔍 1차 verifier 확인 (sessionStorage):', verifier ? `${verifier.substring(0, 10)}...` : 'null');
      
      if (!verifier) {
        // localStorage에서도 확인
        verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
        console.log('🔍 2차 verifier 확인 (localStorage):', verifier ? `${verifier.substring(0, 10)}...` : 'null');
      }
      
      if (!verifier) {
        // 모든 storage 키 확인
        const allSessionKeys = Object.keys(sessionStorage).filter(k => k.includes('verifier') || k.includes('code'));
        const allLocalKeys = Object.keys(localStorage).filter(k => k.includes('verifier') || k.includes('code'));
        console.log('🔍 Storage에서 verifier 관련 키들:', {
          sessionStorage: allSessionKeys,
          localStorage: allLocalKeys
        });
        
        // Supabase 내부에서 사용하는 다른 키들도 확인
        const possibleKeys = [
          'supabase.auth.code_verifier',
          'supabase-auth-code-verifier', 
          'pkce_verifier',
          'code_verifier',
          'auth-code-verifier'
        ];
        
        for (const key of possibleKeys) {
          const val = sessionStorage.getItem(key) || localStorage.getItem(key);
          if (val) {
            console.log(`🔍 발견된 verifier (${key}):`, val.substring(0, 10) + '...');
            verifier = val;
            break;
          }
        }
      }
      
      if (verifier) {
        // 백업 저장
        localStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
        sessionStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
        console.log('✅ PKCE verifier 백업 저장 완료:', verifier.substring(0, 10) + '...');
      } else {
        console.warn('⚠️ PKCE verifier를 찾을 수 없음 - 수동으로 생성해보겠습니다');
        
        // 수동으로 verifier 생성 (fallback)
        const manualVerifier = generateCodeVerifier();
        localStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, manualVerifier);
        sessionStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, manualVerifier);
        sessionStorage.setItem(PKCE_VERIFIER_KEY, manualVerifier);
        console.log('✅ 수동 verifier 생성 및 저장 완료:', manualVerifier.substring(0, 10) + '...');
      }
      
      console.log('✅ 카카오 OAuth 요청 성공 - 리다이렉트 중...');
    } catch (error) {
      console.error('❌ 카카오 로그인 실패:', error);
      alert('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  }

  // PKCE verifier 수동 생성 함수
  function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  const buttonText = text || (mode === 'login' ? '카카오로 로그인' : '카카오로 회원가입');

  return (
    <button
      onClick={signInWithKakao}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
      style={{ backgroundColor: '#FEE500' }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2C5.58 2 2 4.79 2 8.5c0 2.49 1.58 4.65 4 5.74l-.89 3.2c-.08.29.25.52.47.33L9.5 15.5c.17.01.33.01.5.01 4.42 0 8-2.79 8-6.5S14.42 2 10 2z"
          fill="currentColor"
        />
      </svg>
      {buttonText}
    </button>
  );
} 