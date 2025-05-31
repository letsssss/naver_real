import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
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
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, '', ...options, maxAge: 0 });
        },
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logDebug('❌ 인증 실패:', userError?.message);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    const { order_number } = params;
    if (!order_number) {
      return NextResponse.json({ error: '주문 번호가 필요합니다.' }, { status: 400 });
    }

    logDebug('✅ 인증 성공: 사용자 ID', user.id);

    // 채팅방 정보 조회
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('order_number', order_number)
      .single();

    if (roomError) {
      logDebug('❌ 채팅방 조회 오류:', roomError.message);
      return NextResponse.json(
        { error: '채팅방을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용자가 해당 채팅방에 접근 권한이 있는지 확인
    if (room.buyer_id !== user.id && room.seller_id !== user.id) {
      logDebug('❌ 권한 없음:', user.id);
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 메시지 목록 조회
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
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
        .eq('room_id', room.id)
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
      roomId: room.id,
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