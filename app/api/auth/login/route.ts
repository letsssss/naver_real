import { NextResponse } from "next/server";
import { generateAccessToken } from "@/lib/auth";
import { createAdminClient } from '@/lib/supabase-admin';
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
      return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();
    
    // Supabase Auth로 로그인 시도
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error("로그인 오류:", error);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "사용자 정보를 찾을 수 없습니다." }, { status: 401 });
    }

    // 사용자 정보 가져오기
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userError || !userData) {
      console.error("사용자 정보 조회 오류:", userError);
      return NextResponse.json({ error: "사용자 정보 조회에 실패했습니다." }, { status: 500 });
    }

    // 액세스 토큰 생성
    const accessToken = generateAccessToken(
      userData.id,
      userData.email,
      userData.role || 'USER'
    );

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role
      },
      session: data.session,
      accessToken
    });

    // 쿠키에 토큰 설정
    response.cookies.set('auth-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    // 인증 상태 쿠키 설정
    response.cookies.set('auth-status', 'authenticated', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    return response;

  } catch (error) {
    console.error("로그인 처리 중 오류:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
