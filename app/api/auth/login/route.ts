import { NextResponse } from "next/server"
import { comparePassword, generateAccessToken, generateRefreshToken, setSecureCookie } from "@/lib/auth"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabase"

// JWT 시크릿 키 정의
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 개발 환경 확인 함수
const isDevelopment = () => !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

<<<<<<< HEAD
// ✅ Supabase 프로젝트 ID 추출 함수
function getProjectRef(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let projectRef = 'jdubrjczdyqqtsppojgu'; // 기본값 (fallback)
  
  if (supabaseUrl) {
    const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch && urlMatch[1]) {
      projectRef = urlMatch[1];
    }
  }
  
  return projectRef;
}

// ✅ 통일된 쿠키 설정 함수
function setAuthCookies(response: NextResponse, session: any, customToken: string) {
  const projectRef = getProjectRef();
  const maxAge = 60 * 60 * 24 * 7; // 7일
  
  // 1. Supabase 표준 쿠키 (미들웨어에서 인식)
  response.cookies.set(`sb-${projectRef}-auth-token`, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user
  }), {
    httpOnly: false, // 클라이언트에서도 접근 가능
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
  
  // 2. 커스텀 JWT 토큰 (API 요청용)
  response.cookies.set('auth-token', customToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
  
  // 3. 인증 상태 표시 (클라이언트에서 확인용)
  response.cookies.set('auth-status', 'authenticated', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
  
  console.log(`✅ 쿠키 설정 완료: sb-${projectRef}-auth-token, auth-token, auth-status`);
=======
// Edge 브라우저를 포함한 모든 브라우저에서 쿠키를 올바르게 설정하는 헬퍼 함수
function setAuthCookie(response: NextResponse, name: string, value: string, httpOnly: boolean = true) {
  setSecureCookie(response, name, value, { httpOnly });
>>>>>>> 02455941ea48b4852a803f920f801b393d47d7cb
}

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
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "이메일과 비밀번호는 필수 입력값입니다." }, { status: 400 })
    }

    try {
      // Supabase 클라이언트 검증
      if (!supabase || !supabase.auth) {
        console.error("Supabase 클라이언트 초기화되지 않음");
        return NextResponse.json({ error: "내부 서버 오류가 발생했습니다." }, { status: 500 });
      }
      
      console.log("🔐 로그인 시도:", email);
      
      // Supabase 로그인 시도
      const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (supabaseError) {
        console.log("❌ Supabase 로그인 실패:", supabaseError.message);
        return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
      }

      console.log("✅ Supabase 로그인 성공:", supabaseData.user.email);
      
      // Supabase에서 사용자 정보 조회
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', supabaseData.user.id)
        .single();
      
      if (userError || !userData) {
        console.log("❌ 사용자 정보 조회 실패:", supabaseData.user.id);
        return NextResponse.json({ error: "사용자 정보를 조회할 수 없습니다." }, { status: 404 });
      }
      
      console.log("✅ DB에서 사용자 찾음:", userData.email);
      
      // JWT 토큰 생성 (API 요청용)
      const customToken = jwt.sign({ 
        userId: userData.id,
        email: userData.email,
        role: userData.role 
      }, JWT_SECRET, { expiresIn: '7d' });
      
      // 리프레시 토큰 생성 및 저장
      const refreshToken = generateRefreshToken(userData.id);
      const { error: updateError } = await supabase
        .from('users')
        .update({ refresh_token: refreshToken })
        .eq('id', userData.id);
      
      if (updateError) {
        console.log("⚠️ 리프레시 토큰 저장 실패:", updateError.message);
      }

      // 응답 객체 생성
      const response = NextResponse.json({
        success: true,
        message: "로그인 성공",
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role
        },
        token: customToken,
        supabaseSession: supabaseData?.session
      });

      // ✅ 통일된 쿠키 설정
      setAuthCookies(response, supabaseData.session, customToken);
      
      // 캐시 방지 헤더 추가
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      console.log("🎉 로그인 완료:", userData.email);
      return response;
      
    } catch (dbError) {
      console.error("💥 데이터베이스 오류:", dbError);
      return NextResponse.json({ 
        error: "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("💥 로그인 중 오류 발생:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

