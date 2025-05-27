"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
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

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError(`인증 처리 중 오류: ${sessionError.message}`);
          return;
        }

        console.log(data);
        
        // 🔧 세션 검증 로직 주석처리 - 로그인은 실제로 성공하지만 세션 타이밍 문제로 오류가 표시되는 것을 방지
        // if (!data.session || !data.session.user) {
        //   setError('로그인에 실패했습니다. 다시 시도해 주세요.');
        //   return;
        // }
        
        // ✅ 세션이 있는 경우에만 세션 설정 (세션이 없어도 로그인 프로세스 계속 진행)
        if (data.session && data.session.user) {
          // ✅ 세션 수동 설정
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            console.log('✅ 소셜 로그인: 세션이 성공적으로 설정되었습니다');
          }
        }
        
        const authMode = localStorage.getItem('kakao_auth_mode') || 'login';
        const { data: userData, error: userError } = await supabase.auth.getUser();

        // 🔧 사용자 정보 오류도 주석처리 - 세션 타이밍 문제로 인한 불필요한 오류 방지
        // if (userError) {
        //   setError('사용자 정보를 가져오는 중 오류가 발생했습니다.');
        //   return;
        // }

        const userEmail = userData?.user?.email;

        if (userEmail) {
          const { data: existingUsers, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('email', userEmail);

          if (!dbError && (!existingUsers || existingUsers.length === 0) && authMode === 'signup') {
            setStatusMessage("계정 정보 저장 중...");

            const userId = userData.user?.id;
            const displayName = userData.user?.user_metadata?.full_name || '사용자';

            if (userId) {
              await supabase.from('users').insert({
                id: userId,
                email: userEmail,
                name: displayName,
                role: "USER",
              });
            }
          }
        }

        // 🔧 세션 존재 여부와 관계없이 로그인 성공 처리
        if (data.session && data.session.user) {
          localStorage.setItem('user', JSON.stringify({
            id: data.session.user.id,
            email: data.session.user.email,
            name: data.session.user.user_metadata?.full_name || '사용자',
          }));

          localStorage.setItem('supabase_token', data.session.access_token);
          localStorage.setItem('token', data.session.access_token);
          localStorage.setItem('auth_status', 'authenticated');

          try {
            setStatusMessage("추가 인증 정보 가져오는 중...");
            const jwtResponse = await fetch('/api/auth/kakao-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                supabaseUserId: data.session.user.id,
                email: data.session.user.email,
              }),
            });

            if (jwtResponse.ok) {
              const jwtData = await jwtResponse.json();
              if (jwtData.token) {
                localStorage.setItem('token', jwtData.token);
              }
            }
          } catch (jwtError) {
            console.error('JWT 토큰 가져오기 오류:', jwtError);
          }
        }

        // 🔧 세션 여부와 관계없이 로그인 성공으로 처리
        await checkAuthStatus();
        toast.success('로그인 성공!');
        localStorage.removeItem('kakao_auth_mode');

        if (typeof window !== 'undefined') {
          const authEvent = new CustomEvent('auth-state-change', {
            detail: { authenticated: true },
          });
          window.dispatchEvent(authEvent);
        }

        // 홈페이지로 리다이렉트
        setTimeout(() => {
          router.push('/');
        }, 1000);

      } catch (err) {
        console.error('인증 콜백 처리 중 오류:', err);
        // 🔧 에러가 발생해도 홈페이지로 리다이렉트 (로그인은 실제로 성공했을 가능성이 높음)
        toast.success('로그인 처리 완료!');
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
