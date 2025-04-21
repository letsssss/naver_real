import { NextResponse } from 'next/server';
import * as jose from 'jose';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase.types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

// DB 메모리 캐시 타입 정의
interface MemoryUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  profileImage: string | null;
  createdAt: Date;
}

// 서버 메모리 내 사용자 캐시
const userCache: Record<string, { user: MemoryUser; timestamp: number }> = {};

// 인메모리 캐시 TTL (5분)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 쿠키에서 JWT 토큰을 추출하는 함수
 */
function getTokenFromCookies() {
  const cookieStore = cookies();
  return cookieStore.get('token')?.value;
}

/**
 * JWT 토큰을 확인하고 페이로드를 반환하는 함수
 */
async function verifyJwtToken(token: string) {
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error('JWT 검증 오류:', error);
    return null;
  }
}

// OPTIONS 메서드 처리 (CORS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * 현재 로그인한 사용자 정보를 반환하는 API 엔드포인트
 */
export async function GET() {
  try {
    // 토큰 가져오기
    const token = getTokenFromCookies();
    
    if (!token) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 토큰 검증
    const payload = await verifyJwtToken(token);
    
    if (!payload || !payload.sub) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const userId = payload.sub;

    // 캐시에서 사용자 정보 확인
    const cachedData = userCache[userId];
    const now = Date.now();

    if (cachedData && now - cachedData.timestamp < CACHE_TTL) {
      console.log('캐시에서 사용자 정보 반환:', userId);
      return NextResponse.json({ user: cachedData.user });
    }

    // Supabase 클라이언트 생성 - 직접 createClient 사용
    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    // 사용자 정보 조회
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, name, role, profile_image, created_at')
      .eq('id', userId)
      .single();
    
    if (error || !userData) {
      console.error('사용자 정보 조회 오류:', error);
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 응답 형식에 맞게 형변환
    const formattedUser: MemoryUser = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      profileImage: userData.profile_image,
      createdAt: new Date(userData.created_at)
    };

    // 캐시에 사용자 정보 저장
    userCache[userId] = {
      user: formattedUser,
      timestamp: now
    };

    return NextResponse.json({ user: formattedUser });
  } catch (error) {
    console.error('사용자 정보 조회 중 오류:', error);
    
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 