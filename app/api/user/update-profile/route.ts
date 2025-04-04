import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// 입력 데이터 유효성 검사를 위한 zod 스키마
const updateProfileSchema = z.object({
  name: z.string().min(2, "이름은 2글자 이상이어야 합니다.").optional(),
  phoneNumber: z.string().regex(/^[0-9]{10,11}$/, "유효한 전화번호 형식이 아닙니다.").optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
});

// 사용자 데이터 타입 정의
type UserData = {
  id: string;
  email: string;
  name?: string | null;
  phone_number?: string;
  role?: string;
  created_at: string;
  updated_at?: string;
  bank_info?: any;
  [key: string]: any; // 추가 필드를 위한 인덱스 시그니처
};

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 캐시 방지 헤더
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

/**
 * 요청에서 인증된 사용자 정보를 가져오는 함수
 */
async function getAuthUser(request: NextRequest) {
  try {
    console.log("\n===== 사용자 인증 시작 =====");
    console.log("요청 URL:", request.url);
    
    // NextAuth 세션 확인 (가장 먼저 시도)
    console.log("1. NextAuth 세션 확인 중...");
    const session = await getServerSession(authOptions);
    console.log("✅ [update-profile] NextAuth session:", session ? "세션 있음" : "세션 없음");
    
    if (session?.user?.id) {
      console.log("NextAuth 세션으로 사용자 인증 성공:", session.user.id);
      // 사용자 정보 가져오기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (!userError && userData) {
        console.log("NextAuth 세션으로 사용자 정보 조회 성공");
        // UserData 타입으로 변환
        const userDataTyped = userData as UserData;
        
        return {
          id: session.user.id,
          email: session.user.email || '',
          name: userDataTyped?.name || session.user?.name || "",
          phoneNumber: userDataTyped?.phone_number || "",
          role: userDataTyped?.role || "USER",
          bankInfo: userDataTyped?.bank_info
        };
      }
    }
    
    // 모든 쿠키 정보 로깅
    console.log("요청에서 받은 모든 쿠키:");
    const allCookies = request.cookies.getAll();
    console.log(`총 ${allCookies.length}개의 쿠키 발견`);
    allCookies.forEach(cookie => {
      console.log(` - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
    });
    
    // 2. Supabase 세션 쿠키 찾기
    const supabaseSessionCookie = request.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token');
    
    if (supabaseSessionCookie) {
      console.log("Supabase 세션 쿠키 발견:", supabaseSessionCookie.name);
      
      // 쿠키에서 직접 세션 정보 가져오기
      try {
        const cookieValue = supabaseSessionCookie.value;
        
        // URL 디코딩 및 JSON 파싱 전 로깅
        console.log("쿠키 값 (처음 30자):", cookieValue.substring(0, 30));
        
        let sessionData;
        try {
          sessionData = JSON.parse(decodeURIComponent(cookieValue));
        } catch (parseError) {
          console.error("세션 데이터 파싱 실패:", parseError);
          
          // 다른 방법으로 다시 시도
          try {
            // URI 디코딩 없이 시도
            sessionData = JSON.parse(cookieValue);
            console.log("URI 디코딩 없이 파싱 성공");
          } catch (secondError) {
            console.error("두 번째 파싱 시도도 실패:", secondError);
            // 계속 다른 인증 방법 시도
          }
        }
        
        if (sessionData && sessionData.access_token) {
          console.log("세션 데이터에서 액세스 토큰 발견");
          
          // 세션 객체 생성
          const { data: { user }, error: sessionError } = await supabase.auth.getUser(
            sessionData.access_token
          );
          
          if (!sessionError && user) {
            console.log("인증된 사용자 ID:", user.id);
            
            // 사용자 정보 가져오기
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .single();
            
            if (!userError && userData) {
              // UserData 타입으로 변환
              const userDataTyped = userData as UserData;
              
              return {
                id: user.id,
                email: user.email || '',
                name: userDataTyped?.name || user.user_metadata?.name || "",
                phoneNumber: userDataTyped?.phone_number || user.phone || "",
                role: userDataTyped?.role || user.user_metadata?.role || "USER",
                bankInfo: userDataTyped?.bank_info
              };
            }
          }
        }
      } catch (parseError) {
        console.error("세션 쿠키 파싱 오류:", parseError);
      }
    } else {
      console.log("Supabase 세션 쿠키를 찾을 수 없음");
    }
    
    // 3. access_token 쿠키 확인
    const accessTokenCookie = request.cookies.get('access_token');
    if (accessTokenCookie) {
      console.log("액세스 토큰 쿠키 발견");
      
      try {
        const token = accessTokenCookie.value;
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (!error && user) {
          console.log("액세스 토큰 쿠키로 사용자 인증 성공:", user.id);
          
          // 사용자 정보 가져오기
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (!userError && userData) {
            // UserData 타입으로 변환
            const userDataTyped = userData as UserData;
            
            return {
              id: user.id,
              email: user.email || '',
              name: userDataTyped?.name || user.user_metadata?.name || "",
              phoneNumber: userDataTyped?.phone_number || user.phone || "",
              role: userDataTyped?.role || user.user_metadata?.role || "USER",
              bankInfo: userDataTyped?.bank_info
            };
          }
        }
      } catch (tokenError) {
        console.error("액세스 토큰 쿠키 검증 오류:", tokenError);
      }
    }
    
    // 4. 사용자 ID를 쿼리 파라미터로 받은 경우 (개발 환경에서만 허용)
    if (process.env.NODE_ENV === 'development') {
      // URL 객체로 파싱하여 더 안정적으로 쿼리 파라미터 추출
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      console.log("개발 환경 인증 검사 - URL:", url.toString());
      console.log("개발 환경 인증 검사 - userId 파라미터:", userId);
      
      if (userId && userId.length > 10) {  // 유효한 ID 형식인지 간단히 확인
        console.log("쿼리 파라미터에서 유효한 사용자 ID 발견:", userId);
        
        try {
          // 사용자 정보 가져오기
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (userError) {
            console.error("쿼리 파라미터 userId로 사용자 조회 오류:", userError.message);
            
            // 사용자 ID가 있으면 기본 정보로라도 인증 성공 처리 (개발 환경 전용)
            console.log("개발 환경 - 기본 사용자 정보로 인증 허용");
            return {
              id: userId,
              email: 'dev-user@example.com',
              name: '개발 테스트 사용자',
              phoneNumber: '',
              role: 'USER',
              bankInfo: null
            };
          }
          
          if (!userData) {
            console.log("사용자 ID로 사용자를 찾을 수 없음, 기본 정보 사용");
            return {
              id: userId,
              email: 'dev-user@example.com',
              name: '개발 테스트 사용자',
              phoneNumber: '',
              role: 'USER',
              bankInfo: null
            };
          }
          
          console.log("쿼리 파라미터의 사용자 ID로 인증 성공");
          
          // UserData 타입으로 변환
          const userDataTyped = userData as UserData;
          
          return {
            id: userId,
            email: userDataTyped.email || 'dev-user@example.com',
            name: userDataTyped?.name || '개발 테스트 사용자',
            phoneNumber: userDataTyped?.phone_number || '',
            role: userDataTyped?.role || 'USER',
            bankInfo: userDataTyped?.bank_info
          };
        } catch (dbError) {
          console.error("데이터베이스 조회 중 오류:", dbError);
          // 개발 환경에서는 오류가 있어도 기본 사용자 정보 반환
          return {
            id: userId,
            email: 'dev-user@example.com',
            name: '개발 테스트 사용자',
            phoneNumber: '',
            role: 'USER',
            bankInfo: null
          };
        }
      }
    }
    
    // 5. Supabase 세션 직접 확인 (마지막 수단)
    console.log("5. Supabase 직접 세션 확인 시도...");
    try {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      console.log("Supabase 직접 세션 결과:", supabaseSession ? "세션 있음" : "세션 없음");
      
      if (supabaseSession?.user) {
        console.log("Supabase 직접 세션으로 사용자 인증 성공:", supabaseSession.user.id);
        
        // 사용자 정보 가져오기
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseSession.user.id)
          .single();
        
        if (!userError && userData) {
          console.log("Supabase 직접 세션으로 사용자 정보 조회 성공");
          // UserData 타입으로 변환
          const userDataTyped = userData as UserData;
          
          return {
            id: supabaseSession.user.id,
            email: supabaseSession.user.email || '',
            name: userDataTyped?.name || supabaseSession.user?.user_metadata?.name || "",
            phoneNumber: userDataTyped?.phone_number || "",
            role: userDataTyped?.role || supabaseSession.user?.user_metadata?.role || "USER",
            bankInfo: userDataTyped?.bank_info
          };
        }
      }
    } catch (directSessionError) {
      console.error("Supabase 직접 세션 확인 중 오류:", directSessionError);
    }
    
    console.log("어떤 인증 방식으로도 사용자를 찾을 수 없음");
    console.log("요청 URL:", request.url);
    console.log("요청 헤더:", JSON.stringify(Object.fromEntries([...request.headers]), null, 2));
    console.log("===== 사용자 인증 종료 =====\n");
    return null;
  } catch (error) {
    console.error("인증 확인 중 오류:", error);
    return null;
  }
}

// 프로필 정보 업데이트 API
export async function PUT(request: NextRequest) {
  try {
    console.log("프로필 업데이트 API 호출됨");
    
    // 현재 인증된 사용자 정보 가져오기
    const authUser = await getAuthUser(request);
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 사용자 ID:", authUser.id);

    // 요청 본문 파싱
    const body = await request.json();
    
    // 입력 데이터 유효성 검사
    const validationResult = updateProfileSchema.safeParse(body);
    
    if (!validationResult.success) {
      return addCorsHeaders(NextResponse.json(
        { 
          success: false, 
          message: "유효하지 않은 입력 데이터입니다.", 
          errors: validationResult.error.errors 
        },
        { status: 400 }
      ));
    }

    // 업데이트할 사용자 데이터 객체 생성
    const updateData: Record<string, any> = {};
    
    if (body.name) updateData.name = body.name;
    if (body.phoneNumber) updateData.phone_number = body.phoneNumber;
    
    // 계좌 정보가 제공된 경우 추가
    if (body.bankName || body.accountNumber || body.accountHolder) {
      updateData.bank_info = {
        bankName: body.bankName || "",
        accountNumber: body.accountNumber || "",
        accountHolder: body.accountHolder || ""
      };
    }
    
    // 사용자 정보 업데이트
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', authUser.id)
      .select()
      .single();
    
    if (error) {
      console.error("사용자 정보 업데이트 오류:", error);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "프로필 업데이트 중 오류가 발생했습니다." },
        { status: 500 }
      ));
    }

    console.log("사용자 프로필 업데이트 성공:", authUser.id);

    // 사용자 정보 응답 전에 안전하게 bankInfo 처리
    const userData = {
      ...updatedUser as UserData,
      bankInfo: (updatedUser as UserData)?.bank_info
    };

    return addCorsHeaders(NextResponse.json(
      { 
        success: true, 
        message: "프로필이 성공적으로 업데이트되었습니다.", 
        user: userData
      },
      { status: 200 }
    ));
  } catch (error) {
    console.error("프로필 업데이트 오류:", error);
    return addCorsHeaders(NextResponse.json(
      { success: false, message: "프로필 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    ));
  }
}

// 현재 사용자의 프로필 정보 조회 API
export async function GET(request: NextRequest) {
  try {
    console.log("프로필 정보 조회 API 호출됨");
    
    // 현재 인증된 사용자 정보 가져오기
    const authUser = await getAuthUser(request);
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 사용자 ID:", authUser.id);

    // 사용자 정보 조회
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    if (error) {
      console.error("사용자 정보 조회 오류:", error);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "사용자 정보를 조회하는 중 오류가 발생했습니다." },
        { status: 500 }
      ));
    }

    if (!userData) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      ));
    }

    console.log("사용자 프로필 조회 성공:", authUser.id);

    // UserData 타입으로 변환
    const user = userData as UserData;

    // 사용자 정보 응답 구성
    const userResponse = {
      id: user.id,
      name: user.name || authUser.name,
      email: user.email || authUser.email,
      phoneNumber: user.phone_number || "",
      role: user.role || authUser.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      bankInfo: user.bank_info || null
    };

    return addCorsHeaders(NextResponse.json(
      { success: true, user: userResponse },
      { status: 200 }
    ));
  } catch (error) {
    console.error("프로필 조회 오류:", error);
    return addCorsHeaders(NextResponse.json(
      { success: false, message: "프로필 정보 조회 중 오류가 발생했습니다." },
      { status: 500 }
    ));
  }
} 