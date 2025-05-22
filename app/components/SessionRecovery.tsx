'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-login';

/**
 * SessionRecovery 컴포넌트
 * URL 파라미터에서 세션 토큰을 추출하여 세션을 복원합니다.
 */
export default function SessionRecovery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    const recoverSession = async () => {
      // URL에 토큰이 있으면 세션 복원 시도
      if (accessToken && refreshToken) {
        try {
          console.log('🔄 URL 파라미터에서 세션 토큰 발견, 세션 복원 시도 중...');
          
          // 토큰으로 세션 설정
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('세션 복원 실패:', error.message);
          } else if (data.session) {
            console.log('✅ 세션 복원 성공:', data.session.user.email);
            
            // 현재 URL에서 토큰 파라미터 제거
            const url = new URL(window.location.href);
            url.searchParams.delete('access_token');
            url.searchParams.delete('refresh_token');
            
            // 토큰이 제거된 URL로 replace (브라우저 히스토리에 남지 않도록)
            router.replace(url.pathname);
          }
        } catch (err) {
          console.error('세션 복원 중 오류:', err);
        }
      }
    };
    
    recoverSession();
  }, [searchParams, router]);
  
  return null;
} 