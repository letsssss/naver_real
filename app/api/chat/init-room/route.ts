// 목적: 거래(orderNumber) 기반으로 채팅방을 자동 생성하거나 반환합니다.

import { NextRequest, NextResponse } from 'next/server';
// import { nanoid } from 'nanoid'; // 더 이상 사용하지 않음
import { getSupabaseClient } from '@/lib/supabase';
import type { Database } from '@/types/supabase.types';

// Node.js 런타임 사용 (Edge에서는 환경변수 로딩 문제 발생)
export const runtime = 'nodejs';

// 로깅 함수
const logDebug = (message: string, data?: any) => {
  console.log(`[API:init-room] ${message}`, data ? data : '');
};

export async function POST(request: NextRequest) {
  logDebug('API 호출됨');
  
  try {
    // Supabase 클라이언트 생성
    const supabase = await getSupabaseClient();
    
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    let accessToken = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
    
    // 토큰이 없으면 쿠키에서 찾기
    if (!accessToken) {
      const cookies = request.headers.get('cookie');
      if (cookies) {
        const cookieMatch = cookies.match(/sb-[^-]+-auth-token=([^;]+)/);
        if (cookieMatch) {
          try {
            const tokenData = JSON.parse(decodeURIComponent(cookieMatch[1]));
            accessToken = tokenData.access_token;
          } catch (e) {
            logDebug('쿠키에서 토큰 파싱 실패:', e);
          }
        }
      }
    }
    
    if (!accessToken) {
      logDebug('❌ 토큰 없음');
      return NextResponse.json(
        { error: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }
    
    // 토큰으로 사용자 정보 가져오기
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    // 인증 실패 처리
    if (authError || !user) {
      logDebug('❌ 인증 실패:', authError?.message);
      return NextResponse.json(
        { error: '인증에 실패했습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }
    
    logDebug('✅ 인증 성공: 사용자 ID', user.id);

    // 요청 본문에서 주문 번호 가져오기
    const body = await request.json();
    const { orderNumber, order_number } = body;
    
    // orderNumber나 order_number 중 하나 사용
    const finalOrderNumber = orderNumber || order_number;

    if (!finalOrderNumber) {
      logDebug('❌ 주문 번호 누락');
      return NextResponse.json(
        { error: '주문 번호가 필요합니다.' },
        { status: 400 }
      );
    }

    logDebug('주문 번호:', finalOrderNumber);

    // 구매 내역 확인
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, buyer_id, seller_id, order_number')
      .eq('order_number', finalOrderNumber)
      .single();

    if (purchaseError || !purchase) {
      logDebug('❌ 구매 내역 조회 오류:', purchaseError?.message);
      return NextResponse.json(
        { error: '해당 주문 번호의 구매 내역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 채팅방 접근 권한 확인
    const isAuthorized = user.id === purchase.buyer_id || user.id === purchase.seller_id;
    
    if (!isAuthorized) {
      logDebug('❌ 권한 없음:', user.id);
      return NextResponse.json(
        { error: '이 주문에 대한 채팅 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 이미 존재하는 채팅방 확인
    const { data: existingRoom, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('order_number', finalOrderNumber)
      .single();

    if (roomError && roomError.code !== 'PGRST116') {
      logDebug('❌ 채팅방 조회 오류:', roomError.message);
      return NextResponse.json(
        { error: '채팅방 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 기존 채팅방이 있으면 반환
    if (existingRoom) {
      logDebug('✅ 기존 채팅방 발견:', existingRoom.id);
      return NextResponse.json(
        { roomId: existingRoom.id },
        { status: 200 }
      );
    }

    // 새 채팅방 생성
    const roomId = crypto.randomUUID(); // nanoid() 대신 표준 UUID 생성
    const { error: createError } = await supabase
      .from('rooms')
      .insert({
        id: roomId,
        order_number: finalOrderNumber,
        buyer_id: purchase.buyer_id,
        seller_id: purchase.seller_id,
      });

    if (createError) {
      logDebug('❌ 채팅방 생성 오류:', createError.message);
      return NextResponse.json(
        { error: '채팅방을 생성하는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    logDebug('✅ 새 채팅방 생성됨:', roomId);
    return NextResponse.json(
      { roomId },
      { status: 201 }
    );

  } catch (error: any) {
    logDebug('❌ 서버 오류:', error.message);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}