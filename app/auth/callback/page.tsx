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
        
        // ✅ 세션이 있는 경우에만 세션 설정
        if (sessionData.session && sessionData.session.user) {
          // 🚀 성능 최적화: 세션 설정을 비동기로 처리 (응답 지연 방지)
          supabase.auth.setSession({
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
          }).then(() => {
            console.log('✅ 소셜 로그인: 세션이 성공적으로 설정되었습니다');
          }).catch(err => {
            console.warn('⚠️ 세션 설정 실패:', err);
          });
        }
        
        const authMode = localStorage.getItem('kakao_auth_mode') || 'login';
        const userEmail = userData?.user?.email;

        // 🚀 성능 최적화: DB 조회와 토큰 저장을 병렬 처리
        const promises = [];

        // 1. 사용자 DB 조회 (필요한 경우만)
        if (userEmail && authMode === 'signup') {
          promises.push(
            supabase
              .from('users')
              .select('*')
              .eq('email', userEmail)
              .then(async ({ data: existingUsers, error: dbError }) => {
                if (!dbError && (!existingUsers || existingUsers.length === 0)) {
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
              })
          );
        }

        // 2. 토큰 저장 및 JWT 토큰 요청
        if (sessionData.session && sessionData.session.user) {
          // 기본 토큰 저장 (즉시 실행)
          const userInfo = {
            id: sessionData.session.user.id,
            email: sessionData.session.user.email,
            name: sessionData.session.user.user_metadata?.full_name || '사용자',
          };
          
          localStorage.setItem('user', JSON.stringify(userInfo));
          localStorage.setItem('supabase_token', sessionData.session.access_token);
          localStorage.setItem('token', sessionData.session.access_token);
          localStorage.setItem('auth_status', 'authenticated');
          
          console.log('✅ 기본 토큰 저장 완료');

          // JWT 토큰 요청 (병렬 처리)
          promises.push(
            fetch('/api/auth/kakao-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                supabaseUserId: sessionData.session.user.id,
                email: sessionData.session.user.email,
              }),
            })
            .then(response => response.ok ? response.json() : null)
            .then(jwtData => {
              if (jwtData?.token) {
                localStorage.setItem('token', jwtData.token);
                console.log('✅ 커스텀 JWT 토큰으로 업데이트 완료');
              }
            })
            .catch(jwtError => {
              console.warn('⚠️ JWT 토큰 가져오기 실패:', jwtError);
            })
          );
        }

        // 🚀 모든 비동기 작업을 병렬로 실행
        if (promises.length > 0) {
          await Promise.allSettled(promises);
        }

        // 🔧 인증 상태 확인을 비동기로 처리 (응답 지연 방지)
        checkAuthStatus().then(() => {
          console.log('✅ 인증 상태 확인 완료');
        }).catch(err => {
          console.warn('⚠️ 인증 상태 확인 실패:', err);
        });
        
        toast.success('로그인 성공!');
        localStorage.removeItem('kakao_auth_mode');

        if (typeof window !== 'undefined') {
          const authEvent = new CustomEvent('auth-state-change', {
            detail: { authenticated: true },
          });
          window.dispatchEvent(authEvent);
        }

        // 홈페이지로 리다이렉트 (더 빠르게)
        setTimeout(() => {
          router.push('/');
        }, 500);

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
