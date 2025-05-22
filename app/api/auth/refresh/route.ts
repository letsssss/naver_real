import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';

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

/**
 * 세션 토큰 갱신 API 엔드포인트
 * 클라이언트에서 세션 상태를 확인하고 필요 시 갱신하도록 요청합니다.
 */
export async function GET(request: Request) {
  try {
    console.log("🔄 세션 갱신 API 요청 수신");
    const cookieStore = cookies();
    
    // 로컬 쿠키 정보 로깅
    const allCookies = cookieStore.getAll();
    console.log(`🔄 쿠키 개수: ${allCookies.length}`);
    
    // 인증 관련 쿠키 로깅
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('supabase') || 
      cookie.name.includes('sb-') || 
      cookie.name.includes('auth')
    );
    
    if (authCookies.length > 0) {
      console.log(`🔄 인증 관련 쿠키 발견: ${authCookies.length}개`);
      authCookies.forEach(cookie => {
        console.log(`- ${cookie.name}: ${cookie.value.substring(0, 15)}...`);
      });
    } else {
      console.log("🔄 인증 관련 쿠키 없음");
    }
    
    // Supabase 클라이언트 생성
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            try {
              cookieStore.set(name, value, {
                ...options,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7, // 7일 유효
              });
            } catch (error) {
              console.error("🔄 쿠키 설정 오류:", error);
            }
          },
          remove(name, options) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 });
            } catch (error) {
              console.error("🔄 쿠키 제거 오류:", error);
            }
          },
        },
      }
    );
    
    // 현재 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("🔄 세션 확인 오류:", sessionError.message);
      return NextResponse.json({ 
        error: "세션 확인 중 오류가 발생했습니다",
        message: sessionError.message,
        code: "session/error"
      }, { status: 500 });
    }
    
    if (!session) {
      console.log("🔄 세션이 없습니다. 복구 시도");
      
      // 세션 복구 시도
      try {
        // 리프레시 토큰이 있는지 확인
        const refreshToken = cookieStore.get('sb-refresh-token')?.value;
        const accessToken = cookieStore.get('sb-access-token')?.value;
        
        if (refreshToken && accessToken) {
          console.log("🔄 토큰 발견, 세션 복구 시도");
          
          // 토큰으로 세션 설정 시도
          const { data, error } = await supabase.auth.setSession({
            refresh_token: refreshToken,
            access_token: accessToken
          });
          
          if (error) {
            console.error("🔄 세션 복구 실패:", error.message);
            return NextResponse.json({ 
              error: "세션 복구 실패",
              message: error.message,
              code: "session/recovery-failed"
            }, { status: 401 });
          }
          
          if (data.session) {
            console.log("🔄 세션 복구 성공");
            
            // 응답 생성
            const response = NextResponse.json({
              status: "success",
              message: "세션 복구 성공",
              user: {
                id: data.session.user.id,
                email: data.session.user.email,
                expiresAt: new Date(data.session.expires_at! * 1000).toISOString()
              }
            });
            
            // auth-status 쿠키 설정 (클라이언트에서 접근 가능)
            response.cookies.set('auth-status', 'authenticated', {
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 7일
              path: '/',
            });
            
            return response;
          }
        } else {
          console.log("🔄 복구 가능한 토큰이 없습니다");
        }
      } catch (recoveryError) {
        console.error("🔄 세션 복구 중 예외 발생:", recoveryError);
      }
      
      return NextResponse.json({ 
        error: "세션이 없습니다",
        code: "session/not-found"
      }, { status: 401 });
    }
    
    // 기존 세션이 있는 경우: 세션 갱신 시도
    console.log("🔄 기존 세션 발견, 갱신 시도");
    console.log(`🔄 사용자: ${session.user.email}`);
    console.log(`🔄 만료 시간: ${new Date(session.expires_at! * 1000).toLocaleString()}`);
    
    // 세션 갱신 시도
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error("🔄 세션 갱신 오류:", refreshError.message);
      return NextResponse.json({ 
        error: "세션 갱신 실패",
        message: refreshError.message,
        code: "session/refresh-failed"
      }, { status: 500 });
    }
    
    const newSession = refreshData.session;
    
    if (!newSession) {
      console.error("🔄 세션 갱신 후 세션 객체가 없습니다");
      return NextResponse.json({ 
        error: "세션 갱신 실패",
        code: "session/empty-after-refresh"
      }, { status: 500 });
    }
    
    console.log("🔄 세션 갱신 성공");
    console.log(`🔄 새 만료 시간: ${new Date(newSession.expires_at! * 1000).toLocaleString()}`);
    
    // 응답 생성
    const response = NextResponse.json({
      status: "success",
      message: "세션 갱신 성공",
      user: {
        id: newSession.user.id,
        email: newSession.user.email,
        expiresAt: new Date(newSession.expires_at! * 1000).toISOString()
      }
    });
    
    // auth-status 쿠키 설정 (클라이언트에서 접근 가능)
    response.cookies.set('auth-status', 'authenticated', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error("🔄 세션 갱신 중 예외 발생:", error);
    return NextResponse.json({ 
      error: "세션 갱신 중 오류가 발생했습니다",
      message: error instanceof Error ? error.message : "알 수 없는 오류",
      code: "session/unknown-error"
    }, { status: 500 });
  }
}

/**
 * POST 방식으로도 동일하게 처리
 */
export async function POST(request: Request) {
  return GET(request);
} 