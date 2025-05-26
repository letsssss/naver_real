"use client";

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface KakaoLoginButtonProps {
  mode?: 'login' | 'signup';
  text?: string;
}

export default function KakaoLoginButton({ mode = 'login', text }: KakaoLoginButtonProps) {
  const supabase = createClientComponentClient();

  async function signInWithKakao() {
    console.log('카카오 로그인 시작...');
    
    
    // Supabase 공식 문서 방식: 커스텀 콜백 사용
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `https://www.easyticket82.com/auth/callback`,
      },
    });
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