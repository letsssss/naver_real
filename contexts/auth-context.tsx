"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from "sonner"
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { User } from '@supabase/supabase-js'

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
      // 스토리지 저장 오류 처리
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
      // 스토리지 접근 오류 처리
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
      // 스토리지 삭제 오류 처리
    }
  }
};

// 사용자 타입 정의
export interface UserInfo {
  id: string;
  email: string | null;
  name: string;
  profile_image: string | null;
  created_at: string;
  updated_at: string;
  role?: string;
}

// 컨텍스트 타입 정의
interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, name: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// 컨텍스트 생성
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 보호된 경로 목록
const PROTECTED_ROUTES = ['/chat', '/profile'];

// 전역 Supabase 클라이언트 인스턴스
let globalSupabaseClient: any = null;

// 스토리지에서 초기 사용자 정보 가져오기
const getInitialUser = (): UserInfo | null => {
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
    // 사용자 정보 파싱 오류 처리
  }
  return null;
};

// 기본 사용자 정보 생성 함수
function createDefaultUserInfo(authUser: User): UserInfo {
  return {
    id: authUser.id,
    email: authUser.email || null,
    name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || '사용자',
    profile_image: authUser.user_metadata?.profile_image || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
    created_at: authUser.created_at,
    updated_at: authUser.updated_at || authUser.created_at,
    role: 'USER'
  }
}

// users 테이블에 사용자 생성하는 함수
async function ensureUserInDatabase(authUser: User) {
  try {
    const supabase = await getSupabaseClient();
    
    // 1. 먼저 users 테이블에 해당 사용자가 있는지 확인
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116은 "no rows found" 에러 (정상)
      console.error('❌ 사용자 확인 중 오류:', selectError);
      return;
    }

    // 2. 사용자가 없으면 생성
    if (!existingUser) {
      const newUser = {
        id: authUser.id,
        email: authUser.email || null,
        name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || '사용자',
        profile_image: authUser.user_metadata?.profile_image || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
        role: 'USER',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('users')
        .insert([newUser]);

      if (insertError) {
        console.error('❌ users 테이블 삽입 오류:', insertError);
      } else {
        console.log('✅ users 테이블에 새 사용자 생성:', authUser.id);
      }
    } else {
      console.log('✅ 사용자가 이미 users 테이블에 존재:', authUser.id);
    }
  } catch (error) {
    console.error('❌ users 테이블 처리 중 오류:', error);
  }
}

// 컨텍스트 프로바이더 컴포넌트
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => getInitialUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  // 현재 경로가 보호된 경로인지 확인
  const checkProtectedRoute = (path: string) => {
    return PROTECTED_ROUTES.some(route => path.startsWith(route));
  };

  // 사용자 정보 새로고침
  const refreshUser = useCallback(async () => {
    try {
      const supabase = await getSupabaseClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.user) {
        setUser(null);
        return;
      }

      // 기본 사용자 정보로 설정
      const userInfo = createDefaultUserInfo(session.user);
      setUser(userInfo);
    } catch (error) {
      setUser(null);
    }
  }, []);

  // 로그인
  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return false;
      }

      const userInfo = createDefaultUserInfo(data.user);
      setUser(userInfo);
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // 회원가입
  const signUp = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            full_name: name
          }
        }
      });

      if (error || !data.user) {
        return false;
      }

      // 회원가입 후 이메일 확인 필요한 경우
      if (!data.session) {
        return true; // 이메일 확인 대기 상태
      }

      const userInfo = createDefaultUserInfo(data.user);
      setUser(userInfo);
      return true;
    } catch (error) {
      return false;
    }
  }, []);

  // 로그아웃
  const signOut = useCallback(async () => {
    try {
      const supabase = await getSupabaseClient();
      await supabase.auth.signOut();
      setUser(null);
      router.push('/login');
    } catch (error) {
      // 로그아웃 오류 처리
    }
  }, [router]);

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
        const supabase = await getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // users 테이블에 사용자 정보 확인/생성
          await ensureUserInDatabase(session.user);
          
          // users 테이블 조회 건너뛰고 바로 기본 사용자 정보 생성
          const defaultUser: UserInfo = {
            id: session.user.id,
            email: session.user.email || null,
            name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || '사용자',
            profile_image: session.user.user_metadata?.profile_image || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: session.user.updated_at || session.user.created_at || new Date().toISOString(),
            role: 'USER'
          };
          
          setUser(defaultUser);
          safeLocalStorageSet('user', JSON.stringify(defaultUser));
        }

        // 3. 세션 리스너 등록
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            safeLocalStorageRemove('user');
          } else if (event === 'SIGNED_IN' && session) {
            // 🔥 로그인 시 users 테이블에 사용자 생성/확인
            await ensureUserInDatabase(session.user);
            
            const userInfo = createDefaultUserInfo(session.user);
            setUser(userInfo);
            safeLocalStorageSet('user', JSON.stringify(userInfo));
          }
        });

        return () => {
          subscription?.unsubscribe();
        };
      } catch (error) {
        // 인증 초기화 실패 처리
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [refreshUser]);

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 커스텀 훅
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

