import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { getTokenFromHeaders, verifyToken, generateAccessToken } from "@/lib/auth";
import { createAdminClient } from '@/lib/supabase-admin';

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    // 1. 토큰 추출
    const token = getTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: "토큰이 제공되지 않았습니다." }, { status: 401 });
    }

    // 2. 토큰 검증
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
    }

    // 3. Supabase 세션 확인
    const supabase = createAdminClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Supabase 세션 확인 오류:", sessionError);
      return NextResponse.json({ error: "세션 확인 중 오류가 발생했습니다." }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "유효한 세션이 없습니다." }, { status: 401 });
    }

    // 4. 새 토큰 생성
    const newToken = generateAccessToken(
      decoded.userId,
      decoded.email,
      decoded.role
    );

    // 5. 응답 생성
    const response = NextResponse.json({
      success: true,
      token: newToken
    });

    // 6. 쿠키 설정
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    return response;

  } catch (error) {
    console.error("토큰 갱신 중 오류:", error);
    return NextResponse.json({ error: "토큰 갱신 중 오류가 발생했습니다." }, { status: 500 });
  }
} 