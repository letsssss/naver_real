"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

export default function AuthCallback() {
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState('로그인 처리 중...');
  const router = useRouter();
  const { checkAuthStatus } = useAuth();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const supabase = createClientComponentClient();
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('세션 가져오기 오류:', error);
          
          // 구체적인 오류 메시지 분류
          let message = '';
          if (error.message.includes('invalid_request')) {
            message = `OAuth 요청이 유효하지 않습니다: ${error.message}`;
          } else if (error.message.includes('access_denied')) {
            message = '카카오 로그인이 거부되었습니다. 다시 시도해주세요.';
          } else if (error.message.includes('invalid_grant')) {
            message = '인증 코드가 만료되었습니다. 다시 로그인해주세요.';
          } else if (error.message.includes('network')) {
            message = '네트워크 연결을 확인해주세요.';
          } else {
            message = `인증 오류: ${error.message}`;
          }
          
          setError(message);
          return;
        }

        if (!data.session) {
          setError('세션 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
          return;
        }

        // ✅ 세션 쿠키 명시적 설정 (서버에서 인식할 수 있도록)
        if (typeof document !== 'undefined') {
          // 환경변수에서 Supabase URL을 가져와서 프로젝트 ID 추출
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          let projectRef = 'jdubrjczdyqqtsppojgu'; // 기본값 (fallback)
          
          if (supabaseUrl) {
            // URL에서 프로젝트 ID 추출: https://[PROJECT_ID].supabase.co
            const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
            if (urlMatch && urlMatch[1]) {
              projectRef = urlMatch[1];
              console.log('✅ 환경변수에서 프로젝트 ID 추출:', projectRef);
            }
          }
          
          document.cookie = `sb-${projectRef}-access-token=${data.session.access_token}; path=/; max-age=86400; SameSite=Lax`;
          document.cookie = `sb-${projectRef}-refresh-token=${data.session.refresh_token}; path=/; max-age=86400; SameSite=Lax`;
          console.log('✅ 소셜 로그인 콜백: 세션 쿠키를 명시적으로 설정했습니다 (프로젝트:', projectRef + ')');
        }

        const authMode = localStorage.getItem('kakao_auth_mode') || 'login';
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error('사용자 정보 가져오기 오류:', userError);
          setError(`사용자 정보 오류: ${userError.message}`);
          return;
        }

        const userEmail = userData.user?.email;
        if (!userEmail) {
          setError('사용자 이메일 정보를 찾을 수 없습니다.');
          return;
        }

        console.log('✅ 카카오 로그인 성공:', userEmail);
        setStatusMessage(`${authMode === 'login' ? '로그인' : '회원가입'} 완료 중...`);

        if (data.session) {
          console.log('✅ 세션 확인됨, 추가 처리 시작');

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
            } else {
              const errorData = await jwtResponse.json();
              console.warn('JWT 토큰 가져오기 실패:', errorData);
            }
          } catch (jwtError: any) {
            console.error('JWT 토큰 가져오기 오류:', jwtError);
            setError(`토큰 처리 오류: ${jwtError.message}`);
            return;
          }

          await checkAuthStatus();
          toast.success('로그인 성공!');
          localStorage.removeItem('kakao_auth_mode');

          if (typeof window !== 'undefined') {
            const authEvent = new CustomEvent('auth-state-change', {
              detail: { authenticated: true },
            });
            window.dispatchEvent(authEvent);
          }

          setTimeout(() => {
            router.push('/');
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }, 100);
          }, 1000);
        } else {
          setError('로그인 세션이 생성되지 않았습니다.');
        }
      } catch (err: any) {
        console.error('인증 콜백 처리 중 오류:', err);
        
        // catch 블록 오류 케이스들
        let message = '';
        if (err.message.includes('Failed to fetch')) {
          message = `서버 연결 실패: ${err.message}`;
        } else if (err.message.includes('NetworkError')) {
          message = `네트워크 오류: ${err.message}`;
        } else if (err.message.includes('timeout')) {
          message = `요청 시간 초과: ${err.message}`;
        } else if (err.message.includes('CORS')) {
          message = `브라우저 보안 정책 오류: ${err.message}`;
        } else {
          message = `인증 처리 오류: ${err.message}`;
        }
        
        setError(message);
      }
    };

    handleAuthCallback();
  }, [router, checkAuthStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? (
        <div className="text-center p-6 bg-white rounded-lg shadow-md max-w-md mx-4">
          <h2 className="text-xl font-semibold mb-4 text-red-600">로그인 오류</h2>
          <div className="text-left bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="text-sm text-red-700 font-mono break-words">{error}</p>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            위 오류 정보를 개발자에게 전달해주세요.
          </p>
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