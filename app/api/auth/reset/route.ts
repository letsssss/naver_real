import { NextResponse } from "next/server";

export async function POST() {
  try {
    // 새로운 응답 객체 생성
    const response = NextResponse.json({ 
      success: true, 
      message: "인증 데이터가 초기화되었습니다." 
    });

    // 모든 인증 관련 쿠키 삭제
    const cookiesToDelete = [
      'auth-token',
      'auth-status', 
      'token', 
      'user',
      'supabase-auth-token',
      'sb-access-token',
      'sb-refresh-token'
    ];

    cookiesToDelete.forEach(cookieName => {
      response.cookies.delete(cookieName);
    });
    
    return response;
  } catch (error) {
    console.error("인증 데이터 초기화 중 오류:", error);
    return NextResponse.json({ 
      success: false, 
      message: "인증 데이터 초기화 중 오류가 발생했습니다." 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 