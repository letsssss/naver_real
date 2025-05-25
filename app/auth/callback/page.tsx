'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('처리 중...');

  // ✅ 세션 대기 함수
  const waitForSession = async (supabase: any, timeout = 3000, interval = 100): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('✅ 세션 재확인 성공:', session.user.email);
        return true;
      }
      await new Promise(res => setTimeout(res, interval));
    }
    console.warn('⏱️ 세션 대기 타임아웃');
    return false;
  };

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('🔄 OAuth 콜백 처리 시작...');
        console.log('현재 URL:', window.location.href);
        
        // 통일된 브라우저 클라이언트 사용
        const supabase = createBrowserClient();
        
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log('🔍 URL 파라미터:', {
          code: code ? '있음' : '없음',
          error,
          accessToken: accessToken ? '있음' : '없음',
          refreshToken: refreshToken ? '있음' : '없음'
        });

        if (error) {
          console.error('❌ OAuth 오류:', error);
          setStatus('로그인 오류가 발생했습니다.');
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        if (code) {
          console.log('✅ Code 기반 인증 처리');
          setStatus('세션 생성 중...');
          console.log('🔄 exchangeCodeForSession 호출...');
          
          const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(window.location.href);

          if (sessionError || !data.session) {
            console.error('❌ exchangeCodeForSession 오류:', sessionError?.message || '세션 없음');
            setStatus('세션 생성에 실패했습니다.');
            setTimeout(() => router.replace('/login'), 2000);
            return;
          }

          console.log('✅ Code 기반 세션 생성 완료!');
          console.log('사용자 ID:', data.session.user.id);
          console.log('사용자 이메일:', data.session.user.email);
        }

        else if (accessToken && refreshToken) {
          console.log('✅ Access Token 기반 인증 처리');
          setStatus('토큰으로 세션 생성 중...');
          
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError || !data.session) {
            console.error('❌ setSession 오류:', sessionError?.message || '세션 없음');
            setStatus('세션 설정에 실패했습니다.');
            setTimeout(() => router.replace('/login'), 2000);
            return;
          }

          console.log('✅ Access Token 기반 세션 설정 완료!');
          console.log('사용자 ID:', data.session.user.id);
          console.log('사용자 이메일:', data.session.user.email);
        }

        else {
          console.error('❌ 인증 코드와 액세스 토큰이 모두 없습니다');
          setStatus('인증 정보를 받지 못했습니다.');
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        // ✅ 세션 잡힐 때까지 기다림
        setStatus('세션 확인 중...');
        const success = await waitForSession(supabase);
        if (success) {
          setStatus('로그인 완료! 홈페이지로 이동합니다...');
          setTimeout(() => router.replace('/'), 1000);
        } else {
          setStatus('세션 확인 실패. 다시 시도해주세요.');
          setTimeout(() => router.replace('/login'), 2000);
        }

      } catch (error: any) {
        console.error('💥 OAuth 콜백 처리 중 오류:', error);
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
        <div className="text-sm text-gray-500">
          잠시만 기다려주세요...
        </div>
      </div>
    </div>
  );
} 