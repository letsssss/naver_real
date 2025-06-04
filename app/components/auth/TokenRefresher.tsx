'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

/**
 * 토큰 자동 갱신 컴포넌트
 * 클라이언트 측에서 JWT 토큰이 만료되었는지 확인하고 자동으로 갱신합니다.
 */
export default function TokenRefresher() {
  const sessionSyncRef = useRef(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 인증 상태 변경:', event, session ? '세션 있음' : '세션 없음');
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session && !sessionSyncRef.current) {
          console.log("✅ 세션 갱신됨 또는 로그인 완료", {
            userId: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
            expiresAt: new Date(session.expires_at! * 1000).toLocaleString()
          });
          
          // 중복 실행 방지
          sessionSyncRef.current = true;
          
          try {
            // 1. 기본 토큰들 저장
            localStorage.setItem('token', session.access_token);
            localStorage.setItem('auth-token', session.access_token);
            localStorage.setItem('refresh_token', session.refresh_token);
            
            sessionStorage.setItem('token', session.access_token);
            sessionStorage.setItem('auth-token', session.access_token);
            sessionStorage.setItem('refresh_token', session.refresh_token);
            
            // 2. Supabase 세션 저장
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
            
            // 3. 프로젝트별 Supabase 키에도 저장
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
            if (projectRef) {
              const supabaseKey = `sb-${projectRef}-auth-token`;
              localStorage.setItem(supabaseKey, JSON.stringify(sessionData));
              sessionStorage.setItem(supabaseKey, JSON.stringify(sessionData));
              console.log(`✅ Supabase 프로젝트 키 저장: ${supabaseKey}`);
            }
            
            // 4. 사용자 정보 저장 (카카오 로그인의 경우)
            if (session.user) {
              const userData = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || 
                      session.user.user_metadata?.full_name || 
                      session.user.user_metadata?.display_name || '',
                profileImage: session.user.user_metadata?.avatar_url || 
                            session.user.user_metadata?.picture || '',
                provider: session.user.app_metadata?.provider || 'unknown'
              };
              
              localStorage.setItem('user', JSON.stringify(userData));
              sessionStorage.setItem('user', JSON.stringify(userData));
              
              console.log('✅ 사용자 정보 저장:', {
                provider: userData.provider,
                email: userData.email,
                name: userData.name
              });
            }
            
            // 5. 인증 상태 쿠키 설정
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            document.cookie = `auth-status=authenticated; path=/; expires=${expires.toUTCString()}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
            
            console.log('🎉 TokenRefresher 세션 동기화 완료');
            
          } catch (error) {
            console.error('❌ TokenRefresher 세션 저장 실패:', error);
          } finally {
            // 동기화 완료 후 플래그 리셋 (다음 세션 변경에 대비)
            setTimeout(() => {
              sessionSyncRef.current = false;
            }, 1000);
          }
        } else if (!session) {
          console.warn("❗ TokenRefresher에서 INITIAL_SESSION 발생했지만 session은 없음");
        }
      }

      if (event === 'SIGNED_OUT') {
        console.log("🚪 로그아웃됨, 세션 제거");
        
        // localStorage에서 모든 인증 관련 키 제거
        const keysToRemove = [
          'supabase.auth.token', 'token', 'auth-token', 'user', 'refresh_token',
          'auth-status', 'supabase-auth-token', 'supabase_token'
        ];
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        });
        
        // Supabase 프로젝트 키도 제거
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
        if (projectRef) {
          const supabaseKey = `sb-${projectRef}-auth-token`;
          localStorage.removeItem(supabaseKey);
          sessionStorage.removeItem(supabaseKey);
        }
        
        // 쿠키 제거
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'auth-status=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        sessionSyncRef.current = false;
      }
      
      // 세션 상태 로깅
      const authKeys = Object.keys(localStorage).filter(k => 
        k.includes('token') || k.includes('supabase') || k.includes('auth') || k.includes('user')
      );
      console.log('현재 localStorage 인증 키:', authKeys);
    });

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
} 