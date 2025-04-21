import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// Node.js 런타임 사용 (Edge에서는 환경변수 로딩 문제 발생)
export const runtime = 'nodejs';

// 로깅 함수
const logDebug = (message: string, data?: any) => {
  console.log(`[API:messages] ${message}`, data ? data : '');
};

/**
 * 특정 주문에 대한 메시지 목록을 조회하는 API
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { order_number: string } }
) {
  const orderNumber = params.order_number;
  logDebug(`GET 요청 시작: ${orderNumber}`);

  try {
    // 쿠키 기반 Supabase 클라이언트 생성
    const supabase = createServerComponentClient<Database>({ cookies });
    
    // 세션 확인 (쿠키에서 자동으로 세션 읽음)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // 인증 실패 처리
    if (authError || !user) {
      logDebug('❌ 인증 실패:', authError?.message);
      return NextResponse.json(
        { error: '인증에 실패했습니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }
    
    logDebug('✅ 인증 성공: 사용자 ID', user.id);

    // 주문 번호로 채팅방 ID 조회
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('id, buyer_id, seller_id')
      .eq('order_number', orderNumber)
      .single();

    if (roomError || !roomData) {
      logDebug('❌ 채팅방 조회 오류:', roomError?.message);
      return NextResponse.json(
        { error: '해당 주문 번호의 채팅방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 채팅방 접근 권한 확인
    const isAuthorized = user.id === roomData.buyer_id || user.id === roomData.seller_id;
    
    if (!isAuthorized) {
      logDebug('❌ 권한 없음:', user.id);
      return NextResponse.json(
        { error: '이 채팅방에 대한 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 메시지 조회
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        sender_id,
        receiver_id,
        is_read,
        created_at,
        sender:sender_id(id, name, profile_image)
      `)
      .eq('room_id', roomData.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      logDebug('❌ 메시지 조회 오류:', messagesError.message);
      return NextResponse.json(
        { error: '메시지 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 메시지 읽음 상태 업데이트
    const unreadMessages = messages?.filter(
      msg => !msg.is_read && msg.sender_id !== user.id
    ) || [];

    if (unreadMessages.length > 0) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', roomData.id)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (updateError) {
        logDebug('⚠️ 메시지 읽음 상태 업데이트 오류:', updateError.message);
        // 읽음 처리 실패해도 메시지 조회 결과는 반환
      } else {
        logDebug('✅ 메시지 읽음 상태 업데이트 성공: 읽은 메시지 수', unreadMessages.length);
      }
    }

    // API 응답
    return NextResponse.json({
      success: true,
      roomId: roomData.id,
      messages: messages || []
    });

  } catch (error: any) {
    logDebug('❌ 서버 오류:', error.message);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 