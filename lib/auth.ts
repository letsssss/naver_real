import { compare, hash } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import * as jsonwebtoken from 'jsonwebtoken';
import { JwtPayload } from 'jsonwebtoken';
import supabase from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { jwtVerify, createRemoteJWKSet } from 'jose';
// @ts-ignore - 타입 에러 무시 (런타임에는 정상 작동)
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { Database } from '@/types/supabase.types';
// @ts-ignore - 타입 에러 무시 (런타임에는 정상 작동)
import { createClient } from '@supabase/supabase-js';
import jwt from "jsonwebtoken";

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
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    console.log("JWT 토큰 검증 시도");
    
    // 개발 환경에서도 실제 토큰 검증 시도
    const decoded = jsonwebtoken.verify(token, JWT_SECRET);
    console.log("JWT 토큰 검증 성공", decoded);
    
    // string | JwtPayload 타입 처리
    if (typeof decoded === 'string') {
      // 문자열인 경우 (드문 케이스)
      console.warn("JWT 토큰이 문자열로 디코딩됨");
      return null;
    }
    
    return decoded as JwtPayload;
  } catch (error) {
    console.error("JWT 토큰 처리 중 오류:", error);
    // 개발 환경에서 토큰 검증에 실패해도 null을 반환하도록 수정
    return null;
  }
}

// 리프레시 토큰 유효성 검증
export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    const decoded = jsonwebtoken.verify(token, JWT_REFRESH_SECRET);
    
    // string | JwtPayload 타입 처리
    if (typeof decoded === 'string') {
      return null;
    }
    
    return decoded as JwtPayload;
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
                      req.cookies.get('token')?.value ||
                      req.cookies.get('sb-access-token')?.value ||
                      req.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token')?.value || // ✅ 추가
                      req.cookies.get(`sb-${process.env.SUPABASE_PROJECT_ID}-auth-token`)?.value;

    // 쿠키 디버깅 로그
    console.log("[getTokenFromCookies] 쿠키 추출 시도:", tokenCookie ? "찾음" : "없음");
    
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

  // 추가 쿠키 이름 확인
  const foundToken = (
    cookies['access_token'] ||
    cookies['token'] ||
    cookies['sb-access-token'] ||
    cookies['sb-jdubrjczdyqqtsppojgu-auth-token'] || // ✅ 여기도 반드시 포함
    cookies[`sb-${process.env.SUPABASE_PROJECT_ID}-auth-token`] ||
    null
  );
  
  // 쿠키 디버깅 로그
  console.log("[getTokenFromCookies] 헤더에서 쿠키 추출 시도:", foundToken ? "찾음" : "없음");
  
  return foundToken;
}

// 디버그용 로그는 주석 처리
// console.log('===== Supabase 인증 헬퍼 디버깅 =====');
// console.log('@supabase/auth-helpers-nextjs에서 사용 가능한 내보내기:', Object.keys(require('@supabase/auth-helpers-nextjs')));
// console.log('cookies 타입:', typeof cookies, cookies);
// console.log('==================================');

