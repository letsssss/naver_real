import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth/getAuthUser';

export const runtime = 'nodejs'; // ✅ Edge 런타임에서 인증 문제 방지

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

export async function GET(request: NextRequest) {
  try {
    // 1. 인증된 사용자 정보 가져오기
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return addCorsHeaders(NextResponse.json({ success: false, message: '인증되지 않은 사용자입니다.' }, { status: 401 }));
    }

    // 2. Supabase 관리자 클라이언트
    const supabase = createAdminClient();

    // 3. 사용자 ID로 구매 내역 조회 (진행 중인 구매만)
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        post:posts(*),
        seller:users!seller_id(id, name, email)
      `)
      .eq('buyer_id', authUser.id)
      .neq('status', 'CANCELLED') // 취소된 거래 제외
      .order('created_at', { ascending: false });

    if (error) {
      console.error('구매 내역 조회 오류:', error);
      return addCorsHeaders(NextResponse.json({ success: false, message: '구매 목록 조회 중 오류 발생', error }, { status: 500 }));
    }

    // 상태값에 따른 분류 추가
    const ongoingPurchases = data.filter(p => p.status !== 'CONFIRMED');
    const completedPurchases = data.filter(p => p.status === 'CONFIRMED');

    return addCorsHeaders(NextResponse.json({
      success: true,
      purchases: data,
      counts: {
        total: data.length,
        ongoing: ongoingPurchases.length,
        completed: completedPurchases.length
      }
    }));
  } catch (err: any) {
    console.error('예외 발생:', err);
    return addCorsHeaders(NextResponse.json({ success: false, message: '서버 오류', error: err.message }, { status: 500 }));
  }
} 