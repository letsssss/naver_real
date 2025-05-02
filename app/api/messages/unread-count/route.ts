import { NextResponse, NextRequest } from 'next/server';
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
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
    
    // URL에서 파라미터 추출
    const url = new URL(req.url);
    const orderNumber = url.searchParams.get('orderNumber');
    const userIdParam = url.searchParams.get('userId');
    
    console.log(`📝 요청 파라미터: orderNumber=${orderNumber || 'null'}, userId=${userIdParam || 'null'}`);
    
    // 다양한 방식으로 토큰 추출
    let token = req.headers.get('Authorization')?.replace('Bearer ', '');
    
    // 쿠키에서도 토큰을 추출 시도
    const cookieStr = req.headers.get('cookie') || '';
    const cookieTokenMatch = cookieStr.match(/sb-[\w]+-auth-token=%5B%22([^%]+)%/);
    const cookieToken = cookieTokenMatch ? cookieTokenMatch[1] : null;
    
    if (!token && cookieToken) {
      token = cookieToken;
      console.log('🔑 쿠키에서 토큰 추출됨');
    }
    
    console.log('🔑 토큰 검증 시작');
    
    let userId = userIdParam;
    
    // 토큰이 있으면 검증
    if (token) {
      console.log(`🔑 토큰 길이: ${token.length}, 토큰 미리보기: ${token.substring(0, 20)}...`);
      
      try {
        const { id: tokenUserId, authenticated } = await verifyToken(token);
        console.log(`🔐 인증 결과: userId=${tokenUserId}, authenticated=${authenticated}`);
        
        // URL에서 받은 userId가 없으면 토큰에서 추출한 userId 사용
        if (!userId && authenticated && tokenUserId) {
          userId = tokenUserId;
          console.log(`👤 토큰에서 userId 추출: ${userId}`);
        }
      } catch (verifyError) {
        console.error('🚨 토큰 검증 오류:', verifyError);
        // 토큰 검증 실패 시 URL의 userId 파라미터를 계속 사용
      }
    }
    
    // userId 파라미터가 없으면 401 응답
    if (!userId) {
      console.log('❌ userId가 없어 인증 실패');
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401, headers: CORS_HEADERS });
    }
    
    console.log(`👤 최종 사용할 userId: ${userId}`);
    
    // Supabase 클라이언트 생성
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 쿼리 생성
    let query = supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    
    // 주문번호 파라미터가 있는 경우
    if (orderNumber) {
      console.log(`🔍 주문번호로 룸 조회: ${orderNumber}`);
      
      // 먼저 rooms 테이블에서 room_id 조회
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .or(`order_number.eq.${orderNumber},order_id.eq.${orderNumber}`)
        .maybeSingle();
      
      if (roomError) {
        console.error('🚨 룸 데이터 조회 오류:', roomError);
        
        // 다른 필드명으로도 시도
        console.log('🔄 다른 필드명으로 룸 조회 시도...');
        
        const { data: roomByOrderId, error: orderIdError } = await supabase
          .from('rooms')
          .select('id')
          .eq('order_id', orderNumber)
          .maybeSingle();
          
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
    
  } catch (error) {
    console.error('🚨 메시지 개수 조회 중 오류 발생:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers: CORS_HEADERS });
  }
} 