/**
 * 도메인 설정 유틸리티
 * redirectTo URL을 일관되게 관리하기 위한 설정
 */

// 프로덕션 도메인 (항상 www 포함)
const PRODUCTION_DOMAIN = 'https://www.easyticket82.com';

/**
 * 현재 환경에 맞는 기본 도메인을 반환
 * 프로덕션에서는 항상 www.easyticket82.com을 사용
 * 개발 환경에서는 동적으로 현재 호스트를 감지
 */
export function getBaseDomain(): string {
  // 프로덕션 환경이거나 배포된 환경에서는 항상 프로덕션 도메인 사용
  if (process.env.NODE_ENV === 'production' || 
      process.env.VERCEL_URL || 
      process.env.NEXT_PUBLIC_VERCEL_URL) {
    return PRODUCTION_DOMAIN;
  }
  
  // ✅ 개발 환경에서는 동적으로 현재 호스트 감지
  if (typeof window !== 'undefined') {
    // 클라이언트 사이드: 현재 브라우저의 origin 사용
    return window.location.origin;
  }
  
  // 서버 사이드: 환경변수나 기본값 사용
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // 최후의 폴백 (localhost:3000)
  return 'http://localhost:3000';
}

/**
 * redirectTo URL을 생성 (항상 올바른 도메인 사용)
 */
export function getRedirectUrl(path: string): string {
  const baseDomain = getBaseDomain();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseDomain}${cleanPath}`;
}

/**
 * 인증 콜백 URL 생성
 */
export function getAuthCallbackUrl(): string {
  return getRedirectUrl('/auth/callback');
}

/**
 * 비밀번호 재설정 URL 생성
 */
export function getResetPasswordUrl(): string {
  return getRedirectUrl('/reset-password');
}

/**
 * API 기본 URL 생성 (클라이언트 사이드에서 사용)
 */
export function getApiBaseUrl(): string {
  // 클라이언트 사이드에서는 현재 도메인 사용
  if (typeof window !== 'undefined') {
    // 프로덕션에서는 항상 www 도메인 사용
    if (window.location.hostname === 'easyticket82.com') {
      return 'https://www.easyticket82.com';
    }
    return window.location.origin;
  }
  
  // 서버 사이드에서는 환경에 따라 결정
  return getBaseDomain();
} 