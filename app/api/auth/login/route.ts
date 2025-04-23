import { NextResponse } from "next/server"
import { comparePassword, generateAccessToken, generateRefreshToken, setSecureCookie } from "@/lib/auth"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabase"

// JWT 시크릿 키 정의
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 개발 환경 확인 함수
const isDevelopment = () => !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

// Edge 브라우저를 포함한 모든 브라우저에서 쿠키를 올바르게 설정하는 헬퍼 함수
function setAuthCookie(response: NextResponse, name: string, value: string, httpOnly: boolean = true) {
  setSecureCookie(response, name, value, { httpOnly });
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
      
      console.log("Supabase 정상 초기화 확인, auth.signInWithPassword 함수 유무:", !!supabase.auth.signInWithPassword);
      
      // Supabase 로그인 시도
      const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (supabaseError) {
        console.log("Supabase 로그인 실패:", supabaseError.message);
        return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
      }

      console.log("Supabase 로그인 성공:", supabaseData);
      
      // Supabase에서 사용자 정보 조회
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', supabaseData.user.id)
        .single();
      
      if (userError || !userData) {
        console.log("Supabase에서 사용자 정보를 찾을 수 없음:", supabaseData.user.id);
        return NextResponse.json({ error: "사용자 정보를 조회할 수 없습니다." }, { status: 404 });
      }
      
      console.log("DB에서 사용자 찾음:", userData.email);
      
      // JWT 토큰 생성
      const token = jwt.sign({ userId: userData.id }, JWT_SECRET, { expiresIn: '7d' });
      
      // 리프레시 토큰 생성
      const refreshToken = generateRefreshToken(userData.id);

      // 리프레시 토큰을 Supabase 데이터베이스에 저장
      const { error: updateError } = await supabase
        .from('users')
        .update({ refresh_token: refreshToken })
        .eq('id', userData.id);
      
      if (updateError) {
        console.log("리프레시 토큰 저장 실패:", updateError.message);
        // 오류가 발생해도 로그인 프로세스는 계속 진행
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
        token,
        supabaseSession: supabaseData?.session
      });

      // 쿠키 설정 (헬퍼 함수 사용)
      setAuthCookie(response, 'auth-token', token);
      setAuthCookie(response, 'auth-status', 'authenticated', false);
      
      // Supabase 세션 토큰이 있으면 쿠키에 저장
      if (supabaseData?.session) {
        setAuthCookie(response, 'supabase-token', supabaseData.session.access_token);
      }
      
      // 캐시 방지 헤더 추가
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    } catch (dbError) {
      console.error("데이터베이스 오류:", dbError);
      return NextResponse.json({ 
        error: "로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("로그인 중 오류 발생:", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}

