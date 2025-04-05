// ✅ 목적: Supabase 인증 기반으로 사용자 프로필 조회 및 수정하는 API (Next.js Route Handlers 기반)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ✅ 유효성 검사 스키마
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phoneNumber: z.string().regex(/^[0-9]{10,11}$/).optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
});

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

// ✅ 인증된 유저 정보 가져오기 (직접 createClient 사용)
async function getAuthUser(request: NextRequest) {
  // Next.js에서 쿠키 가져오기
  const cookieStore = cookies();
  
  // Supabase 클라이언트 생성 (URL과 KEY는 환경 변수에서 가져옴)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          // 클라이언트에서 보낸 인증 헤더 포함
          Authorization: request.headers.get('Authorization') || ''
        }
      }
    }
  );

  // 사용자 정보 가져오기
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log("🔥 Supabase 유저:", user);

  if (error || !user) return null;

  // DB에서 사용자 프로필 정보 가져오기
  const { data: userRow } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!userRow) return null;

  return {
    id: user.id,
    email: user.email,
    name: userRow.name,
    phoneNumber: userRow.phone_number,
    role: userRow.role || 'USER',
    bankInfo: userRow.bank_info,
    createdAt: userRow.created_at,
    updatedAt: userRow.updated_at,
  };
}

// ✅ GET: 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '인증되지 않은 사용자입니다.' }, { status: 401 })
      );
    }

    return addCorsHeaders(
      NextResponse.json({ success: true, user }, { status: 200 })
    );
  } catch (error) {
    return addCorsHeaders(
      NextResponse.json({ success: false, message: '프로필 조회 중 오류 발생' }, { status: 500 })
    );
  }
}

// ✅ PUT: 프로필 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '인증되지 않은 사용자입니다.' }, { status: 401 })
      );
    }

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '유효하지 않은 입력입니다.', errors: validation.error.errors }, { status: 400 })
      );
    }

    // 프로필 업데이트를 위한 Supabase 클라이언트
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false
        },
        global: {
          headers: {
            Authorization: request.headers.get('Authorization') || ''
          }
        }
      }
    );

    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.phoneNumber) updateData.phone_number = body.phoneNumber;
    if (body.bankName || body.accountNumber || body.accountHolder) {
      updateData.bank_info = {
        bankName: body.bankName || '',
        accountNumber: body.accountNumber || '',
        accountHolder: body.accountHolder || '',
      };
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error || !data) {
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '프로필 업데이트 실패' }, { status: 500 })
      );
    }

    return addCorsHeaders(
      NextResponse.json({ success: true, message: '프로필이 성공적으로 수정되었습니다.', user: data }, { status: 200 })
    );
  } catch (error) {
    return addCorsHeaders(
      NextResponse.json({ success: false, message: '프로필 수정 중 오류 발생' }, { status: 500 })
    );
  }
}
