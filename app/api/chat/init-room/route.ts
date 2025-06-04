// 목적: 거래(orderNumber) 기반으로 채팅방을 자동 생성하거나 반환합니다.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
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
    // Supabase 관리자 클라이언트 생성
    const supabase = createAdminClient();
    
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

    logDebug('🔍 주문 번호:', finalOrderNumber);

    // 구매 내역 확인
    logDebug('📊 구매 내역 조회 시작...');
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, buyer_id, seller_id, order_number')
      .eq('order_number', finalOrderNumber)
      .single();

    if (purchaseError || !purchase) {
      logDebug('❌ 구매 내역 조회 오류:', {
        error: purchaseError?.message,
        code: purchaseError?.code,
        orderNumber: finalOrderNumber
      });
      return NextResponse.json(
        { error: '해당 주문 번호의 구매 내역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    logDebug('✅ 구매 내역 조회 성공:', {
      purchaseId: purchase.id,
      buyerId: purchase.buyer_id,
      sellerId: purchase.seller_id,
      orderNumber: purchase.order_number
    });

    // 채팅방 접근 권한 확인
    const isBuyer = user.id === purchase.buyer_id;
    const isSeller = user.id === purchase.seller_id;
    const isAuthorized = isBuyer || isSeller;
    
    logDebug('🔐 권한 확인:', {
      currentUserId: user.id,
      buyerId: purchase.buyer_id,
      sellerId: purchase.seller_id,
      isBuyer,
      isSeller,
      isAuthorized
    });
    
    if (!isAuthorized) {
      logDebug('❌ 권한 없음 - 사용자가 구매자도 판매자도 아님');
      return NextResponse.json(
        { error: '이 주문에 대한 채팅 권한이 없습니다.' },
        { status: 403 }
      );
    }

    logDebug('✅ 권한 확인 통과 -', isBuyer ? '구매자' : '판매자');

    // 🔍 먼저 기존 채팅방이 있는지 확인
    logDebug('🔍 기존 채팅방 확인 중...');
    const { data: existingRoom, error: findError } = await supabase
      .from('rooms')
      .select('id, order_number, buyer_id, seller_id, created_at')
      .eq('order_number', finalOrderNumber)
      .maybeSingle(); // single() 대신 maybeSingle() 사용하여 없어도 오류 안 남

    if (findError) {
      logDebug('❌ 기존 채팅방 조회 오류:', {
        error: findError.message,
        code: findError.code
      });
      return NextResponse.json(
        { error: '채팅방 정보 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 기존 채팅방이 있으면 바로 반환
    if (existingRoom) {
      logDebug('✅ 기존 채팅방 발견:', {
        roomId: existingRoom.id,
        orderNumber: existingRoom.order_number,
        buyerId: existingRoom.buyer_id,
        sellerId: existingRoom.seller_id,
        createdAt: existingRoom.created_at
      });
      return NextResponse.json(
        { roomId: existingRoom.id },
        { status: 200 }
      );
    }

    // 🔄 새 채팅방 생성 (unique constraint에 의해 중복 방지됨)
    logDebug('🏗️ 새 채팅방 생성 시작...');
    
    const roomId = crypto.randomUUID();
    const roomData = {
      id: roomId,
      order_number: finalOrderNumber,
      buyer_id: purchase.buyer_id,
      seller_id: purchase.seller_id,
      purchase_id: purchase.id,
    };
    
    logDebug('📝 채팅방 데이터 준비:', roomData);

    const { data: newRoom, error: createError } = await supabase
      .from('rooms')
      .insert(roomData)
      .select('id, order_number, buyer_id, seller_id, created_at')
      .single();

    if (createError) {
      // unique constraint 위반인 경우 (동시 요청으로 인한 race condition)
      if (createError.code === '23505') {
        logDebug('🔄 동시 생성 감지, 기존 채팅방 조회...');
        
        // 다시 기존 채팅방 조회
        const { data: raceConditionRoom, error: raceError } = await supabase
          .from('rooms')
          .select('id, order_number, buyer_id, seller_id, created_at')
          .eq('order_number', finalOrderNumber)
          .single();

        if (raceError || !raceConditionRoom) {
          logDebug('❌ Race condition 후 채팅방 조회 실패:', raceError?.message);
          return NextResponse.json(
            { error: '채팅방 생성 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }

        logDebug('✅ Race condition 해결 - 기존 채팅방 사용:', {
          roomId: raceConditionRoom.id,
          orderNumber: raceConditionRoom.order_number
        });

        return NextResponse.json(
          { roomId: raceConditionRoom.id },
          { status: 200 }
        );
      }

      // 기타 생성 오류
      logDebug('❌ 채팅방 생성 오류:', {
        error: createError.message,
        code: createError.code,
        details: createError.details
      });
      return NextResponse.json(
        { error: '채팅방을 생성하는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    logDebug('✅ 새 채팅방 생성 완료:', {
      roomId: newRoom.id,
      orderNumber: newRoom.order_number,
      buyerId: newRoom.buyer_id,
      sellerId: newRoom.seller_id,
      createdAt: newRoom.created_at
    });

    return NextResponse.json(
      { roomId: newRoom.id },
      { status: 201 }
    );

  } catch (error: any) {
    logDebug('❌ 서버 오류:', {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}