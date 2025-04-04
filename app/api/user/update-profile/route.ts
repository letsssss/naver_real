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
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id);

      const userData = users?.[0];

      if (!userError && userData) {
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

    const supabaseSessionCookie = request.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token');
    if (supabaseSessionCookie) {
      const cookieValue = supabaseSessionCookie.value;
      let sessionData;
      try {
        sessionData = JSON.parse(decodeURIComponent(cookieValue));
      } catch {
        try {
          sessionData = JSON.parse(cookieValue);
        } catch {}
      }

      if (sessionData?.access_token) {
        const { data: { user }, error: sessionError } = await supabase.auth.getUser(sessionData.access_token);
        if (!sessionError && user) {
          const { data: users, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id);

          const userData = users?.[0];

          if (!userError && userData) {
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
    }

    const accessTokenCookie = request.cookies.get('access_token');
    if (accessTokenCookie) {
      const token = accessTokenCookie.value;
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id);

        const userData = users?.[0];

        if (!userError && userData) {
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

    if (process.env.NODE_ENV === 'development') {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      if (userId && userId.length > 10) {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId);

        const userData = users?.[0];

        if (userError || !userData) {
          return {
            id: userId,
            email: 'dev-user@example.com',
            name: '개발 테스트 사용자',
            phoneNumber: '',
            role: 'USER',
            bankInfo: null
          };
        }

        const userDataTyped = userData as UserData;
        return {
          id: userId,
          email: userDataTyped.email || 'dev-user@example.com',
          name: userDataTyped?.name || '개발 테스트 사용자',
          phoneNumber: userDataTyped?.phone_number || '',
          role: userDataTyped?.role || 'USER',
          bankInfo: userDataTyped?.bank_info
        };
      }
    }

    const { data: { session: supabaseSession } } = await supabase.auth.getSession();
    if (supabaseSession?.user) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseSession.user.id);

      const userData = users?.[0];

      if (!userError && userData) {
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

    return null;
  } catch (error) {
    console.error("인증 확인 중 오류:", error);
    return null;
  }
}

// 프로필 정보 업데이트 API
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    
    if (!authUser) {
      return addCorsHeaders(NextResponse.json({ success: false, message: "인증되지 않은 사용자입니다." }, { status: 401 }));
    }

    const body = await request.json();
    const validationResult = updateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      return addCorsHeaders(NextResponse.json({ success: false, message: "유효하지 않은 입력 데이터입니다.", errors: validationResult.error.errors }, { status: 400 }));
    }

    const updateData: Record<string, any> = {};
    if (body.name) updateData.name = body.name;
    if (body.phoneNumber) updateData.phone_number = body.phoneNumber;
    if (body.bankName || body.accountNumber || body.accountHolder) {
      updateData.bank_info = {
        bankName: body.bankName || "",
        accountNumber: body.accountNumber || "",
        accountHolder: body.accountHolder || ""
      };
    }

    const { data: updatedUsers, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', authUser.id)
      .select();

    const updatedUser = updatedUsers?.[0];

    if (error || !updatedUser) {
      return addCorsHeaders(NextResponse.json({ success: false, message: "프로필 업데이트 중 오류가 발생했습니다." }, { status: 500 }));
    }

    const userData = { 
      ...updatedUser,
      bankInfo: (updatedUser as any).bank_info 
    };

    return addCorsHeaders(NextResponse.json({ success: true, message: "프로필이 성공적으로 업데이트되었습니다.", user: userData }, { status: 200 }));
  } catch (error) {
    return addCorsHeaders(NextResponse.json({ success: false, message: "프로필 업데이트 중 오류가 발생했습니다." }, { status: 500 }));
  }
}

// 현재 사용자의 프로필 정보 조회 API
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return addCorsHeaders(NextResponse.json({ success: false, message: "인증되지 않은 사용자입니다." }, { status: 401 }));
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id);

    const userData = users?.[0];

    if (error || !userData) {
      return addCorsHeaders(NextResponse.json({ success: false, message: "사용자를 찾을 수 없습니다." }, { status: 500 }));
    }

    const userResponse = {
      id: userData.id,
      name: userData.name || authUser.name,
      email: userData.email || authUser.email,
      phoneNumber: (userData as any).phone_number || "",
      role: (userData as any).role || authUser.role,
      createdAt: userData.created_at,
      updatedAt: (userData as any).updated_at,
      bankInfo: (userData as any).bank_info || null
    };

    return addCorsHeaders(NextResponse.json({ success: true, user: userResponse }, { status: 200 }));
  } catch (error) {
    return addCorsHeaders(NextResponse.json({ success: false, message: "프로필 정보 조회 중 오류가 발생했습니다." }, { status: 500 }));
  }
} 