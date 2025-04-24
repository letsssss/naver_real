/**
 * 클라이언트 측 인증 유틸리티
 * /api/auth/me API를 사용하여 인증 상태를 확인하고 사용자 정보를 가져옵니다.
 */

// 사용자 정보 타입
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  [key: string]: any;
}

// 인증 상태 타입
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

// 사용자 정보 캐싱 (5분)
let userCache: { user: User | null; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 현재 로그인한 사용자 정보를 가져옵니다.
 * 캐싱을 사용하여 불필요한 API 호출을 줄입니다.
 */
export async function getCurrentUser(): Promise<User | null> {
  // 캐시 확인
  if (userCache && Date.now() - userCache.timestamp < CACHE_TTL) {
    return userCache.user;
  }

  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 401) {
      userCache = { user: null, timestamp: Date.now() };
      return null;
    }

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const data = await response.json();
    userCache = { user: data.user, timestamp: Date.now() };
    return data.user;
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    return null;
  }
}

/**
 * 인증 상태를 확인하고 필요한 경우 로그인 페이지로 리디렉션합니다.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  
  if (!user) {
    // 로그인 페이지로 리디렉션
    window.location.href = '/login';
    throw new Error('인증이 필요합니다.');
  }
  
  return user;
}

/**
 * 인증된 사용자 ID로 API를 호출하는 유틸리티 함수
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('인증이 필요합니다.');
  }
  
  // URL에 userId 파라미터 추가
  const urlWithUserId = new URL(url, window.location.origin);
  urlWithUserId.searchParams.append('userId', user.id);
  
  return fetch(urlWithUserId.toString(), {
    ...options,
    credentials: 'include',
  });
}

/**
 * 구매 목록을 가져오는 함수
 */
export async function fetchPurchases(): Promise<any> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('인증이 필요합니다.');
  }
  
  const response = await fetch(`/api/purchase?userId=${user.id}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`구매 목록 조회 오류: ${response.status}`);
  }
  
  return response.json();
} 