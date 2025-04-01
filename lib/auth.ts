import { compare, hash } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { NextAuthOptions } from 'next-auth';
import { JWT } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import * as jsonwebtoken from 'jsonwebtoken';
import { supabase } from '@/lib/supabase';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { createServerSupabaseClient } from './supabase';

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
}

declare module 'next-auth/jwt' {
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

// 기본 테스트 사용자 ID (개발 환경에서 사용)
const DEFAULT_TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000'; // UUID 형식으로 변경

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
      const supabase = createServerSupabaseClient();
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
    
    // 개발 환경에서는 하드코딩된 값 사용
    if (isDevelopment && !secret) {
      console.log('개발 환경에서 기본 JWT_SECRET 사용');
      return {
        userId: DEFAULT_TEST_USER_ID,
        email: 'test@example.com',
        source: 'dev'
      };
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
        issuer: process.env.JWT_ISSUER || 'netxway',
        audience: process.env.JWT_AUDIENCE || 'user'
      });
      
      return payload;
    } else {
      // 로컬 텍스트 인코딩 비밀키 사용
      const textEncoder = new TextEncoder();
      const secretBuffer = textEncoder.encode(secret);
      
      const { payload } = await jwtVerify(token, secretBuffer, {
        issuer: process.env.JWT_ISSUER || 'netxway',
        audience: process.env.JWT_AUDIENCE || 'user'
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
    
    // 개발 환경에서는 항상 성공 처리
    if (isDevelopment) {
      console.log(`개발 환경에서 토큰 검증 건너뛰고 기본 사용자 ID(${DEFAULT_TEST_USER_ID}) 반환`);
      return { userId: DEFAULT_TEST_USER_ID };
    }
    
    // 프로덕션 환경에서 표준 검증
    const decoded = jsonwebtoken.verify(token, JWT_SECRET);
    console.log("JWT 토큰 검증 성공", decoded);
    return decoded;
  } catch (error) {
    console.error("JWT 토큰 처리 중 오류:", error);
    
    // 개발 환경에서는 기본값 사용
    if (isDevelopment) {
      console.log(`개발 환경에서는 기본 사용자 ID(${DEFAULT_TEST_USER_ID})로 처리`);
      return { userId: DEFAULT_TEST_USER_ID };
    }
    
    return null;
  }
}

// 리프레시 토큰 유효성 검증
export function verifyRefreshToken(token: string) {
  // 개발 환경에서는 항상 성공 처리
  if (isDevelopment) {
    console.log(`개발 환경에서 리프레시 토큰 검증 건너뛰고 기본 사용자 ID(${DEFAULT_TEST_USER_ID}) 반환`);
    return { userId: DEFAULT_TEST_USER_ID };
  }
  
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
  // NextRequest 객체 처리
  if ('cookies' in req && typeof req.cookies === 'object' && req.cookies.get) {
    const tokenCookie = req.cookies.get('accessToken');
    if (tokenCookie) return tokenCookie.value;
    
    const sbTokenCookie = req.cookies.get('sb-access-token');
    if (sbTokenCookie) return sbTokenCookie.value;
  }
  
  // 표준 Request 객체 처리
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  
  // 쿠키 문자열 파싱
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return cookies['accessToken'] || cookies['sb-access-token'] || null;
}

/**
 * 요청에서 인증된 사용자 정보를 가져오는 함수 (Supabase 버전)
 * @param request Next.js 요청 객체
 * @returns 인증된 사용자 객체 또는 null
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    // 개발 환경에서는 항상 기본 사용자 정보 반환
    if (isDevelopment) {
      console.log(`개발 환경에서 기본 사용자 ID(${DEFAULT_TEST_USER_ID}) 사용`);
      return {
        id: DEFAULT_TEST_USER_ID,
        name: '개발 테스트 사용자',
        email: 'test@example.com'
      };
    }
    
    // 1. JWT 토큰 확인 (쿠키 또는 헤더에서)
    const token = getTokenFromHeaders(request.headers) || getTokenFromCookies(request);
    
    if (token) {
      // JWT 토큰 검증
      const decoded = await verifyToken(token);
      if (decoded && decoded.userId) {
        // Supabase에서 사용자 정보 조회
        const { data: user, error } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', decoded.userId)
          .single();
        
        if (user && !error) {
          console.log('JWT 토큰으로 인증된 사용자:', user);
          return user;
        }
      }
    }
    
    // 2. JWT 인증 실패 시 NextAuth 세션 확인
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log('세션 또는 사용자 이메일이 없음');
      return null;
    }

    // Supabase에서 사용자 정보 조회
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', session.user.email.toLowerCase())
      .single();
    
    if (!user || error) {
      console.log('사용자 정보를 찾을 수 없음:', session.user.email);
      return null;
    }
    
    console.log('세션에서 인증된 사용자:', user);
    return user;

  } catch (error) {
    console.error('사용자 인증 정보 가져오기 중 오류:', error);
    return null;
  }
}

// 임시 개발용 토큰 생성 함수
export function generateDevToken(userId: number, name: string = '개발 테스트 사용자'): string {
  if (!isDevelopment) {
    console.warn('개발 환경이 아닌 곳에서 개발용 토큰을 생성하려고 합니다. 보안상 위험할 수 있습니다.');
  }
  
  // JWT 토큰 생성
  try {
    const token = jsonwebtoken.sign(
      { userId, name, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 604800 },
      JWT_SECRET
    );
    return token;
  } catch (error) {
    console.error('개발용 토큰 생성 실패:', error);
    // 대체 토큰 방식 (보안에 취약하니 개발용으로만 사용)
    return `dev-jwt-${userId}-${Date.now()}`;
  }
}

/**
 * 요청에서 인증 토큰을 검증하고 사용자 ID를 반환합니다.
 * @param req 요청 객체
 * @returns 검증된 사용자 정보 또는 null
 */
export async function validateRequestToken(req: Request | NextRequest): Promise<{ userId: string; authenticated: boolean; message?: string }> {
  // 개발 환경 감지
  const isDev = process.env.NODE_ENV === 'development';
  console.log(`[인증] 요청 검증 시작 - 개발 환경: ${isDev}`);
  
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
    
    // 개발 환경에서는 기본 사용자 허용
    if (isDev) {
      // UUID 형식의 기본 사용자 ID 사용 (Supabase 호환성)
      const defaultUserId = '123e4567-e89b-12d3-a456-426614174000';
      console.log(`[인증] 개발 환경: UUID 형식의 기본 사용자 ID ${defaultUserId.substring(0, 8)}... 사용`);
      
      // 개발 환경에서 토큰이 없는 경우 경고 로그 출력
      if (!token) {
        console.warn('[인증] 개발 환경: 토큰 없음. 테스트 사용자 ID로 진행합니다.');
      }
      
      return { userId: defaultUserId, authenticated: true, message: '개발 환경 자동 인증' };
    }
    
    console.warn('[인증] 인증 실패: 토큰 없음 또는 검증 실패');
    return { userId: '', authenticated: false, message: '인증되지 않은 요청' };
  } catch (e) {
    console.error('[인증] 검증 과정에서 오류 발생:', e);
    
    // 개발 환경에서는 기본 사용자 허용
    if (isDev) {
      // UUID 형식의 기본 사용자 ID 사용 (Supabase 호환성)
      const defaultUserId = '123e4567-e89b-12d3-a456-426614174000';
      console.log(`[인증] 개발 환경: 오류 발생 시 UUID 형식 기본 사용자 ID ${defaultUserId.substring(0, 8)}... 사용`);
      return { userId: defaultUserId, authenticated: true, message: '개발 환경 자동 인증 (오류 발생)' };
    }
    
    // 오류 메시지 구성
    const errorMessage = e instanceof Error ? e.message : '인증 검증 중 알 수 없는 오류 발생';
    return { userId: '', authenticated: false, message: errorMessage };
  }
} 