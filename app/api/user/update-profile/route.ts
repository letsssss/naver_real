// ✅ 목적: Supabase 인증 기반으로 사용자 프로필 조회 및 수정하는 API (Next.js Route Handlers 기반)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { adminSupabase, getSupabaseClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ✅ 유효성 검사 스키마
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phoneNumber: z.string().regex(/^[0-9]{10,11}$/).optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
});

// 사용자 프로필 타입 정의
interface UserProfile {
  id: string;
  email?: string | null;
  name?: string | null;
  phone_number?: string | null;
  role?: string;
  bank_info?: any;
  created_at?: string;
  updated_at?: string | null;
}

// ✅ CORS + 캐시 방지 헤더 설정
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

// ✅ 인증된 유저 정보 가져오기 (개선된 버전)
async function getAuthUser(request: NextRequest) {
  console.log("✅ 사용자 인증 시작...");
  
  try {
    // 1. Authorization 헤더 확인
    const authHeader = request.headers.get('Authorization');
    let userId = null;
    let user = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log("✅ Authorization 헤더 검증 시도");
      const token = authHeader.split(' ')[1];
      
      // 토큰 확인
      const { data: { user: authUser }, error: verifyError } = 
        await getSupabaseClient().auth.getUser(token);
      
      if (!verifyError && authUser) {
        console.log(`✅ 토큰으로 사용자 ID 확인: ${authUser.id}`);
        userId = authUser.id;
        user = authUser;
      } else {
        console.log("❌ 토큰 검증 실패:", verifyError?.message);
      }
    }
    
    // 2. 쿠키 확인 (토큰으로 확인되지 않은 경우)
    if (!userId) {
      console.log("✅ 쿠키에서 세션 확인 시도");
      
      // 쿠키 디버그 - 직접 쿠키 접근을 시도하지 않고 supabase의 getSession 사용
      // Supabase 내부적으로 쿠키를 처리하도록 함
      console.log("✅ Supabase 세션 확인 중...");
      
      // 개발 환경에서는 테스트 ID 사용 (개발 편의)
      if (process.env.NODE_ENV === 'development') {
        console.log("✅ 개발 환경에서 Supabase 세션 확인");
        
        try {
          // 서버 컴포넌트에서 인증 상태 확인
          const { data: sessionData } = await getSupabaseClient().auth.getSession();
          
          if (sessionData?.session?.user) {
            console.log(`✅ 세션에서 사용자 발견: ${sessionData.session.user.id}`);
            userId = sessionData.session.user.id;
            user = sessionData.session.user;
          } else {
            console.log("❌ 세션에서 사용자를 찾을 수 없음");
            
            // URL에서 사용자 ID 파라미터 확인 (개발 환경에서만)
            const urlUserId = request.nextUrl.searchParams.get('userId');
            if (urlUserId) {
              console.log(`✅ URL 파라미터에서 사용자 ID 발견: ${urlUserId}`);
              userId = urlUserId;
            }
          }
        } catch (sessionError) {
          console.error("❌ 세션 확인 오류:", sessionError);
        }
      }
    }
    
    // 사용자 ID가 없으면 null 반환
    if (!userId) {
      console.log("❌ 사용자 ID를 확인할 수 없음");
      return null;
    }
    
    console.log(`✅ 사용자 ID: ${userId} - 프로필 정보 조회 시도`);
    
    // adminSupabase로 사용자 프로필 조회 (RLS 우회)
    const { data: userRow, error: userError } = await adminSupabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (userError || !userRow) {
      console.error("❌ 사용자 프로필 조회 실패:", userError?.message);
      return null;
    }
    
    console.log("✅ 사용자 프로필 조회 성공");
    
    // 사용자 정보 타입 캐스팅
    const profile = userRow as UserProfile;
    
    // 사용자 정보 포맷팅하여 반환
    return {
      id: userId,
      email: user?.email || profile.email,
      name: profile.name,
      phoneNumber: profile.phone_number,
      role: profile.role || 'USER',
      bankInfo: profile.bank_info,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  } catch (error) {
    console.error("❌ 사용자 인증 처리 중 오류:", error);
    return null;
  }
}

// ✅ GET: 프로필 조회
export async function GET(request: NextRequest) {
  console.log("✅ GET 프로필 요청 시작");
  
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      console.log("❌ 인증된 사용자 없음");
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '인증되지 않은 사용자입니다.' }, { status: 401 })
      );
    }
    
    console.log(`✅ 사용자 프로필 반환: ${user.id}`);
    
    return addCorsHeaders(
      NextResponse.json({ success: true, user }, { status: 200 })
    );
  } catch (error) {
    console.error("❌ 프로필 조회 중 오류:", error);
    return addCorsHeaders(
      NextResponse.json({ 
        success: false, 
        message: '프로필 조회 중 오류 발생', 
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    );
  }
}

// ✅ PUT: 프로필 수정
export async function PUT(request: NextRequest) {
  console.log("✅ PUT 프로필 수정 요청 시작");
  
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      console.log("❌ 인증된 사용자 없음");
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '인증되지 않은 사용자입니다.' }, { status: 401 })
      );
    }
    
    const body = await request.json();
    console.log(`✅ 요청 바디:`, body);
    
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      console.log("❌ 유효성 검사 실패:", validation.error.errors);
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '유효하지 않은 입력입니다.', errors: validation.error.errors }, { status: 400 })
      );
    }

    // 프로필 업데이트 데이터 준비
    const updateData: Record<string, any> = {};
    if (body.name) updateData.name = body.name;
    if (body.phoneNumber) updateData.phone_number = body.phoneNumber;
    
    // 은행 정보 업데이트
    if (body.bankName || body.accountNumber || body.accountHolder) {
      // 기존 bank_info 가져오기
      const existingBankInfo = user.bankInfo || {};
      
      updateData.bank_info = {
        ...existingBankInfo,
        bankName: body.bankName !== undefined ? body.bankName : existingBankInfo.bankName || '',
        accountNumber: body.accountNumber !== undefined ? body.accountNumber : existingBankInfo.accountNumber || '',
        accountHolder: body.accountHolder !== undefined ? body.accountHolder : existingBankInfo.accountHolder || '',
      };
    }
    
    console.log(`✅ 프로필 업데이트 시도 (사용자 ID: ${user.id})`, updateData);
    
    // adminSupabase 사용하여 RLS 정책 우회
    const { data, error } = await adminSupabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error("❌ 프로필 업데이트 실패:", error);
      return addCorsHeaders(
        NextResponse.json({ 
          success: false, 
          message: '프로필 업데이트 실패', 
          error: error.message 
        }, { status: 500 })
      );
    }
    
    console.log("✅ 프로필 업데이트 성공");
    
    // 응답 포맷팅 - 타입 캐스팅
    const profile = data as UserProfile;
    const updatedUser = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phoneNumber: profile.phone_number,
      role: profile.role || 'USER',
      bankInfo: profile.bank_info,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };

    return addCorsHeaders(
      NextResponse.json({ 
        success: true, 
        message: '프로필이 성공적으로 수정되었습니다.', 
        user: updatedUser 
      }, { status: 200 })
    );
  } catch (error) {
    console.error("❌ 프로필 수정 중 오류:", error);
    return addCorsHeaders(
      NextResponse.json({ 
        success: false, 
        message: '프로필 수정 중 오류 발생',
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    );
  }
}
