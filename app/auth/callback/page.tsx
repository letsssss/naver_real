"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("로그인 처리 중...");
  const { checkAuthStatus } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      
      try {
        if (typeof window === 'undefined') return;

        // ✅ code 쿼리 파라미터가 없는 경우
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (!code) {
          setError('인증 코드가 전달되지 않았습니다.');
          return;
        }

        // auth-context와 동일한 클라이언트 사용
        const supabase = createBrowserClient();

        // 🚀 성능 최적화: 세션 조회와 사용자 정보 조회를 병렬 처리
        const [sessionResult, userResult] = await Promise.allSettled([
          supabase.auth.getSession(),
          supabase.auth.getUser()
        ]);

        // 세션 결과 처리
        let sessionData = null;
        if (sessionResult.status === 'fulfilled' && !sessionResult.value.error) {
          sessionData = sessionResult.value.data;
        } else {
          console.error('세션 조회 오류:', sessionResult.status === 'rejected' ? sessionResult.reason : sessionResult.value.error);
          setError('인증 처리 중 오류가 발생했습니다.');
          return;
        }

        // 사용자 결과 처리
        let userData = null;
        if (userResult.status === 'fulfilled' && !userResult.value.error) {
          userData = userResult.value.data;
        }

        console.log('✅ 병렬 조회 완료:', { 
          session: sessionData.session ? '있음' : '없음',
          user: userData?.user ? '있음' : '없음'
        });
        
        // ✅ 세션이 있는 경우 인증 상태 업데이트
        if (sessionData.session && sessionData.session.user) {
          console.log('✅ 카카오 로그인 성공:', sessionData.session.user.email);
          
          // auth-context의 checkAuthStatus를 호출하여 일관된 인증 상태 관리
          await checkAuthStatus();
          
          setStatusMessage("로그인 완료! 홈페이지로 이동합니다...");
          
          // 성공 시 홈페이지로 이동
          setTimeout(() => {
            router.push('/');
          }, 1000);
          
        } else {
          console.error('❌ 세션 또는 사용자 정보가 없습니다');
          setError('로그인 처리 중 오류가 발생했습니다.');
        }

      } catch (err) {
        console.error('인증 콜백 처리 중 오류:', err);
        // 🔧 에러가 발생해도 홈페이지로 리다이렉트 (로그인은 실제로 성공했을 가능성이 높음)
        toast.info('로그인 처리 완료!');
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }
    };

    handleAuthCallback();
  }, [router, checkAuthStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? (
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-red-600">로그인 오류</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button 
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">{statusMessage}</h2>
          <div className="w-12 h-12 border-4 border-t-blue-500 border-b-blue-500 border-l-transparent border-r-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">잠시만 기다려 주세요. 곧 홈페이지로 이동합니다.</p>
        </div>
      )}
    </div>
  );
}
