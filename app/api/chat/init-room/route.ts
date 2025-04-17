// 목적: 거래(orderNumber) 기반으로 채팅방을 자동 생성하거나 반환합니다.

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import supabaseAdmin from '@/lib/supabase-admin';

// Node.js 런타임 사용 (Edge에서는 환경변수 로딩 문제 발생)
export const runtime = 'nodejs';

// 로깅 함수
const logDebug = (message: string, data?: any) => {
  console.log(`[API:init-room] ${message}`, data ? data : '');
};

export async function POST(request: NextRequest) {
  logDebug('API 호출됨');
  
  try {
    // 쿠키에서 Supabase 세션 토큰 가져오기
    const authToken = request.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token')?.value;
    const accessToken = request.cookies.get('sb-jdubrjczdyqqtsppojgu-access-token')?.value;
    
    logDebug('인증 쿠키 확인:', {
      authToken: authToken ? '✅' : '❌',
      accessToken: accessToken ? '✅' : '❌'
    });
    
    // 현재 인증된 사용자 가져오기
    let user;
    
    // 1. 먼저 쿠키로 시도
    if (accessToken) {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
      if (!error && data.user) {
        user = data.user;
        logDebug('✅ 쿠키에서 인증 성공:', user.id);
      } else if (error) {
        logDebug('❌ 쿠키 인증 오류:', error.message);
      }
    }
    
    // 2. 쿠키가 없거나 실패한 경우 헤더 확인
    if (!user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && data.user) {
          user = data.user;
          logDebug('✅ 헤더에서 인증 성공:', user.id);
        } else if (error) {
          logDebug('❌ 헤더 인증 오류:', error.message);
        }
      }
    }
    
    // 인증 실패 처리
    if (!user) {
      logDebug('❌ 인증 실패: 사용자를 찾을 수 없음');
      return NextResponse.json(
        { error: '인증에 실패했습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    // 요청 본문에서 주문 번호 가져오기
    const body = await request.json();
    const { orderNumber } = body;

    if (!orderNumber) {
      logDebug('❌ 주문 번호 누락');
      return NextResponse.json(
        { error: '주문 번호가 필요합니다.' },
        { status: 400 }
      );
    }

    logDebug('주문 번호:', orderNumber);

    // 구매 내역 확인
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .select('id, buyer_id, seller_id, order_number')
      .eq('order_number', orderNumber)
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
    const { data: existingRoom, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('order_number', orderNumber)
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
    const roomId = nanoid();
    const { error: createError } = await supabaseAdmin
      .from('rooms')
      .insert({
        id: roomId,
        order_number: orderNumber,
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