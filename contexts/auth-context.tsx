"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from "sonner"
import { useRouter } from 'next/navigation'
import { supabase, supabaseService } from '@/lib/supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// 브라우저 환경인지 확인하는 헬퍼 함수
const isBrowser = () => typeof window !== 'undefined';

// 개발 환경인지 확인하는 헬퍼 함수
const isDevelopment = () => process.env.NODE_ENV === 'development';

// 쿠키 설정 헬퍼 함수
const setCookie = (name: string, value: string, maxAge: number = 30 * 24 * 60 * 60) => {
  if (isBrowser()) {
    const cookieOptions = [
      `${name}=${encodeURIComponent(value)}`,
      'path=/',
      `max-age=${maxAge}`,
      'SameSite=Lax',
      process.env.NODE_ENV === 'production' ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    document.cookie = cookieOptions;
  }
};

// 로컬 스토리지에 안전하게 저장하는 함수
const safeLocalStorageSet = (key: string, value: string) => {
  if (isBrowser()) {
    try {
      // 서버사이드 렌더링 시 오류 방지
      console.log(`${key} 저장: 길이=${value.length}`);
      
      // localStorage에 저장
      localStorage.setItem(key, value);

      // 세션 스토리지에도 백업
      sessionStorage.setItem(key, value);
      
      // 쿠키에 저장
      const maxAge = 30 * 24 * 60 * 60; // 30일
      setCookie(key, value, maxAge);
      
      // 인증 상태 쿠키 설정
      if (key === "user") {
        setCookie('auth-status', 'authenticated', maxAge);
        
        // Supabase 프로젝트 ref 가져오기
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
        if (projectRef) {
          // Supabase 인증 상태 쿠키도 설정
          setCookie(`sb-${projectRef}-auth-token-type`, 'authenticated', maxAge);
        }
      }
    } catch (e) {
      console.error("스토리지 저장 오류:", e);
    }
  }
};

// 로컬 스토리지에서 안전하게 가져오는 함수
const safeLocalStorageGet = (key: string) => {
  if (isBrowser()) {
    try {
      // 먼저 localStorage 확인
      let value = localStorage.getItem(key);
      if (value) return value;
      
      // localStorage에 없으면 cookie 확인
      const cookies = document.cookie.split('; ');
      const cookie = cookies.find(row => row.startsWith(`${key}=`));
      if (cookie) {
        const value = decodeURIComponent(cookie.split('=')[1]);
        // 찾은 값을 localStorage에도 동기화
        localStorage.setItem(key, value);
        return value;
      }
      
      return null;
    } catch (e) {
      console.error("스토리지 접근 오류:", e);
      return null;
    }
  }
  return null;
};

// 로컬 스토리지에서 안전하게 삭제하는 함수
const safeLocalStorageRemove = (key: string) => {
  if (isBrowser()) {
    try {
      localStorage.removeItem(key);
      
      // 쿠키 삭제
      document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
      
      // 인증 관련 쿠키 모두 삭제
      if (key === "user") {
        document.cookie = `auth-status=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
        
        // Supabase 인증 쿠키도 삭제
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || '';
        if (projectRef) {
          document.cookie = `sb-${projectRef}-auth-token-type=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
        }
      }
    } catch (e) {
      console.error("스토리지 삭제 오류:", e);
    }
  }
};

// 사용자 타입 정의
export type User = Database['public']['Tables']['users']['Row'];

// 컨텍스트 타입 정의
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

// 컨텍스트 생성
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 보호된 경로 목록
const PROTECTED_ROUTES = ['/chat', '/profile'];

// 전역 Supabase 클라이언트 인스턴스
let globalSupabaseClient: ReturnType<typeof supabase> | null = null;

