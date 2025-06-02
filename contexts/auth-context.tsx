"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from "react"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"
//import supabase from "@/lib/supabase"
import { createBrowserClient, onSessionChange } from "@/lib/supabase"

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

type User = {
  id: number | string
  email: string
  name: string
  role?: string
  createdAt?: string
  user_metadata?: {
    avatar_url?: string
    email?: string
    email_verified?: boolean
    full_name?: string
    name?: string
    provider_id?: string
    user_name?: string
  }
  app_metadata?: {
    provider?: string
    providers?: string[]
  }
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => void
  checkAuthStatus: () => Promise<boolean>
  socialLogin: (provider: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// 보호된 경로 목록
const PROTECTED_ROUTES = [
  // 실제 로그인이 필요한 경로만 남깁니다
  '/mypage',
  '/sell',
  '/cart',
  '/write-post',
  '/user-info'
];

// 전역 Supabase 클라이언트 인스턴스
let globalSupabaseClient: ReturnType<typeof createBrowserClient> | null = null;

// 스토리지에서 초기 사용자 정보 가져오기
const getInitialUser = (): User | null => {
  const storedUser = safeLocalStorageGet("user");
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch (e) {
      console.error("사용자 정보 파싱 오류:", e);
    }
  }
  return null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser());
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const sessionChecked = useRef(false);

  // 현재 경로가 보호된 경로인지 확인
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname?.startsWith(route));

  // Supabase 클라이언트 인스턴스를 useRef로 캐싱
  const supabaseClient = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  // 세션 초기화 함수
  const initializeSession = useCallback(async () => {
    try {
      const client = supabaseClient.current;
      if (!client) {
        console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
        return;
      }

      // 저장된 세션 토큰 확인
      const storedSession = localStorage.getItem('supabase.auth.token');
      if (storedSession) {
        try {
          const { access_token } = JSON.parse(storedSession);
          if (access_token) {
            // 세션 새로고침
            const { data: { session }, error } = await client.auth.getSession();
            if (session) {
              console.log('✅ 저장된 세션 복원 성공');
              const userData: User = {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.full_name || 
                      session.user.user_metadata?.name || 
                      session.user.user_metadata?.user_name || 
                      '사용자',
                role: session.user.role || 'authenticated',
                createdAt: session.user.created_at,
                user_metadata: session.user.user_metadata,
                app_metadata: session.user.app_metadata
              };
              setUser(userData);
              safeLocalStorageSet("user", JSON.stringify(userData));
            }
          }
        } catch (error) {
          console.error('세션 복원 중 오류:', error);
          localStorage.removeItem('supabase.auth.token');
        }
      }
    } catch (error) {
      console.error('세션 초기화 중 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 클라이언트 초기화 및 세션 복원
  useEffect(() => {
    if (!supabaseClient.current && typeof window !== 'undefined') {
      supabaseClient.current = createBrowserClient();
      initializeSession();
    }
  }, [initializeSession]);

  // 세션 변경 이벤트 리스너 설정
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unsubscribe = onSessionChange(async ({ event, session }) => {
      console.log('🔄 세션 변경 감지:', event);
      sessionChecked.current = true;
      
      if (event === 'SIGNED_IN' && session) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || 
                session.user.user_metadata?.name || 
                session.user.user_metadata?.user_name || 
                '사용자',
          role: session.user.role || 'authenticated',
          createdAt: session.user.created_at,
          user_metadata: session.user.user_metadata,
          app_metadata: session.user.app_metadata
        };
        
        setUser(userData);
        safeLocalStorageSet("user", JSON.stringify(userData));
        setLoading(false);
        
        // 리디렉션이 필요한 경우
        const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
        if (callbackUrl) {
          router.push(decodeURIComponent(callbackUrl));
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        safeLocalStorageRemove('user');
        localStorage.removeItem('supabase.auth.token');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 인증 실패 처리 함수
  const handleAuthFailure = useCallback(() => {
    if (!sessionChecked.current) {
      console.log('⚠️ 세션 체크가 아직 완료되지 않았습니다');
      return;
    }
    
    safeLocalStorageRemove('user');
    localStorage.removeItem('supabase.auth.token');
    setUser(null);
    setLoading(false);
    
    // 보호된 경로에서만 리디렉션
    if (isProtectedRoute) {
      console.log('보호된 경로 접근 거부:', pathname);
      const redirectUrl = `/login?callbackUrl=${encodeURIComponent(pathname || '')}`;
      router.replace(redirectUrl);
    }
  }, [isProtectedRoute, pathname, router]);

  // 인증 상태 확인 함수
  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    try {
      if (!sessionChecked.current) {
        console.log('⚠️ 세션 체크 대기 중...');
        return true; // 초기 체크는 통과
      }

      const client = supabaseClient.current;
      if (!client) {
        console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
        handleAuthFailure();
        return false;
      }
      
      // Supabase에서 현재 세션 가져오기
      const { data: { session }, error } = await client.auth.getSession();
      
      console.log("🔍 세션 확인:", session ? "세션 있음" : "세션 없음");
      
      if (error) {
        console.error('Supabase 세션 조회 오류:', error);
        handleAuthFailure();
        return false;
      }
      
      // 세션이 있으면 사용자 정보 설정
      if (session) {
        console.log("✅ 유효한 세션 발견");
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || 
                session.user.user_metadata?.name || 
                session.user.user_metadata?.user_name || 
                '사용자',
          role: session.user.role || 'authenticated',
          createdAt: session.user.created_at,
          user_metadata: session.user.user_metadata,
          app_metadata: session.user.app_metadata
        };
        
        setUser(userData);
        safeLocalStorageSet("user", JSON.stringify(userData));
        setLoading(false);
        return true;
      }
      
      console.log("❌ 유효한 세션 없음");
      handleAuthFailure();
      return false;
      
    } catch (error) {
      console.error('인증 상태 확인 오류:', error);
      handleAuthFailure();
      return false;
    }
  }, [handleAuthFailure]);

  // 탭 포커스 변경 시 인증 상태 다시 확인
  useEffect(() => {
    const handleFocus = () => {
      if (isProtectedRoute) {
        checkAuthStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkAuthStatus, isProtectedRoute]);

  // 로그아웃 함수
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // 캐싱된 클라이언트 사용
      const browserClient = supabaseClient.current;
      
      // Supabase 세션 로그아웃
      const { error } = await browserClient.auth.signOut();
      
      if (error) {
        console.error('Supabase 로그아웃 오류:', error);
      }
      
      // 로컬 스토리지 및 쿠키 정리
      safeLocalStorageRemove('token');
      safeLocalStorageRemove('user');
      
      // 쿠키 삭제는 자동으로 처리됨 (signOut 메서드에 의해)
      console.log('✅ 로그아웃 완료 - 쿠키는 auth-helpers에 의해 자동으로 삭제됩니다');
      
      // 사용자 상태 초기화
      setUser(null);
      
      // 로그인 페이지로 이동
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 처리 중 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 로그인 함수
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      console.log('🔐 로그인 시작:', email);
      
      const client = supabaseClient.current;
      if (!client) {
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
      }
      
      // Supabase를 통한 직접 로그인
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ 로그인 실패:', error);
        return {
          success: false,
          message: error.message
        };
      }
      
      if (data.session) {
        console.log('✅ Supabase 로그인 성공:', data.session.user.email);
        
        // 사용자 정보 설정
        const userData: User = {
          id: data.session.user.id,
          email: data.session.user.email || '',
          name: data.session.user.user_metadata?.full_name || 
                data.session.user.user_metadata?.name || 
                data.session.user.user_metadata?.user_name || 
                '사용자',
          role: data.session.user.role || 'authenticated',
          createdAt: data.session.user.created_at,
          user_metadata: data.session.user.user_metadata,
          app_metadata: data.session.user.app_metadata
        };
        
        // 세션 데이터 저장
        const sessionData = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          provider_token: data.session.provider_token,
          provider_refresh_token: data.session.provider_refresh_token
        };
        safeLocalStorageSet("session", JSON.stringify(sessionData));
        safeLocalStorageSet("user", JSON.stringify(userData));
        
        setUser(userData);
        return { success: true };
      }
      
      return {
        success: false,
        message: "세션이 생성되지 않았습니다."
      };
      
    } catch (error) {
      console.error("💥 로그인 오류:", error);
      return {
        success: false,
        message: "로그인 중 오류가 발생했습니다."
      };
    } finally {
      setLoading(false);
    }
  };

  // 소셜 로그인 함수 (단순화)
  const socialLogin = async (provider: string) => {
    try {
      setLoading(true);
      console.log(`${provider} 로그인 시작`);
      // 실제 로그인 처리는 KakaoLoginButton 컴포넌트에서 처리됨
    } catch (error) {
      console.error(`${provider} 로그인 오류:`, error);
      toast.error(`${provider} 로그인 중 오류가 발생했습니다.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: loading,
        login,
        logout,
        checkAuthStatus,
        socialLogin
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext);

