"use client";

import { useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

interface KakaoLoginButtonProps {
  mode?: 'login' | 'signup';
  text?: string;
}

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';

export default function KakaoLoginButton({ mode = 'login', text }: KakaoLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

  const handleKakaoLogin = async () => {
    try {
      setIsLoading(true)
      
      const supabase = await getSupabaseClient()
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      if (error) {
        throw error
      }
    } catch (error) {
      // 카카오 로그인 오류 처리
    } finally {
      setIsLoading(false)
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
      onClick={handleKakaoLogin}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
      style={{ backgroundColor: '#FEE500' }}
      disabled={isLoading}
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