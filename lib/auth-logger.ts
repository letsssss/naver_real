import { supabase } from './supabase';

/**
 * 인증 관련 이벤트를 로그로 기록하는 유틸리티 함수
 * @param type 로그 유형 (signup, login, logout, password_reset 등)
 * @param email 사용자 이메일
 * @param status 처리 상태 (success, fail)
 * @param errorMessage 실패 시 오류 메시지
 * @param ip 클라이언트 IP 주소 (옵션)
 * @param userAgent 브라우저/디바이스 정보 (옵션)
 */
export async function logAuthEvent(
  type: string, 
  email: string, 
  status: string, 
  errorMessage: string | null = null,
  ip?: string,
  userAgent?: string
) {
  try {
    const { error } = await supabase.from("auth_logs").insert({
      type,
      email,
      status,
      error_message: errorMessage,
      ip_address: ip || null,
      user_agent: userAgent || null
    });
    
    if (error) {
      console.error("인증 로그 기록 실패:", error);
    } else {
      console.log(`인증 로그 기록 성공 - ${type}:${status} (${email})`);
    }
  } catch (logError) {
    console.error("로그 기록 중 오류 발생:", logError);
  }
}

/**
 * 요청 객체에서 IP 주소를 추출하는 유틸리티 함수
 * @param request Next.js Request 객체
 * @returns IP 주소 문자열
 */
export function getClientIP(request: Request): string | null {
  // X-Forwarded-For 헤더에서 IP 확인 (프록시 뒤에 있을 경우)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // 여러 IP가 있을 경우 첫 번째(클라이언트)를 가져옴
    return forwardedFor.split(',')[0].trim();
  }
  
  // 표준 헤더에서 확인
  const remoteAddr = request.headers.get('remote-addr') || 
                     request.headers.get('x-real-ip');
  
  return remoteAddr || null;
}

/**
 * 요청 객체에서 사용자 에이전트 정보를 추출하는 유틸리티 함수
 * @param request Next.js Request 객체
 * @returns 사용자 에이전트 문자열
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent') || null;
}

/**
 * 전체 요청 정보를 사용하여 인증 이벤트를 로깅하는 통합 함수
 * @param request Next.js Request 객체
 * @param type 로그 유형
 * @param email 사용자 이메일
 * @param status 처리 상태
 * @param errorMessage 실패 시 오류 메시지
 */
export async function logAuthEventWithRequest(
  request: Request,
  type: string,
  email: string,
  status: string,
  errorMessage: string | null = null
) {
  const ip = getClientIP(request);
  const userAgent = getUserAgent(request);
  
  await logAuthEvent(type, email, status, errorMessage, ip, userAgent);
} 