// 스토리지에서 초기 사용자 정보 가져오기
const getInitialUser = (): User | null => {
  if (!isBrowser()) return null;
  
  try {
    // 1. sessionStorage 확인
    const sessionUser = sessionStorage.getItem("user");
    if (sessionUser) {
      return JSON.parse(sessionUser);
    }
    
    // 2. localStorage 확인
    const localUser = localStorage.getItem("user");
    if (localUser) {
      // sessionStorage에도 동기화
      sessionStorage.setItem("user", localUser);
      return JSON.parse(localUser);
    }
    
    // 3. 쿠키 확인
    const cookies = document.cookie.split('; ');
    const userCookie = cookies.find(row => row.startsWith('user='));
    if (userCookie) {
      const cookieValue = decodeURIComponent(userCookie.split('=')[1]);
      // 스토리지들에 동기화
      localStorage.setItem("user", cookieValue);
      sessionStorage.setItem("user", cookieValue);
      return JSON.parse(cookieValue);
    }
  } catch (e) {
    console.error("사용자 정보 파싱 오류:", e);
  }
  return null;
};

// 컨텍스트 프로바이더 컴포넌트
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 초기 상태를 getInitialUser()로 설정
  const [user, setUser] = useState<User | null>(() => getInitialUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  // 현재 경로가 보호된 경로인지 확인
  const checkProtectedRoute = (path: string) => {
    return PROTECTED_ROUTES.some(route => path.startsWith(route));
  };

  // 사용자 정보 새로고침
  const refreshUser = async () => {
    try {
      setLoading(true);
      setError(null);

      // 세션 새로고침
      const session = await supabaseService.refreshSession();
      
      if (session) {
        // 사용자 정보 조회
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError) throw userError;

        // 사용자 정보 저장
        setUser(userData);
        safeLocalStorageSet('user', JSON.stringify(userData));
        safeLocalStorageSet('session', JSON.stringify(session));
      } else {
        setUser(null);
        safeLocalStorageRemove('user');
        safeLocalStorageRemove('session');
      }
    } catch (error) {
      console.error('[인증] 사용자 정보 새로고침 실패:', error);
      setError(error instanceof Error ? error : new Error('사용자 정보를 새로고침할 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  // 로그인
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (session) {
        // 사용자 정보 조회
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError) throw userError;

        // 사용자 정보 저장
        setUser(userData);
        safeLocalStorageSet('user', JSON.stringify(userData));
        safeLocalStorageSet('session', JSON.stringify(session));
        
        router.replace('/');
      }
    } catch (error) {
      console.error('[인증] 로그인 실패:', error);
      setError(error instanceof Error ? error : new Error('로그인할 수 없습니다.'));
      toast.error('로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 (signOut의 별칭)
  const logout = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      safeLocalStorageRemove('user');
      safeLocalStorageRemove('session');
      
      router.replace('/');
      toast.success('로그아웃되었습니다.');
    } catch (error) {
      console.error('[인증] 로그아웃 실패:', error);
      setError(error instanceof Error ? error : new Error('로그아웃할 수 없습니다.'));
      toast.error('로그아웃에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 초기 인증 상태 확인
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true);
        
        // 1. 저장된 사용자 정보 확인
        const initialUser = getInitialUser();
        if (initialUser) {
          setUser(initialUser);
        }

        // 2. 현재 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // 세션이 있으면 사용자 정보 새로고침
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userError) throw userError;

          // 사용자 정보 업데이트 및 저장
          setUser(userData);
          safeLocalStorageSet('user', JSON.stringify(userData));
          safeLocalStorageSet('session', JSON.stringify(session));
        }

        // 3. 세션 리스너 등록
        const unsubscribe = supabaseService.onSessionChange(async ({ event, session }) => {
          console.log('[인증] 세션 변경:', event);
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            safeLocalStorageRemove('user');
            safeLocalStorageRemove('session');
            router.replace('/');
          } else if (session) {
            await refreshUser();
          }
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('[인증] 초기화 실패:', error);
        setError(error instanceof Error ? error : new Error('인증을 초기화할 수 없습니다.'));
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const value = {
    user,
    loading,
    error,
    signIn,
    signOut: logout,
    refreshUser,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 커스텀 훅
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  }
  return context;
}

