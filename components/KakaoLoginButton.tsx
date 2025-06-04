"use client";

import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface KakaoLoginButtonProps {
  mode?: 'login' | 'signup';
  text?: string;
}

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';

export default function KakaoLoginButton({ mode = 'login', text }: KakaoLoginButtonProps) {
  const supabase = createClientComponentClient();
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
        'sb-access-token', 'sb-refresh-token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      console.log('✅ 이전 인증 데이터 초기화 완료');
      
      // Supabase OAuth 요청
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
      
      // PKCE verifier를 localStorage에 백업 (콜백에서 사용하기 위해)
      const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
      if (verifier) {
        localStorage.setItem(PKCE_VERIFIER_BACKUP_KEY, verifier);
        console.log('✅ PKCE verifier 백업 저장 완료');
      } else {
        console.warn('⚠️ PKCE verifier를 찾을 수 없음');
      }
      
      console.log('✅ 카카오 OAuth 요청 성공 - 리다이렉트 중...');
    } catch (error) {
      console.error('❌ 카카오 로그인 실패:', error);
      alert('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    }
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