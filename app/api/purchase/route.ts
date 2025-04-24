import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

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

// GET 핸들러 - 구매자 구매 내역 조회
export async function GET(request: NextRequest) {
  try {
    // URL에서 userId 파라미터 가져오기
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '사용자 ID가 필요합니다.' }, { status: 400 })
      );
    }

    const supabase = createAdminClient();

    // ✅ 구매자 ID로 구매 목록 조회 (취소 제외)
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        post:posts(*),
        seller:users!seller_id(id, name, email)
      `)
      .eq('buyer_id', userId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('구매 목록 조회 오류:', error);
      return addCorsHeaders(
        NextResponse.json({ success: false, message: '구매 목록 조회 중 오류 발생', error }, { status: 500 })
      );
    }

    return addCorsHeaders(
      NextResponse.json({
        success: true,
        purchases: data || [],
      })
    );
  } catch (err: any) {
    console.error('예외 발생:', err);
    return addCorsHeaders(
      NextResponse.json({ success: false, message: '서버 오류', error: err?.message || String(err) }, { status: 500 })
    );
  }
} 