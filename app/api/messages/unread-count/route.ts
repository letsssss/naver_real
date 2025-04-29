import { NextResponse, NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 헤더 추가 (CORS 등)
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS 메서드 처리 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// GET 메서드 - 읽지 않은 메시지 개수 반환
export async function GET(req: NextRequest) {
  try {
    // 사용자 인증 확인
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401, headers: CORS_HEADERS });
    }
    
    const { id: userId, authenticated } = await verifyToken(token);
    
    if (!authenticated || !userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401, headers: CORS_HEADERS });
    }

    // Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient({ cookies });
    
    // URL에서 orderNumber 파라미터 확인
    const url = new URL(req.url);
    const orderNumber = url.searchParams.get('orderNumber');
    
    // 쿼리 생성
    let query = supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    
    // 특정 주문번호에 대한 메시지만 필터링
    if (orderNumber) {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id')
        .eq('order_number', orderNumber)
        .single();
      
      if (roomData?.id) {
        query = query.eq('room_id', roomData.id);
      }
    }
    
    // 쿼리 실행
    const { count, error } = await query;
    
    if (error) {
      console.error('메시지 개수 조회 오류:', error);
      return NextResponse.json({ error: '메시지 개수를 조회할 수 없습니다.' }, { status: 500, headers: CORS_HEADERS });
    }
    
    // 결과 반환
    return NextResponse.json({ 
      count: count || 0,
      orderNumber: orderNumber || null
    }, { headers: CORS_HEADERS });
    
  } catch (error) {
    console.error('메시지 개수 조회 중 오류 발생:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers: CORS_HEADERS });
  }
} 