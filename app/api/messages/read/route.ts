import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

// 메시지 읽음 상태 업데이트 API 핸들러
export async function POST(request: NextRequest) {
  try {
    // 1. 요청 본문 파싱
    const body = await request.json();
    const { roomId, userId } = body;
    
    // 2. 필수 필드 검증
    if (!roomId || !userId) {
      return NextResponse.json(
        { error: '필수 항목이 누락되었습니다 (roomId, userId 필수)' },
        { status: 400 }
      );
    }
    
    // 3. 인증 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증되지 않은 요청입니다.' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }
    
    // 4. 토큰의 사용자 ID와 요청 본문의 사용자 ID가 일치하는지 확인
    const tokenUserId = parseInt(decoded.userId.toString());
    const requestUserId = parseInt(userId.toString());
    
    if (tokenUserId !== requestUserId) {
      return NextResponse.json(
        { error: '토큰의 사용자 ID와 요청한 사용자 ID가 일치하지 않습니다.' },
        { status: 403 }
      );
    }
    
    // 5. 읽지 않은 메시지 조회 및 업데이트
    const roomIdInt = parseInt(roomId);
    
    // 방 존재 여부 확인 및 사용자가 해당 방의 참여자인지 확인
    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('id')
      .eq('room_id', roomIdInt)
      .eq('user_id', requestUserId)
      .maybeSingle();
    
    if (participantError) {
      console.error('참여자 확인 오류:', participantError);
      return NextResponse.json(
        { error: '채팅방 참여자 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    if (!participant) {
      return NextResponse.json(
        { error: '해당 채팅방에 접근할 권한이 없습니다.' },
        { status: 403 }
      );
    }
    
    // 읽지 않은 메시지 조회
    const { data: unreadMessages, error: selectError } = await supabase
      .from('messages')
      .select('id')
      .eq('room_id', roomIdInt)
      .eq('receiver_id', requestUserId)
      .eq('is_read', false);
    
    if (selectError) {
      console.error('읽지 않은 메시지 조회 오류:', selectError);
      return NextResponse.json(
        { error: '읽지 않은 메시지 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    if (!unreadMessages || unreadMessages.length === 0) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: '읽지 않은 메시지가 없습니다.'
      });
    }
    
    // 읽지 않은 메시지 업데이트
    const messageIds = unreadMessages.map(msg => msg.id);
    const { error: updateError } = await supabase
      .from('messages')
      .update({ is_read: true })
      .in('id', messageIds);
    
    if (updateError) {
      console.error('메시지 읽음 상태 업데이트 오류:', updateError);
      return NextResponse.json(
        { error: '메시지 읽음 상태 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      updatedCount: messageIds.length,
      message: '메시지 읽음 상태가 업데이트되었습니다.'
    });
    
  } catch (error: any) {
    console.error('[API] 메시지 읽음 상태 업데이트 오류:', error);
    return NextResponse.json(
      { 
        error: '메시지 읽음 상태 업데이트 중 오류가 발생했습니다.',
        details: error.message
      },
      { status: 500 }
    );
  }
} 