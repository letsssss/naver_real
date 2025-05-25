"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from "react"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"
import supabase from "@/lib/supabase"
import { createBrowserClient } from "@/lib/supabase"

// 브라우저 환경인지 확인하는 헬퍼 함수
const isBrowser = () => typeof window !== 'undefined';

// 개발 환경인지 확인하는 헬퍼 함수
const isDevelopment = () => process.env.NODE_ENV === 'development';

// 로컬 스토리지에 안전하게 저장하는 함수
const safeLocalStorageSet = (key: string, value: string) => {
  if (isBrowser()) {
    try {
      // 서버사이드 렌더링 시 오류 방지
      console.log(`${key} 저장: 길이=${value.length}`);
      
      // 중요: localStorage에 먼저 저장 (주요 저장소)
      localStorage.setItem(key, value);
      
      // 세션 스토리지에도 백업
      sessionStorage.setItem(key, value);
      
      // 쿠키에도 저장 (httpOnly 아님)
      const maxAge = 30 * 24 * 60 * 60; // 30일 (초 단위)
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=None; Secure`;
      
      // auth-token과 auth-status 쿠키와 동기화 (미들웨어와 일치)
      if (key === "token") {
        // 최대한 많은 방법으로 토큰 저장
        document.cookie = `auth-token=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=None; Secure`;
        document.cookie = `auth-status=authenticated; path=/; max-age=${maxAge}; SameSite=None; Secure`;
        
        // 모든 경로에도 쿠키 설정 시도
        document.cookie = `auth-token=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=None; Secure`;
        document.cookie = `token=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=None; Secure`;
      }
    } catch (e) {
      console.error("로컬 스토리지 저장 오류:", e);
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
      
      // localStorage에 없으면 sessionStorage 확인
      value = sessionStorage.getItem(key);
      if (value) return value;
      
      // sessionStorage에도 없으면 cookie 확인
      const cookies = document.cookie.split('; ');
      const cookie = cookies.find(row => row.startsWith(`${key}=`));
      if (cookie) {
        return decodeURIComponent(cookie.split('=')[1]);
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
      sessionStorage.removeItem(key);
      
      // 일반 쿠키 삭제
      document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      
      // 인증 관련 쿠키 모두 삭제 (미들웨어 사용 쿠키 포함)
      if (key === "token" || key === "user") {
        document.cookie = `auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `auth-status=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        document.cookie = `supabase-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // 개발 환경 인증 상태 설정 시 사용할 참조 - 상태 설정 여부 추적
  const devSetupDone = useRef(false);

  // 인증 상태 확인 함수
  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    try {
      // 새로운 브라우저 클라이언트 생성 (쿠키 자동 처리)
      const browserClient = createBrowserClient();
      
      // Supabase에서 현재 세션 가져오기
      const { data: { session }, error } = await browserClient.auth.getSession();
      
      console.log("🧪 getSession 결과:", session, error);
      
      if (error) {
        console.error('Supabase 세션 조회 오류:', error);
        setUser(null);
        setLoading(false);
        return false;
      }
      
      // 세션이 있으면 사용자 정보 설정
      if (session) {
        const userData: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || '사용자',
          role: session.user.user_metadata?.role || 'USER',
          createdAt: session.user.created_at || session.user.user_metadata?.createdAt || new Date().toISOString()
        };
        
        // 사용자 정보 저장
        safeLocalStorageSet("user", JSON.stringify(userData));
        setUser(userData);
        
        // ✅ 자동 쿠키 설정이 이루어졌다는 로그 추가
        console.log('✅ 인증 세션 확인 완료 - 쿠키는 미들웨어와 브라우저 클라이언트에 의해 자동으로 관리됩니다');
        
        setLoading(false);
        return true;
      }
      
      // 로컬 스토리지에서 사용자 정보 확인 (세션이 없는 경우)
      const storedUser = safeLocalStorageGet('user');
      
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setLoading(false);
          return true;
        } catch (error) {
          console.error('사용자 정보 파싱 오류:', error);
          safeLocalStorageRemove('user');
        }
      }
      
      // 인증된 사용자가 없음
      setUser(null);
      setLoading(false);
      return false;
    } catch (error) {
      console.error('인증 상태 확인 오류:', error);
      setUser(null);
      setLoading(false);
      return false;
    }
  }, []);

  // 로그아웃 함수
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // 쿠키 관리를 위해 브라우저 클라이언트 사용
      const browserClient = createBrowserClient();
      
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
      
      // 개발 환경 설정 상태 초기화 (다시 로그인할 때 설정되도록)
      devSetupDone.current = false;
      
      // 로그인 페이지로 이동
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 처리 중 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 세션 갱신 함수
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (process.env.NODE_ENV === 'development') {
      // 개발 환경에서는 세션 갱신 로직 건너뛰기
      console.log("개발 환경: 세션 갱신 건너뛰기");
      return true;
    }
    
    try {
      console.log("세션 갱신 시도...");
      // 토큰 갱신 API 호출
      const response = await fetch('/api/auth/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        console.log("세션 갱신 성공");
        // 갱신된 세션 정보 확인
        await checkAuthStatus();
        return true;
      } else {
        // 갱신 실패 시에도 로그아웃하지 않음
        console.warn("❗ 세션 갱신 실패 - 상태 코드:", response.status);
        const errorData = await response.json().catch(() => ({}));
        console.warn("❗ 세션 갱신 실패 - 응답 데이터:", errorData);
        return false;
      }
    } catch (error) {
      console.error('세션 갱신 중 오류 발생:', error);
      return false;
    }
  }, [checkAuthStatus]);

  // 인증이 필요한 라우트 접근 시 세션 확인
  useEffect(() => {
    // 첫 렌더링 시 인증 상태 확인
    if (loading) {
      checkAuthStatus();
    }
    
    // 보호된 라우트 목록 - PROTECTED_ROUTES 상수 사용
    const protectedRoutes = PROTECTED_ROUTES;
    
    // 현재 경로가 보호된 라우트인 경우 세션 확인
    if (protectedRoutes.some(route => pathname?.startsWith(route))) {
      // 개발 환경에서는 항상 인증 상태로 처리
      if (process.env.NODE_ENV === 'development') {
        if (!devSetupDone.current) {
          checkAuthStatus();
        }
        return;
      }
      
      // 프로덕션 환경에서는 세션 갱신 시도
      refreshSession();
    }
  }, [pathname, checkAuthStatus, refreshSession, loading]);

  // 로그인 함수
  const login = async (email: string, password: string) => {
    try {
      // 로딩 상태 설정
      setLoading(true);
      
      console.log('🔐 로그인 시작:', email);
      
      // ✅ 서버 API를 통한 로그인 (통일된 쿠키 설정)
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // 쿠키 포함
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('❌ 로그인 실패:', result.error);
        setLoading(false);
        return {
          success: false,
          message: result.error || "로그인에 실패했습니다."
        };
      }
      
      console.log('✅ 서버 로그인 성공:', result.user.email);
      
      // ✅ 브라우저 클라이언트로 세션 확인
      const browserClient = createBrowserClient();
      const { data: sessionData } = await browserClient.auth.getSession();
      
      if (sessionData.session) {
        console.log('✅ Supabase 세션 확인됨:', sessionData.session.user.email);
        
        // 로컬 스토리지에 토큰 저장 (API 요청용)
        safeLocalStorageSet("token", result.token);
        safeLocalStorageSet("access_token", sessionData.session.access_token);
        safeLocalStorageSet("supabase_token", sessionData.session.access_token);
        
        console.log('💾 토큰 저장 완료');
      } else {
        console.warn('⚠️ Supabase 세션이 없습니다. 쿠키 확인 필요');
      }
      
      // 사용자 정보 구성 (서버 응답 우선)
      const userData: User = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name || "사용자",
        role: result.user.role || "USER",
        createdAt: new Date().toISOString()
      };
      
      // 사용자 정보 저장
      safeLocalStorageSet("user", JSON.stringify(userData));
      setUser(userData);
      
      // 쿠키 확인 로깅
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').map(c => c.trim());
        console.log('🍪 로그인 후 쿠키 목록:');
        cookies.forEach(cookie => {
          if (cookie.includes('auth') || cookie.includes('sb-')) {
            console.log(' -', cookie.substring(0, 50) + '...');
          }
        });
      }
      
      setLoading(false);
      
      // ✅ 페이지 새로고침으로 미들웨어가 새 세션을 인식하도록 함
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          router.refresh();
          console.log('🔄 미들웨어 세션 인식을 위해 페이지 새로고침');
        }, 500);
      }
      
      return { success: true };
      
    } catch (error) {
      console.error("💥 로그인 오류:", error);
      setLoading(false);
      return {
        success: false,
        message: "로그인 중 오류가 발생했습니다."
      };
    }
  };

  // 소셜 로그인 함수 수정 (카카오 로그인 처리)
  const socialLogin = async (provider: string) => {
    try {
      setLoading(true);
      console.log(`${provider} 로그인 시작`);
      
      // 소셜 로그인 성공 시 개발 환경 설정 리셋
      // 이로써 실제 로그인이 테스트 사용자로 덮어쓰여지는 것을 방지
      devSetupDone.current = false;
      
      // 실제 로그인 처리는 KakaoLoginButton 컴포넌트에서 직접 처리됨
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

// 커스텀 훅으로 AuthContext 사용하기 쉽게 만들기
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

