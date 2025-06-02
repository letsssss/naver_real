import { NextResponse } from "next/server";
import { getTokenFromHeaders, verifyToken, generateAccessToken } from "@/lib/auth";
import { createAdminClient } from '@/lib/supabase-admin';

interface DecodedToken {
  userId: string | number;
  email: string;
  role: string;
}

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: Request) {
  try {
    console.log("토큰 갱신 요청 수신");
    
    // 토큰 가져오기 시도
    const token = getTokenFromHeaders(request.headers);
    
    // 토큰이 없으면 권한 없음 응답
    if (!token) {
      console.log("토큰 없음: 권한 없음");
      return NextResponse.json({ error: "토큰이 제공되지 않았습니다." }, { status: 401 });
    }
    
    // 개발 환경 확인
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    
    // 토큰 검증
    const decoded = await verifyToken(token) as DecodedToken;
    
    if (!decoded || !decoded.userId) {
      console.log("유효하지 않은 토큰");
      return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
    }
    
    console.log("토큰 검증 성공:", decoded);
    
    // 실제 사용자 존재 여부 확인
    let userId = decoded.userId;
    let email = decoded.email || "unknown@example.com";
    let role = decoded.role || "USER";
    
    // Supabase 세션 확인 시도
    const supabase = createAdminClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Supabase 세션 확인 오류:", sessionError);
      return NextResponse.json({ error: "세션 확인 중 오류가 발생했습니다." }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "유효한 세션이 없습니다." }, { status: 401 });
    }
    
    // 사용자 메타데이터에서 역할 추출
    const userMetadata = session.user.user_metadata;
    if (userMetadata && userMetadata.role) {
      role = userMetadata.role;
    }
    
    // 새 토큰 생성
    let newToken;
    try {
      newToken = generateAccessToken(
        typeof userId === 'number' ? userId : parseInt(userId as string, 10) || 1,
        email as string,
        role as string
      );
      console.log("새 토큰 생성 성공");
    } catch (tokenError) {
      console.error("토큰 생성 오류:", tokenError);
      return NextResponse.json({ error: "토큰 생성 중 오류가 발생했습니다." }, { status: 500 });
    }
    
    // 응답 생성
    const response = NextResponse.json({
      success: true,
      token: newToken,
      expiresIn: 86400, // 24시간 (초 단위)
    });
    
    // 쿠키에 토큰 설정
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
    return NextResponse.json({ 
      error: "토큰 갱신 중 오류가 발생했습니다.",
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    }, { status: 500 });
  }
} 