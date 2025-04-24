import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { createAdminClient } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

// 사용자 정보 캐싱 (5분)
const userCache = new Map<string, { user: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 토큰 가져오기
    const cookieStore = cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }
    
    // 캐시 확인
    const cachedUser = userCache.get(token);
    if (cachedUser && Date.now() - cachedUser.timestamp < CACHE_TTL) {
      return NextResponse.json({ user: cachedUser.user });
    }
    
    // JWT 토큰 검증
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    if (!payload.sub) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }
    
    const userId = payload.sub;
    
    // Supabase에서 사용자 정보 조회
    const supabase = createAdminClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      console.error('사용자 조회 오류:', error);
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 캐시에 저장
    userCache.set(token, { user, timestamp: Date.now() });
    
    return NextResponse.json({ user });
  } catch (error) {
    console.error('인증 오류:', error);
    return NextResponse.json({ error: '인증 처리 중 오류가 발생했습니다.' }, { status: 500 });
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