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
  '/proxy-ticketing',
  '/ticket-cancellation',
  '/tickets',
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
          role: session.user.user_metadata?.role || 'USER'
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
      return true;
    }
    
    try {
      // 토큰 갱신 API 호출
      const response = await fetch('/api/auth/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        // 갱신된 세션 정보 확인
        await checkAuthStatus();
        return true;
      } else {
        // 갱신 실패 시 로그아웃
        await logout();
        return false;
      }
    } catch (error) {
      console.error('세션 갱신 오류:', error);
      await logout();
      return false;
    }
  }, [checkAuthStatus, logout]);

  // 인증이 필요한 라우트 접근 시 세션 확인
  useEffect(() => {
    // 첫 렌더링 시 인증 상태 확인
    if (loading) {
      checkAuthStatus();
    }
    
    // 보호된 라우트 목록
    const protectedRoutes = ['/proxy-ticketing', '/ticket-cancellation', '/tickets'];
    
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
      
      console.log('Supabase 인증 시작:', email);
      
      // 브라우저 클라이언트 사용 (쿠키 자동 관리)
      const browserClient = createBrowserClient();
      
      // Supabase 클라이언트를 이용한 직접 로그인
      const { data, error } = await browserClient.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      
      if (error) {
        console.error('Supabase 로그인 오류:', error.message);
        setLoading(false);
        return {
          success: false,
          message: error.message || "이메일 또는 비밀번호가 올바르지 않습니다."
        };
      }
      
      if (!data.user) {
        console.error('사용자 정보가 없습니다.');
        setLoading(false);
        return {
          success: false,
          message: "로그인은 성공했지만 사용자 정보를 찾을 수 없습니다."
        };
      }
      
      console.log('Supabase 로그인 성공:', data.user.id);
      
      // ✅ 로그인 성공 후 세션 수동 동기화
      const sessionResult = await browserClient.auth.getSession();
      console.log("✅ 로그인 직후 세션 확인:", sessionResult);
      
      // 세션 연장 및 새로고침 시도
      try {
        const { data: refreshData, error: refreshError } = await browserClient.auth.refreshSession();
        if (refreshError) {
          console.error('세션 갱신 오류:', refreshError);
        } else {
          console.log('세션 갱신 성공:', refreshData.session ? '세션 있음' : '세션 없음');
          if (refreshData.session) {
            // 갱신된 세션 정보로 업데이트
            data.session = refreshData.session;
          }
        }
      } catch (refreshError) {
        console.error('세션 갱신 중 예외 발생:', refreshError);
      }
      
      // 세션 정보 및 쿠키 로깅
      if (typeof document !== 'undefined') {
        console.log('로그인 후 브라우저 쿠키:');
        const allCookies = document.cookie.split(';').map(c => c.trim());
        console.log(`총 ${allCookies.length}개의 쿠키 발견`);
        allCookies.forEach(cookie => {
          console.log(' -', cookie);
        });
        
        // Supabase 관련 쿠키는 자동으로 설정됨 (auth-helpers에 의해)
        console.log('✅ Supabase 쿠키는 auth-helpers에 의해 자동으로 설정됩니다');
      }
      
      // 세션 정보 다시 확인
      const { data: sessionData } = await browserClient.auth.getSession();
      console.log('현재 세션 정보:', sessionData.session ? '세션 있음' : '세션 없음');
      
      if (sessionData.session) {
        console.log('세션 액세스 토큰 (처음 20자):', sessionData.session.access_token.substring(0, 20));
        console.log('세션 만료 시간:', new Date(sessionData.session.expires_at! * 1000).toLocaleString());
        
        // 액세스 토큰도 따로 저장 (API 요청에 사용 가능)
        safeLocalStorageSet("access_token", sessionData.session.access_token);
        
        // ✅ Supabase 세션 객체 저장 - 미들웨어와 함께 쿠키 자동 갱신됨
        console.log('✅ 세션 객체 확인 완료 - 쿠키는 미들웨어에 의해 관리됩니다');
      }
      
      // 사용자 정보 구성
      const userData: User = {
        id: data.user.id,
        email: data.user.email || email,
        name: data.user.user_metadata?.name || "사용자",
        role: data.user.user_metadata?.role || "USER"
      };
      
      // 사용자 정보 저장
      safeLocalStorageSet("user", JSON.stringify(userData));
      setUser(userData);
      
      // Supabase 세션 상태 다시 확인
      await checkAuthStatus();
      
      setLoading(false);
      
      // ✅ 로그인 후 페이지 새로고침 (서버가 새 세션을 인식하도록)
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          router.refresh(); // Next.js의 라우터 갱신 (캐시된 페이지 리프레시)
          console.log('✅ 세션 인식을 위해 페이지를 새로고침합니다');
        }, 500);
      }
      
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
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

