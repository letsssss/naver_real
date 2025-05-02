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
    console.log('🔍 unread-count API 호출됨');
    console.log(`📝 요청 URL: ${req.url}`);
    console.log(`📝 요청 헤더: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
    
    // 사용자 인증 확인
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ 토큰이 없음');
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401, headers: CORS_HEADERS });
    }
    
    console.log('🔑 토큰 검증 시작');
    console.log(`🔑 토큰 길이: ${token.length}, 토큰 미리보기: ${token.substring(0, 20)}...`);
    
    try {
      const { id: userId, authenticated } = await verifyToken(token);
      console.log(`🔐 인증 결과: userId=${userId}, authenticated=${authenticated}`);
      
      if (!authenticated || !userId) {
        console.log('❌ 인증 실패');
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401, headers: CORS_HEADERS });
      }
      
      // Supabase 클라이언트 생성
      const supabase = createRouteHandlerClient({ cookies });
      
      // URL에서 orderNumber 파라미터 확인
      const url = new URL(req.url);
      const orderNumber = url.searchParams.get('orderNumber');
      console.log(`📝 요청 파라미터: orderNumber=${orderNumber || 'null'}`);
      
      // 쿼리 생성
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact' })
        .eq('recipient_id', userId)
        .eq('is_read', false);
      
      // 주문번호 파라미터가 있는 경우 로그 확인
      if (orderNumber) {
        console.log(`🔍 주문번호 확인: ${orderNumber}, 타입: ${typeof orderNumber}`);
      }
      
      // 특정 주문번호에 대한 메시지만 필터링
      if (orderNumber) {
        console.log(`🔍 주문번호로 룸 조회: ${orderNumber}`);
        
        // 먼저 rooms 테이블의 모든 데이터 살펴보기
        const { data: allRooms, error: allRoomsError } = await supabase
          .from('rooms')
          .select('id, order_number')
          .limit(5);
          
        if (allRoomsError) {
          console.error('🚨 전체 룸 조회 오류:', allRoomsError);
        } else {
          console.log('📊 rooms 테이블 데이터 샘플:', allRooms);
        }
        
        // 실제 주문번호로 룸 조회
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('id')
          .eq('order_number', orderNumber)
          .single();
        
        if (roomError) {
          console.error('🚨 룸 데이터 조회 오류:', roomError);
          
          // 다른 필드명으로도 시도
          console.log('🔄 다른 필드명으로 룸 조회 시도...');
          
          // order_id로 시도
          const { data: roomByOrderId, error: orderIdError } = await supabase
            .from('rooms')
            .select('id')
            .eq('order_id', orderNumber)
            .single();
            
          if (!orderIdError && roomByOrderId) {
            console.log(`🏠 order_id로 룸 찾음: room_id=${roomByOrderId.id}`);
            query = query.eq('room_id', roomByOrderId.id);
          } else {
            console.log('⚠️ order_id로도 룸을 찾을 수 없음:', orderIdError);
          }
        }
        
        if (roomData?.id) {
          console.log(`🏠 룸 찾음: room_id=${roomData.id}`);
          query = query.eq('room_id', roomData.id);
        } else {
          console.log('⚠️ 해당 주문번호의 룸을 찾을 수 없음');
          // 룸을 찾을 수 없으면 빈 결과 반환
          return NextResponse.json({ 
            count: 0,
            orderNumber: orderNumber || null
          }, { headers: CORS_HEADERS });
        }
      }
      
      // 쿼리 실행
      console.log('🔍 최종 쿼리 실행 전...');
      const { count, error } = await query;
      
      if (error) {
        console.error('🚨 메시지 개수 조회 오류:', error);
        return NextResponse.json({ error: '메시지 개수를 조회할 수 없습니다.' }, { status: 500, headers: CORS_HEADERS });
      }
      
      console.log(`✅ 메시지 개수 조회 결과: ${count}`);
      
      // 결과 반환
      return NextResponse.json({ 
        count: count || 0,
        orderNumber: orderNumber || null
      }, { headers: CORS_HEADERS });
    } catch (verifyError) {
      console.error('🚨 토큰 검증 오류:', verifyError);
      return NextResponse.json({ error: '인증 정보가 유효하지 않습니다.' }, { status: 401, headers: CORS_HEADERS });
    }
  } catch (error) {
    console.error('🚨 메시지 개수 조회 중 오류 발생:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers: CORS_HEADERS });
  }
} 