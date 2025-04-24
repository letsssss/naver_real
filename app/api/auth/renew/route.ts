import { NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { getTokenFromHeaders, verifyAccessToken, generateAccessToken } from "@/lib/auth";
import { supabase } from '@/lib/supabase';

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
  console.log("🔄 세션 갱신 요청 시작");
  
  try {
    // 1. 요청 헤더 검사
    const headers = Object.fromEntries(request.headers.entries());
    console.log("📨 요청 헤더:", {
      authorization: headers.authorization ? "존재" : "없음",
      cookie: headers.cookie ? "존재" : "없음"
    });
    
    // 2. 토큰 가져오기 시도
    const token = getTokenFromHeaders(request.headers);
    console.log("🔑 Authorization 헤더 토큰:", token ? "존재" : "없음");
    
    // 3. 쿠키 확인
    const cookieStore = cookies();
    const cookiesList = cookieStore.getAll();
    console.log("🍪 현재 쿠키 목록:", cookiesList.map(c => c.name));
    
    // Supabase 관련 쿠키 확인
    const supabaseCookie = cookiesList.find(c => c.name.startsWith('sb-'));
    console.log("🔐 Supabase 쿠키:", supabaseCookie ? `발견 (${supabaseCookie.name})` : "없음");
    
    // 4. Supabase 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("❌ Supabase 세션 확인 오류:", sessionError);
      return NextResponse.json({ error: "세션 확인 중 오류가 발생했습니다." }, { status: 401 });
    }
    
    console.log("👤 Supabase 세션:", session ? "유효함" : "없음");
    
    // 5. 토큰 검증 (있는 경우)
    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        console.log("✅ 토큰 검증 성공:", decoded ? "유효함" : "유효하지 않음");
      } catch (verifyError) {
        console.error("❌ 토큰 검증 실패:", verifyError);
      }
    }
    
    // 6. 새 토큰 생성
    let userId = session?.user?.id || "1";
    let email = session?.user?.email || "unknown@example.com";
    let role = session?.user?.user_metadata?.role || "USER";
    
    console.log("👥 토큰 생성을 위한 사용자 정보:", { userId, email, role });
    
    const newToken = generateAccessToken(
      typeof userId === 'number' ? userId : parseInt(userId, 10) || 1,
      email,
      role
    );
    
    console.log("🔑 새 토큰 생성 완료");
    
    // 7. 응답 생성
    const response = NextResponse.json({
      message: "토큰 갱신 성공",
      token: newToken,
      expiresIn: 86400,
    });
    
    // 8. 쿠키 설정
    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    
    response.cookies.set('auth-status', 'authenticated', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    
    console.log("✅ 세션 갱신 완료");
    return response;
    
  } catch (error) {
    console.error("❌ 세션 갱신 중 오류 발생:", error);
    return NextResponse.json({ 
      error: "토큰 갱신 중 오류가 발생했습니다.",
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    }, { status: 500 });
  }
} 