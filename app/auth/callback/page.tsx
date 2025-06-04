'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// PKCE 관련 스토리지 키
const PKCE_VERIFIER_KEY = 'supabase.auth.code_verifier';
const PKCE_VERIFIER_BACKUP_KEY = 'supabase.auth.code_verifier.backup';
const PKCE_AUTH_CODE_KEY = 'supabase.auth.code';
const PKCE_EXCHANGE_ATTEMPTED_KEY = 'supabase.auth.exchange_attempted';
const PKCE_SESSION_KEY = 'supabase.auth.session';

// 세션 저장 헬퍼 함수
const saveSessionToStorage = (session: any) => {
  try {
    console.log('💾 세션 저장 시작...', {
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      hasRefreshToken: !!session?.refresh_token,
      hasUser: !!session?.user,
      userEmail: session?.user?.email
    });
    
    if (!session) {
      console.error('❌ 세션이 null 또는 undefined입니다');
      return false;
    }
    
    if (!session.access_token) {
      console.error('❌ access_token이 없습니다:', session);
      return false;
    }
    
    // 1. 기본 토큰들 저장
    console.log('📝 1단계: 기본 토큰들 저장 중...');
    localStorage.setItem('token', session.access_token);
    localStorage.setItem('auth-token', session.access_token);
    localStorage.setItem('refresh_token', session.refresh_token);
    
    sessionStorage.setItem('token', session.access_token);
    sessionStorage.setItem('auth-token', session.access_token);
    sessionStorage.setItem('refresh_token', session.refresh_token);
    console.log('✅ 1단계 완료: 기본 토큰들 저장됨');
    
    // 2. Supabase 세션 저장
    console.log('📝 2단계: Supabase 세션 저장 중...');
    const sessionData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user
    };
    
    localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
    sessionStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
    console.log('✅ 2단계 완료: Supabase 세션 저장됨');
    
    // 3. 프로젝트별 Supabase 키에도 저장
    console.log('📝 3단계: 프로젝트별 Supabase 키 저장 중...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      const supabaseKey = `sb-${projectRef}-auth-token`;
      localStorage.setItem(supabaseKey, JSON.stringify(sessionData));
      sessionStorage.setItem(supabaseKey, JSON.stringify(sessionData));
      console.log(`✅ 3단계 완료: 프로젝트 키 저장됨 (${supabaseKey})`);
    } else {
      console.warn('⚠️ 프로젝트 ref를 찾을 수 없음:', supabaseUrl);
    }
    
    // 4. 사용자 정보 저장
    console.log('📝 4단계: 사용자 정보 저장 중...');
    if (session.user) {
      const userData = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || 
              session.user.user_metadata?.full_name || 
              session.user.user_metadata?.display_name || '',
        profileImage: session.user.user_metadata?.avatar_url || 
                    session.user.user_metadata?.picture || '',
        provider: session.user.app_metadata?.provider || 'kakao'
      };
      
      localStorage.setItem('user', JSON.stringify(userData));
      sessionStorage.setItem('user', JSON.stringify(userData));
      console.log('✅ 4단계 완료: 사용자 정보 저장됨:', userData);
    } else {
      console.warn('⚠️ 사용자 정보가 없습니다');
    }
    
    // 5. 인증 상태 쿠키 설정
    console.log('📝 5단계: 인증 상태 쿠키 설정 중...');
    const expires = new Date();
    expires.setDate(expires.getDate() + 30); // 30일 후 만료
    
    document.cookie = `auth-status=authenticated; path=/; expires=${expires.toUTCString()}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    console.log('✅ 5단계 완료: 인증 상태 쿠키 설정됨');
    
    // 6. 저장 결과 검증
    console.log('📝 6단계: 저장 결과 검증 중...');
    const verification = {
      localStorage: {
        token: !!localStorage.getItem('token'),
        user: !!localStorage.getItem('user'),
        supabaseToken: !!localStorage.getItem('supabase.auth.token')
      },
      sessionStorage: {
        token: !!sessionStorage.getItem('token'),
        user: !!sessionStorage.getItem('user'),
        supabaseToken: !!sessionStorage.getItem('supabase.auth.token')
      }
    };
    
    console.log('✅ 세션 저장 완료 및 검증:', verification);
    
    // 모든 단계가 성공했는지 확인
    const allSuccess = verification.localStorage.token && 
                      verification.localStorage.user && 
                      verification.sessionStorage.token && 
                      verification.sessionStorage.user;
    
    if (!allSuccess) {
      console.error('❌ 일부 저장이 실패했습니다:', verification);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ 세션 저장 중 오류 발생:', error);
    console.error('오류 스택:', error instanceof Error ? error.stack : 'Unknown error');
    return false;
  }
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const exchangeAttempted = useRef(false);

  // localStorage/sessionStorage 접근 권한 테스트
  useEffect(() => {
    const testStorage = () => {
      try {
        console.log('🧪 Storage 접근 권한 테스트 시작...');
        
        // localStorage 테스트
        const testKey = 'test-storage-access';
        const testValue = 'test-value-' + Date.now();
        
        localStorage.setItem(testKey, testValue);
        const retrievedValue = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        console.log('✅ localStorage 접근 가능:', {
          stored: testValue,
          retrieved: retrievedValue,
          match: testValue === retrievedValue
        });
        
        // sessionStorage 테스트
        sessionStorage.setItem(testKey, testValue);
        const retrievedSessionValue = sessionStorage.getItem(testKey);
        sessionStorage.removeItem(testKey);
        
        console.log('✅ sessionStorage 접근 가능:', {
          stored: testValue,
          retrieved: retrievedSessionValue,
          match: testValue === retrievedSessionValue
        });
        
        // 쿠키 테스트
        document.cookie = `${testKey}=${testValue}; path=/`;
        const cookieExists = document.cookie.includes(testKey);
        document.cookie = `${testKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        
        console.log('✅ 쿠키 접근 가능:', cookieExists);
        
        // 현재 저장된 인증 관련 데이터 확인
        const existingKeys = {
          localStorage: Object.keys(localStorage).filter(k => 
            k.includes('token') || k.includes('auth') || k.includes('user') || k.includes('supabase')
          ),
          sessionStorage: Object.keys(sessionStorage).filter(k => 
            k.includes('token') || k.includes('auth') || k.includes('user') || k.includes('supabase')
          )
        };
        
        console.log('📋 기존 인증 관련 키들:', existingKeys);
        
      } catch (error) {
        console.error('❌ Storage 접근 테스트 실패:', error);
      }
    };
    
    testStorage();
  }, []);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 === 카카오 로그인 콜백 처리 시작 ===');
        console.log('🔍 URL 정보:', {
          href: window.location.href,
          search: window.location.search,
          hash: window.location.hash
        });
        
        // 이미 처리 중이면 중단
        if (exchangeAttempted.current) {
          console.log('🔄 Already processing callback');
          return;
        }
        exchangeAttempted.current = true;

        // 현재 세션 확인 (약간의 지연을 두고)
        console.log('📋 1단계: 현재 세션 확인 중...');
        
        // Supabase 인증 상태가 안정화될 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ 현재 세션 확인 오류:', sessionError);
        }
        
        if (currentSession) {
          console.log('✅ 기존 활성 세션 발견:', {
            userId: currentSession.user.id,
            email: currentSession.user.email,
            expiresAt: new Date(currentSession.expires_at! * 1000).toLocaleString()
          });
          
          const saved = saveSessionToStorage(currentSession);
          if (saved) {
            console.log('🎉 기존 세션 저장 완료, 메인으로 리다이렉트');
            router.push('/');
          } else {
            console.error('❌ 기존 세션 저장 실패');
          }
          return;
        }
        
        console.log('📋 기존 세션 없음, 새로운 인증 진행');

        // URL에서 code 파라미터 추출 (더 안전한 방법 사용)
        console.log('📋 2단계: URL에서 인증 코드 추출 중...');
        const urlParams = new URLSearchParams(window.location.search);
        
        // 대안 방법으로 직접 URL에서 파싱
        const urlString = window.location.href;
        const codeMatch = urlString.match(/[?&]code=([^&]+)/);
        const errorMatch = urlString.match(/[?&]error=([^&]+)/);
        const errorDescriptionMatch = urlString.match(/[?&]error_description=([^&]+)/);
        
        const code = codeMatch ? decodeURIComponent(codeMatch[1]) : urlParams.get('code');
        const error = errorMatch ? decodeURIComponent(errorMatch[1]) : urlParams.get('error');
        const errorDescription = errorDescriptionMatch ? decodeURIComponent(errorDescriptionMatch[1]) : urlParams.get('error_description');
        
        console.log('🔍 URL 파라미터 (개선된 파싱):', {
          code: code ? `${code.substring(0, 10)}...` : null,
          error: error,
          errorDescription: errorDescription,
          urlParams: Object.fromEntries(urlParams.entries()),
          rawUrl: window.location.href
        });
        
        if (error) {
          console.error('❌ OAuth 오류 발생:', { error, errorDescription });
          router.push('/login');
          return;
        }
        
        // code verifier 가져오기 (sessionStorage와 localStorage 모두 확인)
        console.log('📋 3단계: PKCE code verifier 확인 중...');
        let verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
        console.log('🔍 sessionStorage verifier:', verifier ? `${verifier.substring(0, 10)}...` : 'null');
        
        if (!verifier) {
          verifier = localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY);
          console.log('🔍 localStorage backup verifier:', verifier ? `${verifier.substring(0, 10)}...` : 'null');
          
          if (verifier) {
            console.log('♻️ localStorage에서 verifier 복원됨');
            sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
          }
        }

        // 코드가 없거나 이미 처리된 경우 체크
        if (!code) {
          console.log('❌ URL에서 인증 코드를 찾을 수 없음. 다시 세션 확인...');
          
          // 코드가 없어도 세션이 있을 수 있으므로 한 번 더 확인
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (retrySession) {
            console.log('✅ 재시도에서 세션 발견! 저장 후 리다이렉트');
            const saved = saveSessionToStorage(retrySession);
            if (saved) {
              router.push('/');
              return;
            }
          }
          
          console.log('❌ 세션도 없고 코드도 없음, 로그인 페이지로 이동');
          router.push('/login');
          return;
        }

        // 이전 교환 시도 기록 확인
        const previousAttempt = sessionStorage.getItem(PKCE_EXCHANGE_ATTEMPTED_KEY);
        if (previousAttempt === code) {
          console.log('🔄 이미 처리된 코드입니다, 메인으로 리다이렉트');
          router.push('/');
          return;
        }

        if (!verifier) {
          console.error('❌ PKCE verifier가 누락됨:', { 
            hasCode: !!code, 
            hasVerifier: !!verifier,
            sessionVerifier: !!sessionStorage.getItem(PKCE_VERIFIER_KEY),
            localVerifier: !!localStorage.getItem(PKCE_VERIFIER_BACKUP_KEY)
          });
          
          // verifier 없어도 세션이 있을 수 있으므로 확인
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (retrySession) {
            console.log('✅ verifier 없지만 세션 발견! 저장 후 리다이렉트');
            const saved = saveSessionToStorage(retrySession);
            if (saved) {
              router.push('/');
              return;
            }
          }
          
          router.push('/login');
          return;
        }

        // 현재 교환 시도 기록
        sessionStorage.setItem(PKCE_EXCHANGE_ATTEMPTED_KEY, code);
        
        console.log('📋 4단계: PKCE 토큰 교환 시작...');
        console.log('🔑 사용할 파라미터:', {
          code: code.substring(0, 10) + '...',
          verifier: verifier.substring(0, 10) + '...'
        });

        // PKCE 토큰 교환
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('❌ 세션 교환 실패:', {
            message: exchangeError.message,
            status: exchangeError.status,
            details: exchangeError
          });
          
          // 교환 실패해도 세션이 있을 수 있으므로 확인
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          
          if (retrySession) {
            console.log('✅ 교환 실패했지만 세션 발견! 저장 후 리다이렉트');
            const saved = saveSessionToStorage(retrySession);
            if (saved) {
              router.push('/');
              return;
            }
          }
          
          // 실패한 경우에만 교환 시도 기록 제거
          sessionStorage.removeItem(PKCE_EXCHANGE_ATTEMPTED_KEY);
          router.push('/login');
          return;
        }

        console.log('✅ PKCE 토큰 교환 성공!');
        
        if (data.session) {
          console.log('📋 5단계: 세션 데이터 확인 및 저장...');
          console.log('🔍 받은 세션 정보:', {
            hasAccessToken: !!data.session.access_token,
            hasRefreshToken: !!data.session.refresh_token,
            hasUser: !!data.session.user,
            userEmail: data.session.user?.email,
            provider: data.session.user?.app_metadata?.provider,
            expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000).toLocaleString() : 'Unknown'
          });
          
          // 세션을 localStorage와 sessionStorage에 저장
          const saved = saveSessionToStorage(data.session);
          
          if (!saved) {
            console.error('❌ 세션 저장 실패 - 로그인 페이지로 리다이렉트');
            router.push('/login');
            return;
          }
          
          console.log('📋 6단계: 정리 작업 수행 중...');
          
          // 성공 후 스토리지 정리
          sessionStorage.removeItem(PKCE_VERIFIER_KEY);
          localStorage.removeItem(PKCE_VERIFIER_BACKUP_KEY);
          sessionStorage.removeItem(PKCE_AUTH_CODE_KEY);
          
          // 성공한 교환 기록
          const sessionRecord = {
            code,
            verifier,
            timestamp: Date.now(),
            success: true
          };
          sessionStorage.setItem(PKCE_SESSION_KEY, JSON.stringify(sessionRecord));
          
          console.log('🎉 === 카카오 로그인 완료! 메인 페이지로 이동합니다 ===');
          
          // 리다이렉트 전에 잠시 대기 (저장 완료 확인)
          setTimeout(() => {
            router.push('/');
          }, 500);
        } else {
          console.error('❌ 세션 데이터가 비어있음:', data);
          router.push('/login');
        }
      } catch (error) {
        console.error('❌ === 콜백 처리 중 치명적 오류 ===:', error);
        console.error('오류 스택:', error instanceof Error ? error.stack : 'Unknown error');
        sessionStorage.removeItem(PKCE_EXCHANGE_ATTEMPTED_KEY);
        router.push('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">카카오 로그인 처리 중...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="text-gray-600 mt-4">잠시만 기다려주세요...</p>
      </div>
    </div>
  );
}