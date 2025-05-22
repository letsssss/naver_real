'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-login';

/**
 * 인증 상태 변경을 감지하고 디버깅하는 컴포넌트
 */
export default function AuthListener() {
  const [authState, setAuthState] = useState<{
    hasSession: boolean;
    userEmail: string | null;
    lastEvent: string | null;
  }>({
    hasSession: false, 
    userEmail: null,
    lastEvent: null
  });
  
  useEffect(() => {
    let isMounted = true;
    
    // 초기 세션 상태 확인
    const checkInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🔒 초기 세션 확인 오류:', error.message);
          return;
        }
        
        if (isMounted && data.session) {
          setAuthState({
            hasSession: true,
            userEmail: data.session.user.email,
            lastEvent: 'INITIAL_CHECK'
          });
          
          console.log('🔒 초기 세션 확인:', {
            hasSession: true,
            user: data.session.user.email,
            expiresAt: new Date(data.session.expires_at! * 1000).toLocaleString()
          });
        } else {
          console.log('🔒 초기 세션 확인: 세션 없음');
        }
      } catch (error) {
        console.error('🔒 초기 세션 확인 중 오류:', error);
      }
    };
    
    checkInitialSession();
    
    // 인증 상태 변경 리스너 설정
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(`🔒 인증 상태 변경 감지: ${event}`, session ? '세션 있음' : '세션 없음');
        
        if (isMounted) {
          setAuthState({
            hasSession: !!session,
            userEmail: session?.user.email || null,
            lastEvent: event
          });
          
          if (session) {
            console.log('🔒 세션 정보:', {
              user: session.user.email,
              provider: session.user.app_metadata.provider,
              expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
            });
          }
          
          // SIGNED_OUT 이벤트 시 추가 디버깅
          if (event === 'SIGNED_OUT') {
            console.log('🔒 로그아웃 감지됨, 브라우저 스토리지 확인');
            
            // 로컬 스토리지 확인
            if (typeof window !== 'undefined') {
              const authKeys = Object.keys(localStorage).filter(key => 
                key.includes('supabase') || key.includes('sb-') || key.includes('auth')
              );
              console.log('🔒 로그아웃 후 로컬 스토리지 키:', authKeys);
            }
            
            // 쿠키 확인 요청
            fetch('/api/auth/check')
              .then(res => res.json())
              .then(data => {
                console.log('🔒 로그아웃 후 쿠키 상태:', data);
              })
              .catch(err => {
                console.error('🔒 쿠키 확인 중 오류:', err);
              });
          }
        }
      }
    );
    
    // 60초마다 세션 상태 확인 (디버깅용)
    const intervalId = setInterval(async () => {
      if (!isMounted) return;
      
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🔒 주기적 세션 확인 오류:', error.message);
          return;
        }
        
        if (data.session) {
          const expiresAt = data.session.expires_at;
          const expiresDate = expiresAt ? new Date(expiresAt * 1000) : null;
          const now = new Date();
          const timeLeft = expiresDate ? Math.floor((expiresDate.getTime() - now.getTime()) / 1000 / 60) : null;
          
          console.log(`🔒 세션 상태 확인 (${timeLeft !== null ? `만료까지 약 ${timeLeft}분 남음` : '만료 시간 알 수 없음'})`);
          
          // 토큰 만료가 가까우면 자동 갱신
          if (timeLeft !== null && timeLeft < 30) {
            console.log('🔒 토큰 만료가 가까워 자동 갱신 시도');
            await supabase.auth.refreshSession();
          }
        } else {
          console.log('🔒 주기적 세션 확인: 세션 없음');
        }
      } catch (error) {
        console.error('🔒 주기적 세션 확인 중 오류:', error);
      }
    }, 60000);
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      subscription.unsubscribe();
    };
  }, []);
  
  // 디버깅을 위한 개발 환경에서만 보이는 상태 표시
  if (process.env.NODE_ENV !== 'production') {
    return (
      <div className="fixed bottom-0 right-0 bg-black/80 text-white p-2 text-xs rounded-tl-md z-50" style={{ maxWidth: '200px', fontSize: '10px' }}>
        <div>세션: {authState.hasSession ? '있음 ✓' : '없음 ✗'}</div>
        {authState.userEmail && <div>사용자: {authState.userEmail}</div>}
        {authState.lastEvent && <div>최근 이벤트: {authState.lastEvent}</div>}
      </div>
    );
  }
  
  // 프로덕션 환경에서는 아무것도 렌더링하지 않음
  return null;
} 