import { compare, hash } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import * as jsonwebtoken from 'jsonwebtoken';
import supabase from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { jwtVerify, createRemoteJWKSet } from 'jose';
// @ts-ignore - 타입 에러 무시 (런타임에는 정상 작동)
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Database } from '@/types/supabase.types';
import { createClient } from '@supabase/supabase-js';

// 세션에 id 필드를 추가하기 위한 타입 확장
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
  
  interface JWT {
    id: string;
  }
}

// 개발 환경인지 확인하는 함수
export const isDevelopment = process.env.NODE_ENV === 'development';

// 환경 변수에서 JWT 시크릿 키 가져오기 (폴백으로 하드코딩된 값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'supabase-jwt-secret-key-for-development';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'supabase-refresh-secret-key-for-development';

// 디버깅을 위한 로그 추가
console.log('===== JWT ENV DEBUG =====');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('isDevelopment:', isDevelopment);
console.log('JWT_SECRET 설정:', !!JWT_SECRET);
console.log('JWT_SECRET 길이:', JWT_SECRET.length);
console.log('JWT_SECRET 출처:', process.env.JWT_SECRET ? '환경 변수' : '하드코딩된 값');
console.log('=========================');

// Supabase 프로젝트 ID 정의 (환경변수에서 가져오거나 하드코딩)
const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID || 'jdubrjczdyqqtsppojgu';
// Supabase의 기본 issuer 설정
const DEFAULT_SUPABASE_ISSUER = `https://${SUPABASE_PROJECT_ID}.supabase.co/auth/v1`;

// 개발 환경에서도 실제 토큰 검증 시도
// const DEFAULT_TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000'; // UUID 형식으로 변경 - 주석 처리

// NextAuth 옵션 설정
export const authOptions: NextAuthOptions = {
  providers: [],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  secret: JWT_SECRET,
  callbacks: {
    async session({ session, token }) {
      if (token && token.sub) {
        session.user = {
          ...session.user,
          id: token.sub
        };
      }
      return session;
    },
  },
};

// 사용자 비밀번호를 해싱합니다.
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

// 해싱된 비밀번호와 일반 텍스트 비밀번호를 비교합니다.
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(plainPassword, hashedPassword);
}

// JWT 액세스 토큰 생성
export function generateAccessToken(userId: number, email: string, role: string): string {
  return jsonwebtoken.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '24h' } // 24시간으로 연장
  );
}

// JWT 리프레시 토큰 생성
export function generateRefreshToken(userId: number): string {
  return jsonwebtoken.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: '30d' } // 30일로 연장
  );
}

// 유효한 JWT 포맷 확인 (기본 검증)
function isValidJwtFormat(token: string): boolean {
  // JWT는 header.payload.signature 형식이어야 함
  const tokenParts = token.split('.');
  return tokenParts.length === 3;
}

/**
 * JWT 토큰 검증 함수
 * @param token JWT 토큰
 * @returns 디코딩된 페이로드 (userId 포함)
 */
