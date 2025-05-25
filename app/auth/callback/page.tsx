'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('처리 중...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('🔄 OAuth 콜백 처리 시작...');
        console.log('현재 URL:', window.location.href);

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          console.error('❌ OAuth 오류:', error);
          setStatus('로그인 오류가 발생했습니다.');
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        if (code) {
          console.log('✅ Code 기반 인증 처리');
          setStatus('세션 생성 중...');
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(window.location.href);

          if (sessionError || !data.session) {
            console.error('❌ 세션 생성 실패:', sessionError?.message);
            setStatus('세션 생성에 실패했습니다.');
            setTimeout(() => router.replace('/login'), 2000);
            return;
          }

          console.log('✅ 세션 생성 완료:', data.session.user.email);
          setStatus('로그인 완료! 홈페이지로 이동합니다...');
          setTimeout(() => router.replace('/'), 1000);
          return;
        }

        console.error('❌ 인증 코드가 없습니다');
        setStatus('인증 정보를 받지 못했습니다.');
        setTimeout(() => router.replace('/login'), 2000);

      } catch (err: any) {
        console.error('💥 처리 중 오류:', err);
        setStatus('로그인 처리 중 오류가 발생했습니다.');
        setTimeout(() => router.replace('/login'), 2000);
      }
    };

    handleOAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <h1 className="text-2xl font-bold text-gray-900">카카오 로그인</h1>
        <p className="text-lg text-gray-600">{status}</p>
        <div className="text-sm text-gray-500">잠시만 기다려주세요...</div>
      </div>
    </div>
  );
} 