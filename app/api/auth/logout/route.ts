import { NextResponse } from "next/server"
import { createAdminClient } from '@/lib/supabase-admin'
import { getTokenFromHeaders, verifyAccessToken } from "@/lib/auth"

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
    console.log("로그아웃 요청 수신");
    
    // 토큰 가져오기 시도
    const token = getTokenFromHeaders(request.headers);
    
    // 개발 환경 확인
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    
    // Supabase 로그아웃
    const { error } = await createAdminClient().auth.signOut();

    if (error) {
      console.error('Supabase 로그아웃 오류:', error);
      return NextResponse.json(
        { error: '로그아웃 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    // 응답 객체 생성
    const response = NextResponse.json({
      message: "로그아웃 성공",
    });
    
    // 모든 인증 관련 쿠키 제거
    response.cookies.set("auth-token", "", {
      expires: new Date(0), // 쿠키 즉시 만료
      path: "/",
    });
    
    response.cookies.set("auth-status", "", {
      expires: new Date(0),
      path: "/",
    });
    
    response.cookies.set("token", "", {
      expires: new Date(0),
      path: "/",
    });
    
    response.cookies.set("user", "", {
      expires: new Date(0),
      path: "/",
    });
    
    response.cookies.set("supabase-auth-token", "", {
      expires: new Date(0),
      path: "/",
    });
    
    // 토큰이 없으면 쿠키만 제거하고 응답
    if (!token) {
      console.log("토큰 없이 로그아웃 처리");
      return response;
    }
    
    // 개발 환경에서는 토큰 검증 없이 로그아웃 처리
    if (isDevelopment) {
      console.log("개발 환경에서 로그아웃 처리");
      return response;
    }
    
    // 토큰 검증
    const decoded = verifyAccessToken(token);
    
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      console.log("유효하지 않은 토큰으로 로그아웃 요청");
      return response;
    }
    
    const userId = decoded.userId as string;
    
    // Supabase에서 사용자 세션 관련 정보 제거 시도
    try {
      // 사용자 세션 정보 제거 (Supabase는 signOut으로 기본 처리됨)
      console.log("사용자 세션 정보 제거 완료:", userId);
    } catch (dbError) {
      console.error("데이터베이스 오류:", dbError);
      // DB 오류가 발생해도 쿠키는 제거하고 성공으로 응답
    }
    
    return response;
  } catch (error) {
    console.error("로그아웃 오류:", error);
    
    // 오류가 발생해도 쿠키는 제거
    const response = NextResponse.json({
      message: "로그아웃 처리 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    }, { status: 500 });
    
    // 모든 인증 관련 쿠키 제거
    response.cookies.set("auth-token", "", {
      expires: new Date(0),
      path: "/",
    });
    
    response.cookies.set("auth-status", "", {
      expires: new Date(0),
      path: "/",
    });
    
    response.cookies.set("token", "", {
      expires: new Date(0),
      path: "/",
    });
    
    response.cookies.set("user", "", {
      expires: new Date(0),
      path: "/",
    });
    
    response.cookies.set("supabase-auth-token", "", {
      expires: new Date(0),
      path: "/",
    });
    
    return response;
  }
}

