'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

/**
 * 토큰 자동 갱신 컴포넌트
 * 클라이언트 측에서 JWT 토큰이 만료되었는지 확인하고 자동으로 갱신합니다.
 */
export default function TokenRefresher() {
  const [status, setStatus] = useState<'checking' | 'refreshed' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const supabase = createBrowserClient();
        
        // 현재 세션 확인
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData.session) {
          console.log('토큰 갱신: 세션이 없습니다. 로그인이 필요합니다.');
          setStatus('error');
          setErrorMessage('세션이 없습니다. 로그인이 필요합니다.');
          return;
        }
        
        // 세션 만료 시간 확인
        const expiresAt = sessionData.session.expires_at;
        const nowInSeconds = Math.floor(Date.now() / 1000);
        
        // 만료 시간이 10분 이내이거나 이미 만료된 경우 갱신
        if (!expiresAt || expiresAt - nowInSeconds < 600) {
          console.log('토큰 갱신: 세션이 만료되었거나 곧 만료됩니다. 갱신을 시도합니다.');
          
          // 세션 갱신
          const { data, error } = await supabase.auth.refreshSession();
          
          if (error) {
            console.error('토큰 갱신 실패:', error.message);
            setStatus('error');
            setErrorMessage(error.message);
            return;
          }
          
          console.log('토큰 갱신 성공:', !!data.session);
          setStatus('refreshed');
        } else {
          console.log(`토큰 갱신: 세션이 유효합니다. ${expiresAt - nowInSeconds}초 남았습니다.`);
          setStatus('refreshed');
        }
      } catch (error: any) {
        console.error('토큰 갱신 중 오류 발생:', error?.message || '알 수 없는 오류');
        setStatus('error');
        setErrorMessage(error?.message || '알 수 없는 오류');
      }
    };

    refreshToken();
    
    // 5분마다 토큰 갱신 상태 확인
    const interval = setInterval(refreshToken, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 상태에 따라 개발 모드에서만 표시되는 디버그 정보
  if (process.env.NODE_ENV === 'development') {
    return (
      <div style={{ display: 'none' }}>
        {status === 'checking' && '토큰 확인 중...'}
        {status === 'refreshed' && '토큰 새로고침 완료'}
        {status === 'error' && `토큰 오류: ${errorMessage}`}
      </div>
    );
  }
  
  // 프로덕션에서는 아무것도 렌더링하지 않음
  return null;
} 