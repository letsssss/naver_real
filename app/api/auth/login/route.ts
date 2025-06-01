import { NextResponse } from "next/server";
import { generateRefreshToken } from "@/lib/auth";
import jwt from "jsonwebtoken";
import { supabase } from "@/lib/supabase";

// JWT 시크릿 키 (환경변수 없으면 기본값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 개발 환경 확인 (현재 사용하지 않음)
const isDevelopment = () => !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

// Supabase 프로젝트 ref 추출 함수
function getProjectRef(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let projectRef = 'jdubrjczdyqqtsppojgu'; // 기본값 fallback
  
  if (supabaseUrl) {
    const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (urlMatch && urlMatch[1]) {
      projectRef = urlMatch[1];
    }
  }
  
  return projectRef;
}

// 쿠키 일괄 설정 함수
function setAuthCookies(response: NextResponse, session: any, customToken: string) {
  const projectRef = getProjectRef();
  const maxAge = 60 * 60 * 24 * 7; // 7일

  // Supabase 세션 쿠키 설정
  response.cookies.set(`sb-${projectRef}-auth-token`, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  // 커스텀 JWT 토큰 설정
  response.cookies.set('auth-token', customToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  // 인증 상태 표시용 쿠키 설정 (클라이언트 접근 가능)
  response.cookies.set('auth-status', 'authenticated', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  // 사용자 정보 쿠키 설정 (클라이언트 접근 가능)
  response.cookies.set('user', JSON.stringify({
    id: session.user.id,
    email: session.user.email,
    name: session.user.user_metadata?.name || '사용자',
    role: session.user.user_metadata?.role || 'USER'
  }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  console.log('✅ 인증 쿠키 설정 완료');
}

// OPTIONS 요청 처리 (CORS 허용)
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

// POST 요청 - 로그인 처리
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "이메일과 비밀번호는 필수 입력값입니다." }, { status: 400 });
    }

    if (!supabase || !supabase.auth) {
      console.error("Supabase 클라이언트 초기화되지 않음");
      return NextResponse.json({ error: "내부 서버 오류가 발생했습니다." }, { status: 500 });
    }

    console.log("🔐 로그인 시도:", email);

    // 🚀 성능 최적화: Supabase 로그인과 동시에 JWT 토큰 생성 준비
    const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (supabaseError) {
      console.log("❌ Supabase 로그인 실패:", supabaseError.message);
      return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    console.log("✅ Supabase 로그인 성공:", supabaseData.user.email);

    // 🚀 성능 최적화: 사용자 정보 조회와 JWT 토큰 생성을 병렬 처리
    const [userResult, jwtToken] = await Promise.allSettled([
      // 사용자 정보 조회
      supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', supabaseData.user.id)
        .single(),
      
      // JWT 토큰 미리 생성 (기본 정보로)
      Promise.resolve(jwt.sign({
        userId: supabaseData.user.id,
        email: supabaseData.user.email,
        role: 'USER', // 기본값
      }, JWT_SECRET, { expiresIn: '7d' }))
    ]);

    // 사용자 정보 처리
    let userData = null;
    if (userResult.status === 'fulfilled' && userResult.value.data) {
      userData = userResult.value.data;
    } else {
      console.log("❌ 사용자 정보 조회 실패, 기본 정보 사용");
      // 기본 사용자 정보 사용
      userData = {
        id: supabaseData.user.id,
        name: supabaseData.user.user_metadata?.name || '사용자',
        email: supabaseData.user.email,
        role: 'USER'
      };
    }

    console.log("✅ 사용자 정보 확인:", userData.email);

    // JWT 토큰 (실제 사용자 정보로 재생성 필요시)
    let customToken;
    if (jwtToken.status === 'fulfilled') {
      // 실제 사용자 정보와 다르면 재생성
      if (userData.role !== 'USER') {
        customToken = jwt.sign({
          userId: userData.id,
          email: userData.email,
          role: userData.role,
        }, JWT_SECRET, { expiresIn: '7d' });
      } else {
        customToken = jwtToken.value;
      }
    } else {
      // 폴백: 새로 생성
      customToken = jwt.sign({
        userId: userData.id,
        email: userData.email,
        role: userData.role,
      }, JWT_SECRET, { expiresIn: '7d' });
    }

    // 🚀 성능 최적화: 리프레시 토큰 저장을 비동기로 처리 (응답 지연 방지)
    const refreshToken = generateRefreshToken(userData.id);
    supabase
      .from('users')
      .update({ refresh_token: refreshToken })
      .eq('id', userData.id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.log("⚠️ 리프레시 토큰 저장 실패:", updateError.message);
        } else {
          console.log("✅ 리프레시 토큰 저장 완료 (비동기)");
        }
      });

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      message: "로그인 성공",
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      },
      token: customToken,
      supabaseSession: supabaseData?.session,
    });

    // 쿠키 설정
    setAuthCookies(response, supabaseData.session, customToken);

    // 캐시 방지 헤더 추가
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    console.log("🎉 로그인 완료:", userData.email);
    return response;

  } catch (error) {
    console.error("💥 로그인 중 오류 발생:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
