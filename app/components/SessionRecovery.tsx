'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-login';
import { recoverSession } from '@/lib/supabase-client';

/**
 * SessionRecovery 컴포넌트
 * URL 파라미터, 로컬 스토리지, 쿠키 등 다양한 소스에서 세션 토큰을 추출하여 세션을 복원합니다.
 */
export default function SessionRecovery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  
  useEffect(() => {
    const attemptSessionRecovery = async () => {
      if (recoveryAttempted) return;
      
      console.log('🔄 세션 복원 시도 중...');
      setRecoveryAttempted(true);
      
      try {
        // 1. URL 파라미터에서 세션 토큰 확인
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('🔑 URL 파라미터에서 세션 토큰 발견, 복원 시도 중...');
          
          try {
            // 토큰으로 세션 설정
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('❌ URL 토큰으로 세션 복원 실패:', error.message);
            } else if (data.session) {
              console.log('✅ URL 토큰으로 세션 복원 성공:', data.session.user.email);
              
              // 현재 URL에서 토큰 파라미터 제거
              const url = new URL(window.location.href);
              url.searchParams.delete('access_token');
              url.searchParams.delete('refresh_token');
              
              // 토큰이 제거된 URL로 replace (브라우저 히스토리에 남지 않도록)
              router.replace(url.pathname + url.search);
              return; // 성공적으로 복원했으므로 종료
            }
          } catch (err) {
            console.error('❌ URL 토큰으로 세션 복원 중 오류:', err);
          }
        }
        
        // 2. lib/supabase-client.ts의 전체 복원 로직 사용
        const recovered = await recoverSession();
        
        if (recovered) {
          console.log('✅ 세션이 성공적으로 복원되었습니다.');
          
          // 현재 페이지가 로그인 페이지라면 홈으로 리다이렉트
          if (window.location.pathname.includes('/login')) {
            router.replace('/');
          }
          return;
        }
        
        // 3. 현재 세션 상태 확인
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session) {
          console.log('✅ 기존 세션 감지됨:', sessionData.session.user.email);
          
          // 현재 페이지가 로그인 페이지라면 홈으로 리다이렉트
          if (window.location.pathname.includes('/login')) {
            router.replace('/');
          }
        } else {
          console.log('ℹ️ 유효한 세션이 없습니다. 로그인이 필요할 수 있습니다.');
          
          // 쿠키 상태 확인
          try {
            const response = await fetch('/api/auth/check');
            const cookieData = await response.json();
            console.log('🍪 쿠키 상태:', cookieData);
            
            // 로컬 스토리지 확인
            if (typeof localStorage !== 'undefined') {
              const authKeys = Object.keys(localStorage).filter(k => 
                k.includes('supabase') || k.includes('sb-') || k.includes('auth')
              );
              console.log('🗄️ 로컬 스토리지 인증 키:', authKeys);
            }
          } catch (err) {
            console.error('❌ 세션 상태 확인 중 오류:', err);
          }
        }
      } catch (error) {
        console.error('❌ 세션 복원 프로세스 중 예외 발생:', error);
      }
    };
    
    attemptSessionRecovery();
    
    // 페이지 로드 후 약간의 지연을 두고 다시 한번 확인 (URL 파라미터가 늦게 적용되는 경우를 대비)
    const delayedCheck = setTimeout(() => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      
      if (accessToken && refreshToken) {
        console.log('🔄 지연된 세션 복원 시도 (URL 파라미터 감지됨)');
        attemptSessionRecovery();
      }
    }, 500);
    
    return () => clearTimeout(delayedCheck);
  }, [searchParams, router, recoveryAttempted]);
  
  return null;
} 