// 기존 getAuthenticatedUser 함수를 새로운 버전으로 교체
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    console.log("[getAuthenticatedUser] 인증 사용자 확인 시작");
    
    // 1. 요청에서 직접 토큰 추출
    const tokenFromHeader = getTokenFromHeaders(request.headers);
    const tokenFromCookie = getTokenFromCookies(request);
    const token = tokenFromHeader || tokenFromCookie;
    
    // 토큰 출처 로그
    if (tokenFromHeader) console.log("[getAuthenticatedUser] 헤더에서 토큰 발견");
    if (tokenFromCookie) console.log("[getAuthenticatedUser] 쿠키에서 토큰 발견");
    
    if (!token) {
      console.log("[getAuthenticatedUser] ❌ 인증 토큰을 찾을 수 없습니다");
      
      // 마지막 대안: 세션 확인
      try {
        console.log("[getAuthenticatedUser] 세션 확인 시도");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!sessionError && session?.user) {
          console.log("[getAuthenticatedUser] 세션에서 사용자 발견:", session.user.id);
          return session.user;
        } else {
          console.log("[getAuthenticatedUser] 세션에서 사용자를 찾을 수 없음:", sessionError?.message);
        }
      } catch (sessionError) {
        console.error("[getAuthenticatedUser] 세션 확인 중 오류:", sessionError);
      }
      
      return null;
    }
    
    // 토큰 디버깅 (보안을 위해 일부만 출력)
    console.log("[getAuthenticatedUser] 토큰 발견:", token.substring(0, 15) + "...");
    
    // 2. 기존 Supabase 클라이언트에 토큰 직접 전달
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error("[getAuthenticatedUser] ❌ 사용자 인증 실패:", error.message);
      
      // 토큰으로 직접 유효성 검사 시도
      try {
        console.log("[getAuthenticatedUser] 토큰 직접 검증 시도");
        const decoded = verifyAccessToken(token);
        
        // 더 안전한 타입 가드 추가
        if (decoded && typeof decoded === 'object') {
          // userId나 sub 속성이 있는지 확인
          const userId = typeof decoded.sub === 'string' ? decoded.sub : 
                         typeof decoded.userId === 'string' ? decoded.userId : null;
          
          if (userId) {
            console.log("[getAuthenticatedUser] 토큰에서 사용자 ID 추출:", userId);
            
            // 간이 사용자 객체 반환
            return {
              id: userId,
              email: typeof decoded.email === 'string' ? decoded.email : null,
              role: typeof decoded.role === 'string' ? decoded.role : 'USER'
            };
          }
        }
      } catch (verifyError) {
        console.error("[getAuthenticatedUser] 토큰 검증 오류:", verifyError);
      }
      
      return null;
    }
    
    console.log("[getAuthenticatedUser] ✅ 사용자 인증 성공:", user.id);
    return user;
  } catch (error) {
    console.error("[getAuthenticatedUser] ❌ 인증 처리 중 오류 발생:", error);
    return null;
  }
}

/**
 * 요청에서 인증된 사용자 정보를 가져오는 함수 (Supabase 버전)
 * @param request Next.js 요청 객체
 * @returns 인증된 사용자 객체 또는 null
 */
export async function validateRequestToken(req: Request | NextRequest): Promise<{ userId: string; authenticated: boolean; message?: string }> {
  try {
    // 헤더에서 토큰 추출
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.warn('Authorization 헤더가 없습니다.');
      return { userId: '', authenticated: false, message: '인증 토큰이 없습니다.' };
    }

    // Bearer 토큰 형식 확인
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      console.warn('잘못된 토큰 형식:', authHeader);
      return { userId: '', authenticated: false, message: '잘못된 토큰 형식입니다.' };
    }

    try {
      // 1. Supabase 토큰 검증 시도
      const { data: { user }, error: supabaseError } = await supabase.auth.getUser(token);
      
      if (!supabaseError && user) {
        console.log('Supabase 토큰 검증 성공:', user.id);
        return {
          userId: user.id,
          authenticated: true
        };
      }
    } catch (supabaseError) {
      console.warn('Supabase 토큰 검증 실패, 다른 방식 시도:', supabaseError);
    }

    // 2. 커스텀 JWT 검증 시도
    const decodedToken = await verifyToken(token);
    if (decodedToken && (decodedToken.userId || decodedToken.sub)) {
      console.log('커스텀 JWT 검증 성공:', decodedToken.userId || decodedToken.sub);
      return {
        userId: decodedToken.userId || decodedToken.sub,
        authenticated: true
      };
    }

    // 3. 개발 환경에서 추가 검증
    if (isDevelopment) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.user) {
          console.log('개발 환경: 세션에서 사용자 ID 사용:', session.user.id);
          return {
            userId: session.user.id,
            authenticated: true
          };
        }
      } catch (sessionError) {
        console.error('개발 환경: 세션 확인 오류:', sessionError);
      }
    }

    return { userId: '', authenticated: false, message: '유효하지 않은 토큰입니다.' };
  } catch (error) {
    console.error('토큰 검증 중 오류 발생:', error);
    return { 
      userId: '', 
      authenticated: false, 
      message: error instanceof Error ? error.message : '토큰 검증 중 오류가 발생했습니다.' 
    };
  }
}

// ✅ 쿠키 이름 상수 정의 (미들웨어와 일치)
function getProjectRef(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let projectRef = 'jdubrjczdyqqtsppojgu'; // 기본값 (fallback)
  
  if (supabaseUrl) {
    // URL에서 프로젝트 ID 추출: https://[PROJECT_ID].supabase.co
    const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch && urlMatch[1]) {
      projectRef = urlMatch[1];
    }
  }
  
  return projectRef;
}

const projectRef = getProjectRef();
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