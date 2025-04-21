import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyToken } from '@/lib/auth';

// 메시지 API 핸들러
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, senderId, receiverId, purchaseId } = body;

    if (!content || !senderId) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const tokenUserId = parseInt(decoded.userId.toString());
    const requestSenderId = parseInt(senderId.toString());
    if (tokenUserId !== requestSenderId) {
      return NextResponse.json({ error: '토큰 사용자와 발신자 ID 불일치' }, { status: 403 });
    }

    let finalReceiverId = receiverId ? parseInt(receiverId.toString()) : null;
    let roomId: number | null = null;

    // 1️⃣ 구매 ID로 채팅방 조회 or 생성
    if (purchaseId) {
      const purchaseRes = await supabase
        .from('purchases')
        .select('id, buyer_id, seller_id')
        .eq(typeof purchaseId === 'number' ? 'id' : 'order_number', purchaseId)
        .maybeSingle();

      if (purchaseRes.error || !purchaseRes.data) {
        return NextResponse.json({ error: '유효하지 않은 구매 정보' }, { status: 400 });
      }

      const { id: purchase_id, buyer_id, seller_id } = purchaseRes.data;

      const roomRes = await supabase
        .from('rooms')
        .select('id')
        .eq('purchase_id', purchase_id)
        .maybeSingle();

      if (roomRes.error) throw roomRes.error;

      // 없으면 생성
      if (!roomRes.data) {
        const createRoom = await supabase
          .from('rooms')
          .insert({ name: `purchase_${purchase_id}`, purchase_id })
          .select()
          .maybeSingle();

        if (createRoom.error || !createRoom.data) {
          return NextResponse.json({ error: '채팅방 생성 실패' }, { status: 500 });
        }

        roomId = createRoom.data.id;

        // 참여자 등록
        await supabase.from('room_participants').insert([
          { room_id: roomId, user_id: buyer_id },
          { room_id: roomId, user_id: seller_id },
        ]);
      } else {
        roomId = roomRes.data.id;
      }

      if (!finalReceiverId) {
        finalReceiverId = buyer_id === requestSenderId ? seller_id : buyer_id;
      }
    }

    // 2️⃣ 메시지 저장
    const messageInsert = await supabase
      .from('messages')
      .insert({
        content,
        sender_id: requestSenderId,
        receiver_id: finalReceiverId,
        room_id: roomId,
        purchase_id: purchaseId ?? null,
      })
      .select('id')
      .single();

    if (messageInsert.error) {
      console.error('메시지 저장 실패:', messageInsert.error);
      return NextResponse.json({ error: '메시지 저장 실패' }, { status: 500 });
    }

    // 3️⃣ 채팅방 최신 정보 업데이트
    if (roomId) {
      await supabase
        .from('rooms')
        .update({ last_chat: content, time_of_last_chat: new Date().toISOString() })
        .eq('id', roomId);
    }

    return NextResponse.json({
      success: true,
      messageId: messageInsert.data.id,
      message: '메시지가 전송되었습니다.',
    });
  } catch (error: any) {
    console.error('POST 메시지 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

// 메시지 조회 핸들러
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');
    const purchaseId = searchParams.get('purchaseId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 인증 토큰 검증
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
    
    const userId = parseInt(decoded.userId.toString());
    
    // 방 ID 또는 구매 ID로 메시지 조회
    if (roomId) {
      const roomIdInt = parseInt(roomId);
      if (isNaN(roomIdInt)) {
        return NextResponse.json(
          { error: '유효하지 않은 채팅방 ID입니다.' },
          { status: 400 }
        );
      }
      
      // 사용자가 해당 채팅방의 참여자인지 확인
      const { data: participant, error: participantError } = await supabase
        .from('room_participants')
        .select('id')
        .eq('room_id', roomIdInt)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (participantError) {
        console.error('참여자 확인 오류:', participantError);
        return NextResponse.json(
          { error: '채팅방 접근 권한 확인 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      if (!participant) {
        return NextResponse.json(
          { error: '채팅방에 접근할 권한이 없습니다.' },
          { status: 403 }
        );
      }
      
      // 메시지 조회
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id, 
          content, 
          created_at, 
          is_read,
          sender_id, 
          receiver_id,
          sender:users!sender_id (id, name, profile_image),
          receiver:users!receiver_id (id, name, profile_image)
        `)
        .eq('room_id', roomIdInt)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (messagesError) {
        console.error('메시지 조회 오류:', messagesError);
        return NextResponse.json(
          { error: '메시지 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      // 읽지 않은 메시지 업데이트
      const unreadMessageIds = messages
        ?.filter(msg => msg.sender_id !== userId && !msg.is_read)
        .map(msg => msg.id) || [];
      
      if (unreadMessageIds.length > 0) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessageIds);
      }
      
      return NextResponse.json({
        success: true,
        messages: (messages || []).map(msg => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.sender_id,
          receiverId: msg.receiver_id,
          createdAt: msg.created_at,
          isRead: msg.is_read,
          sender: msg.sender,
          receiver: msg.receiver
        })).reverse() // 최신 메시지가 아래로 가도록 역순 정렬
      });
      
    } else if (purchaseId) {
      // 구매 ID로 메시지 조회
      let purchaseData;
      
      // 구매 정보 조회
      if (!isNaN(Number(purchaseId))) {
        // 숫자인 경우 id로 조회
        const { data, error } = await supabase
          .from('purchases')
          .select('id, buyer_id, seller_id')
          .eq('id', parseInt(purchaseId))
          .maybeSingle();
          
        if (error) {
          console.error('구매 정보 조회 오류:', error);
          return NextResponse.json(
            { error: '구매 정보 조회 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
        
        purchaseData = data;
      } else {
        // 문자열인 경우 order_number로 조회
        const { data, error } = await supabase
          .from('purchases')
          .select('id, buyer_id, seller_id')
          .eq('order_number', purchaseId)
          .maybeSingle();
          
        if (error) {
          console.error('구매 정보 조회 오류:', error);
          return NextResponse.json(
            { error: '구매 정보 조회 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
        
        purchaseData = data;
      }
      
      if (!purchaseData) {
        return NextResponse.json(
          { error: '유효하지 않은 구매 ID 또는 주문번호입니다.' },
          { status: 400 }
        );
      }
      
      // 사용자가 해당 구매의 구매자 또는 판매자인지 확인
      if (purchaseData.buyer_id !== userId && purchaseData.seller_id !== userId) {
        return NextResponse.json(
          { error: '해당 거래에 접근할 권한이 없습니다.' },
          { status: 403 }
        );
      }
      
      // 메시지 조회
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id, 
          content, 
          created_at, 
          is_read,
          sender_id, 
          receiver_id,
          sender:users!sender_id (id, name, profile_image),
          receiver:users!receiver_id (id, name, profile_image)
        `)
        .eq('purchase_id', purchaseData.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (messagesError) {
        console.error('메시지 조회 오류:', messagesError);
        return NextResponse.json(
          { error: '메시지 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        messages: (messages || []).map(msg => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.sender_id,
          receiverId: msg.receiver_id,
          createdAt: msg.created_at,
          isRead: msg.is_read,
          sender: msg.sender,
          receiver: msg.receiver
        })).reverse() // 최신 메시지가 아래로 가도록 역순 정렬
      });
      
    } else {
      // roomId나 purchaseId 중 하나는 필수
      return NextResponse.json(
        { error: 'roomId 또는 purchaseId 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] 메시지 조회 오류:', error);
    return NextResponse.json(
      { 
        error: '메시지 조회 중 오류가 발생했습니다.',
        details: error.message
      },
      { status: 500 }
    );
  }
} 