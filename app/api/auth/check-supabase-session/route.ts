import { NextResponse } from "next/server";
import { createAdminClient } from '@/lib/supabase-admin';
import { generateAccessToken } from "@/lib/auth";

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

export async function GET(request: Request) {
  try {
    console.log("Supabase 세션 확인 요청 수신");
    
    // Supabase 세션 확인
    const supabase = createAdminClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Supabase 세션 확인 오류:", error);
      return NextResponse.json({
        authenticated: false,
        error: "세션 확인 중 오류가 발생했습니다.",
      });
    }

    if (!session) {
      console.log("Supabase 세션 없음");
      return NextResponse.json({
        authenticated: false,
        message: "세션이 없습니다.",
      });
    }
    
    // 세션이 있으면 사용자 정보 추출
    const user = session.user;
    console.log("Supabase 세션 발견, 사용자 ID:", user.id);
    
    // 사용자 메타데이터에서 추가 정보 추출
    const userData = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || "사용자",
      role: user.user_metadata?.role || "USER",
    };
    
    // JWT 토큰 생성
    const token = generateAccessToken(
      parseInt(userData.id, 10),
      userData.email || "unknown@example.com",
      userData.role
    );
    
    // 응답 생성
    const response = NextResponse.json({
      authenticated: true,
      user: userData,
      token,
      message: "세션이 유효합니다.",
    });
    
    // 쿠키에 토큰 설정
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일 (초 단위)
      path: '/',
    });
    
    // auth-status 쿠키 설정 (클라이언트에서 접근 가능)
    response.cookies.set('auth-status', 'authenticated', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일 (초 단위)
      path: '/',
    });
    
    return response;

  } catch (error) {
    console.error("Supabase 세션 확인 중 오류:", error);
    return NextResponse.json({ 
      authenticated: false,
      error: "세션 확인 중 오류가 발생했습니다.",
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    }, { status: 500 });
  }
} 