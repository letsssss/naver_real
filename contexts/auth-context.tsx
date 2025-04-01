"use client"

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback, useRef } from "react"
import { toast } from "sonner"
import { usePathname, useRouter } from "next/navigation"

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
      document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      
      // auth-token과 auth-status 쿠키와 동기화 (미들웨어와 일치)
      if (key === "token") {
        // 최대한 많은 방법으로 토큰 저장
        document.cookie = `auth-token=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `auth-status=authenticated; path=/; max-age=${maxAge}; SameSite=Lax`;
        
        // 모든 경로에도 쿠키 설정 시도
        document.cookie = `auth-token=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `token=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
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
  id: number
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
      // 0. 먼저 로컬 스토리지에서 토큰과 사용자 정보 확인
      const token = safeLocalStorageGet('token');
      const storedUser = safeLocalStorageGet('user');
      
      // 실제 로그인한 사용자 정보가 있으면 먼저 사용 (카카오 로그인 등)
      // 토큰과 사용자 정보가 모두 존재하고, 테스트 토큰이 아닌 경우 우선 적용
      if (token && storedUser && token !== 'test-token-dev') {
        try {
          const parsedUser = JSON.parse(storedUser);
          // 이미 동일한 사용자 정보가 상태에 있다면 업데이트하지 않음 (무한 루프 방지)
          if (!user || user.id !== parsedUser.id) {
            console.log('실제 로그인한 사용자 정보 사용');
            setUser(parsedUser);
          }
          setLoading(false);
          return true;
        } catch (error) {
          console.error('사용자 정보 파싱 오류:', error);
        }
      }
      
      // 1. 개발 환경이면서 인증 상태가 아직 설정되지 않은 경우 (실제 로그인이 없을 때만)
      if (process.env.NODE_ENV === 'development' && !devSetupDone.current && !user) {
        console.log('개발 환경에서 테스트 사용자로 처리');
        devSetupDone.current = true; // 상태 설정 완료 표시
        
        // 테스트 사용자 데이터 (실제 환경에서는 사용되지 않음)
        const testUser: User = {
          id: 1,
          email: 'test@example.com',
          name: '테스트 사용자',
          role: 'USER'
        };
        
        // 로컬 스토리지에 테스트 토큰과 사용자 정보가 없는 경우에만 저장
        if (!token) {
          safeLocalStorageSet('token', 'test-token-dev');
        }
        
        if (!storedUser) {
          safeLocalStorageSet('user', JSON.stringify(testUser));
        }
        
        // 상태 업데이트
        setUser(testUser);
        setLoading(false);
        return true;
      }

      // 2. 로컬 스토리지에서 토큰과 사용자 정보 재확인 (여기까지 오면 테스트 토큰도 허용)
      if (token && storedUser) {
        try {
          // 사용자 정보 파싱
          const parsedUser = JSON.parse(storedUser);
          // 이미 동일한 사용자 정보가 상태에 있다면 업데이트하지 않음 (무한 루프 방지)
          if (!user || user.id !== parsedUser.id) {
            setUser(parsedUser);
          }
          setLoading(false);
          return true;
        } catch (error) {
          console.error('사용자 정보 파싱 오류:', error);
          safeLocalStorageRemove('user');
          safeLocalStorageRemove('token');
          setUser(null);
          setLoading(false);
          return false;
        }
      } else {
        // 토큰이 없으면 로그아웃 상태로 설정
        setUser(null);
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('인증 상태 확인 오류:', error);
      setUser(null);
      setLoading(false);
      return false;
    }
  }, [user]);

  // 로그아웃 함수
  const logout = useCallback(async () => {
    try {
      // 서버에 로그아웃 요청
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        console.error('로그아웃 오류:', response.statusText);
      }
    } catch (error) {
      console.error('로그아웃 요청 오류:', error);
    } finally {
      // 로컬 스토리지 및 쿠키 정리
      safeLocalStorageRemove('token');
      safeLocalStorageRemove('user');
      
      // 쿠키 삭제 (클라이언트 측)
      if (typeof document !== 'undefined') {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'auth-status=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      
      // 사용자 상태 초기화
      setUser(null);
      
      // 개발 환경 설정 상태 초기화 (다시 로그인할 때 설정되도록)
      devSetupDone.current = false;
      
      // 로그인 페이지로 이동
      router.push('/login');
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
      
      // 상대 경로 사용으로 포트 변경에 영향 받지 않음
      const timestamp = new Date().getTime(); // 캐시 방지를 위한 타임스탬프
      const response = await fetch(`/api/auth/login?t=${timestamp}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include", // 쿠키를 포함시키기 위해 필요
        cache: "no-store", // 캐시 사용 방지
      });

      // 응답이 JSON이 아닐 경우 처리
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error("JSON 파싱 오류:", jsonError);
        setLoading(false);
        return {
          success: false, 
          message: "서버 응답을 처리할 수 없습니다."
        };
      }

      // 로딩 상태 해제
      setLoading(false);

      if (!response.ok) {
        return {
          success: false,
          message: data?.error || "로그인 중 오류가 발생했습니다.",
        };
      }

      // 로그인 성공
      const userData = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || "사용자",
        role: data.user.role,
      };

      // 로컬 스토리지에 사용자 정보 저장
      safeLocalStorageSet("user", JSON.stringify(userData));
      safeLocalStorageSet("token", data.token); // 토큰 저장
      setUser(userData);
      
      // 마지막 확인 시간 업데이트
      setLoading(false);

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      setLoading(false);
      return {
        success: false,
        message: "로그인 중 오류가 발생했습니다.",
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