export async function verifyToken(token: string): Promise<any> {
  if (!token) {
    throw new Error('토큰이 제공되지 않았습니다.');
  }

  if (!isValidJwtFormat(token)) {
    throw new Error('유효하지 않은 토큰 형식입니다.');
  }

  try {
    // 1. Supabase JWT 검증 시도
    try {
      const { data, error } = await supabase.auth.getUser(token);
      
      if (!error && data.user) {
        return {
          userId: data.user.id,
          email: data.user.email,
          source: 'supabase'
        };
      }
    } catch (supabaseError) {
      console.warn('Supabase 토큰 검증 실패:', supabaseError);
    }

    // 2. 커스텀 JWT 검증
    // JWT 서명 키 설정
    const secret = process.env.JWT_SECRET || JWT_SECRET; // 환경변수 없으면 기본값 사용
    
    // 개발 환경에서도 JWT 검증 시도
    if (isDevelopment && !secret) {
      console.log('개발 환경에서 기본 JWT_SECRET 사용');
      
      // 개발 환경에서 Supabase 세션 확인
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session && session.user) {
          console.log('개발 환경: Supabase 세션에서 실제 사용자 ID 사용');
          return {
            userId: session.user.id,
            email: session.user.email,
            source: 'dev-session'
          };
        }
      } catch (sessionError) {
        console.error('개발 환경: 세션 확인 오류', sessionError);
      }
      
      // 세션이 없는 경우 인증 실패
      throw new Error('개발 환경: 로그인된 세션을 찾을 수 없습니다');
    }
    
    // 프로덕션 환경에서만 오류 발생
    if (!isDevelopment && !secret) {
      throw new Error('환경 변수에 JWT_SECRET이 설정되지 않았습니다.');
    }

    // JWKS 엔드포인트가 있는 경우 원격 키 사용
    const jwksUrl = process.env.JWKS_ENDPOINT;
    
    if (jwksUrl) {
      // 원격 JWKS 사용
      const JWKS = createRemoteJWKSet(new URL(jwksUrl));
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: process.env.JWT_ISSUER || DEFAULT_SUPABASE_ISSUER,
        // audience는 필요한 경우에만 설정
        ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {})
      });
      
      return payload;
    } else {
      // 로컬 텍스트 인코딩 비밀키 사용
      const textEncoder = new TextEncoder();
      const secretBuffer = textEncoder.encode(secret);
      
      const { payload } = await jwtVerify(token, secretBuffer, {
        issuer: process.env.JWT_ISSUER || DEFAULT_SUPABASE_ISSUER,
        // audience는 필요한 경우에만 설정
        ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {})
      });
      
      return payload;
    }
  } catch (error) {
    console.error('토큰 검증 중 오류:', error);
    throw new Error(`토큰 검증 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

// JWT 토큰 유효성 검증
export function verifyAccessToken(token: string) {
  try {
    console.log("JWT 토큰 검증 시도");
    
    // 개발 환경에서도 실제 토큰 검증 시도
    const decoded = jsonwebtoken.verify(token, JWT_SECRET);
    console.log("JWT 토큰 검증 성공", decoded);
    return decoded;
  } catch (error) {
    console.error("JWT 토큰 처리 중 오류:", error);
    // 개발 환경에서 토큰 검증에 실패해도 null을 반환하도록 수정
    return null;
  }
}

// 리프레시 토큰 유효성 검증
export function verifyRefreshToken(token: string) {
  try {
    return jsonwebtoken.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * 요청 헤더에서 인증 토큰을 가져오는 함수
 * @param headers 헤더 객체
 * @returns 추출된 토큰 또는 null
 */
export function getTokenFromHeaders(headers: Headers): string | null {
  const authHeader = headers.get('Authorization');
  
  if (!authHeader) return null;
  
  // Bearer 토큰 추출
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * 쿠키에서 액세스 토큰을 추출합니다.
 * NextRequest 또는 Request 객체 모두 지원
 * @param req 요청 객체
 * @returns 추출된 토큰 또는 null
 */
export function getTokenFromCookies(req: Request | NextRequest): string | null {
  // NextRequest 객체인 경우
  if ('cookies' in req && typeof req.cookies === 'object' && req.cookies.get) {
    const tokenCookie = req.cookies.get('access_token')?.value ||
                        req.cookies.get('sb-access-token')?.value ||
                        req.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token')?.value || // ✅ 추가
                        req.cookies.get(`sb-${process.env.SUPABASE_PROJECT_ID}-auth-token`)?.value;

    return tokenCookie || null;
  }

  // 일반 Request 객체의 경우
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = decodeURIComponent(value || '');
    return acc;
  }, {} as Record<string, string>);

  return (
    cookies['access_token'] ||
    cookies['sb-access-token'] ||
    cookies['sb-jdubrjczdyqqtsppojgu-auth-token'] || // ✅ 여기도 반드시 포함
    cookies[`sb-${process.env.SUPABASE_PROJECT_ID}-auth-token`] ||
    null
  );
}

// 디버그용 로그는 주석 처리
// console.log('===== Supabase 인증 헬퍼 디버깅 =====');
// console.log('@supabase/auth-helpers-nextjs에서 사용 가능한 내보내기:', Object.keys(require('@supabase/auth-helpers-nextjs')));
// console.log('cookies 타입:', typeof cookies, cookies);
// console.log('==================================');

// 기존 getAuthenticatedUser 함수를 새로운 버전으로 교체
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    // 1. 요청에서 직접 토큰 추출
    const token = getTokenFromHeaders(request.headers) || getTokenFromCookies(request);
    
    if (!token) {
      console.log("❌ 인증 토큰을 찾을 수 없습니다");
      return null;
    }
    
    // 2. 기존 Supabase 클라이언트에 토큰 직접 전달
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error("❌ 사용자 인증 실패:", error.message);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error("❌ 인증 처리 중 오류 발생:", error);
    return null;
  }
}

/**
 * 요청에서 인증된 사용자 정보를 가져오는 함수 (Supabase 버전)
 * @param request Next.js 요청 객체
 * @returns 인증된 사용자 객체 또는 null
 */
export async function validateRequestToken(req: Request | NextRequest): Promise<{ userId: string; authenticated: boolean; message?: string }> {
  console.log(`[인증] 요청 검증 시작`);
  
  try {
    // 토큰 가져오기
    const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
    console.log(`[인증] 토큰 추출 결과: ${token ? '토큰 있음' : '토큰 없음'}`);
    
    if (token) {
      try {
        console.log(`[인증] 토큰 검증 시도...`);
        const decoded = await verifyToken(token);
        if (decoded && decoded.userId) {
          // 사용자 ID가 UUID인지 확인하고 문자열로 변환
          const userId = String(decoded.userId);
          console.log(`[인증] 토큰 검증 성공, userId: ${userId.substring(0, 8)}...`);
          return { userId, authenticated: true, message: '토큰 검증 성공' };
        } else {
          console.warn('[인증] 토큰에서 userId를 찾을 수 없음:', decoded);
        }
      } catch (e) {
        console.error('[인증] 토큰 검증 실패:', e instanceof Error ? e.message : e);
        return { 
          userId: '', 
          authenticated: false, 
          message: e instanceof Error ? e.message : '토큰 검증 실패'
        };
      }
    }
    
    // Supabase 세션으로 인증 시도
    try {
      // Supabase 세션 확인을 통해 실제 로그인한 사용자 ID 확인
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session && session.user && session.user.id) {
        const userId = session.user.id;
        console.log(`[인증] Supabase 세션에서 사용자 ID 확인: ${userId.substring(0, 8)}...`);
        return { userId, authenticated: true, message: '세션 인증' };
      } else {
        console.warn('[인증] Supabase 세션 없음, 사용자가 로그인되지 않음');
        return { userId: '', authenticated: false, message: '로그인이 필요합니다' };
      }
    } catch (sessionError) {
      console.error('[인증] 세션 조회 오류:', sessionError);
      return { userId: '', authenticated: false, message: '세션 확인 오류' };
    }
  } catch (e) {
    console.error('[인증] 검증 과정에서 오류 발생:', e);
    
    // 개발 환경에서도 인증 실패로 처리
    const errorMessage = e instanceof Error ? e.message : '인증 검증 중 알 수 없는 오류 발생';
    return { userId: '', authenticated: false, message: errorMessage };
  }
}

// ✅ 쿠키 이름 상수 정의 (미들웨어와 일치)
const projectRef = 'jdubrjczdyqqtsppojgu';
const accessCookie = `sb-${projectRef}-access-token`;
const refreshCookie = `sb-${projectRef}-refresh-token`;
const authStatusCookie = 'auth-status';

/**
 * 로그인 성공 시 세션 토큰을 저장합니다.
 * 미들웨어와 API에서 인식 가능한 쿠키를 설정합니다.
 * 주의: 이 함수는 클라이언트 측에서만 사용해야 합니다.
 */
export async function handleAuthSuccess(session: any) {
  if (!session) return false;
  
  try {
    // 브라우저 환경인지 확인
    if (typeof window !== 'undefined') {
      // 로컬 스토리지에 토큰 저장 (클라이언트 측에서만)
      localStorage.setItem('token', session.access_token);
      localStorage.setItem('refresh_token', session.refresh_token);
    }
    
    // 쿠키 설정 (클라이언트 측에서만)
    setCookie(accessCookie, session.access_token, 1); // 1일 유효
    setCookie(refreshCookie, session.refresh_token, 7); // 7일 유효
    setCookie(authStatusCookie, 'authenticated', 1); // 인증 상태 표시
    
    console.log('✅ 인증 성공: 토큰과 쿠키가 저장되었습니다');
    return true;
  } catch (error) {
    console.error('❌ 인증 정보 저장 실패:', error);
    return false;
  }
}

/**
 * 쿠키를 설정하는 헬퍼 함수
 * 주의: 이 함수는 클라이언트 측에서만 동작합니다.
 */
function setCookie(name: string, value: string, days: number) {
  // 브라우저 환경인지 확인
  if (typeof document === 'undefined') return;
  
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax;`;
} 