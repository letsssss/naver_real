import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
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
    
    console.log("🔥 sender_id:", requestSenderId);
    console.log("🧑‍💻 auth.uid():", tokenUserId);
    
    // sender_id를 토큰의 사용자 ID로 강제 대입
    const fixedSenderId = tokenUserId;
    
    if (tokenUserId !== requestSenderId) {
      console.log("⚠️ 토큰 사용자와 발신자 ID 불일치 - 강제 대입됨");
    }

    let finalReceiverId = receiverId ? parseInt(receiverId.toString()) : null;
    let roomId: string | null = null;

    // 1️⃣ 구매 ID로 채팅방 조회 or 생성
    if (purchaseId) {
      const purchaseRes = await createAdminClient()
        .from('purchases')
        .select('id, buyer_id, seller_id')
        .eq(typeof purchaseId === 'number' ? 'id' : 'order_number', purchaseId)
        .maybeSingle();

      if (purchaseRes.error || !purchaseRes.data) {
        return NextResponse.json({ error: '유효하지 않은 구매 정보' }, { status: 400 });
      }

      const { id: purchase_id, buyer_id, seller_id } = purchaseRes.data;

      const roomRes = await createAdminClient()
        .from('rooms')
        .select('id')
        .eq('purchase_id', purchase_id)
        .maybeSingle();

      if (roomRes.error) throw roomRes.error;

      // 없으면 생성
      if (!roomRes.data) {
        const roomUuid = crypto.randomUUID();
        const createRoom = await createAdminClient()
          .from('rooms')
          .insert({ 
            id: roomUuid,
            buyer_id, 
            seller_id, 
            purchase_id 
          })
          .select()
          .maybeSingle();

        if (createRoom.error || !createRoom.data) {
          return NextResponse.json({ error: '채팅방 생성 실패' }, { status: 500 });
        }

        roomId = createRoom.data.id;
      } else {
        roomId = roomRes.data.id;
      }

      if (!finalReceiverId) {
        finalReceiverId = buyer_id === fixedSenderId ? seller_id : buyer_id;
      }
    }

    // 2️⃣ 메시지 저장
    const messageInsert = await createAdminClient()
      .from('messages')
      .insert({
        content,
        sender_id: fixedSenderId,
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
      await createAdminClient()
        .from('rooms')
        .update({ 
          last_chat: content, 
          time_of_last_chat: new Date().toISOString() 
        })
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
    const orderNumber = searchParams.get('orderNumber');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    console.log('[Messages API] 🔍 GET 요청:', { roomId, purchaseId, orderNumber, limit, offset });
    
    // 인증 토큰 검증
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Messages API] ❌ 인증 헤더 없음');
      return NextResponse.json(
        { error: '인증되지 않은 요청입니다.' },
        { status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      console.log('[Messages API] ❌ 토큰 검증 실패');
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }
    
    const userId = decoded.userId.toString();
    console.log('[Messages API] ✅ 인증 성공:', userId);
    
    // order_number로 조회하는 경우
    if (orderNumber) {
      console.log('[Messages API] 🔍 주문번호로 메시지 조회:', orderNumber);
      
      // 주문번호로 채팅방 조회
      const { data: roomData, error: roomError } = await createAdminClient()
        .from('rooms')
        .select('id, buyer_id, seller_id, order_number, purchase_id')
        .eq('order_number', orderNumber)
        .single();

      if (roomError || !roomData) {
        console.log('[Messages API] ❌ 채팅방 조회 실패:', roomError?.message);
        return NextResponse.json(
          { error: '해당 주문번호의 채팅방을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      console.log('[Messages API] ✅ 채팅방 조회 성공:', {
        roomId: roomData.id,
        buyerId: roomData.buyer_id,
        sellerId: roomData.seller_id,
        orderNumber: roomData.order_number
      });

      // 권한 확인: 현재 사용자가 구매자 또는 판매자인지 확인
      const isBuyer = roomData.buyer_id === userId;
      const isSeller = roomData.seller_id === userId;
      const hasAccess = isBuyer || isSeller;

      console.log('[Messages API] 🔐 권한 확인:', {
        userId,
        buyerId: roomData.buyer_id,
        sellerId: roomData.seller_id,
        isBuyer,
        isSeller,
        hasAccess
      });

      if (!hasAccess) {
        console.log('[Messages API] ❌ 접근 권한 없음');
        return NextResponse.json(
          { error: '이 채팅방에 접근할 권한이 없습니다.' },
          { status: 403 }
        );
      }

      // 메시지 조회 (모든 메시지 조회 - 발신자 구분 없이)
      console.log('[Messages API] 📨 메시지 조회 시작:', roomData.id);
      const { data: messages, error: messagesError } = await createAdminClient()
        .from('messages')
        .select(`
          id, 
          content, 
          created_at, 
          is_read,
          sender_id, 
          receiver_id,
          sender:users!messages_sender_id_fkey(id, name, profile_image),
          receiver:users!messages_receiver_id_fkey(id, name, profile_image)
        `)
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (messagesError) {
        console.error('[Messages API] ❌ 메시지 조회 오류:', messagesError);
        return NextResponse.json(
          { error: '메시지 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }

      console.log('[Messages API] ✅ 메시지 조회 성공:', {
        count: messages?.length || 0,
        roomId: roomData.id
      });

      // 읽지 않은 메시지 업데이트 (현재 사용자가 받은 메시지만)
      const unreadMessageIds = messages
        ?.filter(msg => msg.receiver_id === userId && !msg.is_read)
        .map(msg => msg.id) || [];

      if (unreadMessageIds.length > 0) {
        console.log('[Messages API] 📖 미읽음 메시지 읽음 처리:', unreadMessageIds.length);
        await createAdminClient()
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessageIds);
      }

      return NextResponse.json({
        success: true,
        roomId: roomData.id,
        messages: (messages || []).map(msg => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.sender_id,
          receiverId: msg.receiver_id,
          createdAt: msg.created_at,
          isRead: msg.is_read,
          sender: msg.sender,
          receiver: msg.receiver,
          isMine: msg.sender_id === userId
        }))
      });
    }
    
    // roomId로 직접 조회하는 경우 (기존 로직 유지하되 room_participants 대신 rooms 테이블 직접 사용)
    if (roomId) {
      console.log('[Messages API] 🔍 roomId로 메시지 조회:', roomId);
      
      // 채팅방 조회 및 권한 확인
      const { data: roomData, error: roomError } = await createAdminClient()
        .from('rooms')
        .select('id, buyer_id, seller_id, order_number, purchase_id')
        .eq('id', roomId)
        .single();

      if (roomError || !roomData) {
        console.log('[Messages API] ❌ 채팅방 조회 실패:', roomError?.message);
        return NextResponse.json(
          { error: '채팅방을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      // 권한 확인
      const hasAccess = roomData.buyer_id === userId || roomData.seller_id === userId;
      if (!hasAccess) {
        console.log('[Messages API] ❌ 채팅방 접근 권한 없음');
        return NextResponse.json(
          { error: '채팅방에 접근할 권한이 없습니다.' },
          { status: 403 }
        );
      }
      
      // 메시지 조회
      const { data: messages, error: messagesError } = await createAdminClient()
        .from('messages')
        .select(`
          id, 
          content, 
          created_at, 
          is_read,
          sender_id, 
          receiver_id,
          sender:users!messages_sender_id_fkey(id, name, profile_image),
          receiver:users!messages_receiver_id_fkey(id, name, profile_image)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);
      
      if (messagesError) {
        console.error('[Messages API] ❌ 메시지 조회 오류:', messagesError);
        return NextResponse.json(
          { error: '메시지 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        );
      }
      
      // 읽지 않은 메시지 업데이트
      const unreadMessageIds = messages
        ?.filter(msg => msg.receiver_id === userId && !msg.is_read)
        .map(msg => msg.id) || [];
      
      if (unreadMessageIds.length > 0) {
        await createAdminClient()
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadMessageIds);
      }
      
      return NextResponse.json({
        success: true,
        roomId: roomId,
        messages: (messages || []).map(msg => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.sender_id,
          receiverId: msg.receiver_id,
          createdAt: msg.created_at,
          isRead: msg.is_read,
          sender: msg.sender,
          receiver: msg.receiver,
          isMine: msg.sender_id === userId
        }))
      });
      
    } else if (purchaseId) {
      // 구매 ID로 메시지 조회 (기존 로직 유지)
      let purchaseData;
      
      // 구매 정보 조회
      if (!isNaN(Number(purchaseId))) {
        // 숫자인 경우 id로 조회
        const { data, error } = await createAdminClient()
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
        const { data, error } = await createAdminClient()
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
      const { data: messages, error: messagesError } = await createAdminClient()
        .from('messages')
        .select(`
          id, 
          content, 
          created_at, 
          is_read,
          sender_id, 
          receiver_id,
          sender:users!messages_sender_id_fkey(id, name, profile_image),
          receiver:users!messages_receiver_id_fkey(id, name, profile_image)
        `)
        .eq('purchase_id', purchaseData.id)
        .order('created_at', { ascending: true })
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
          receiver: msg.receiver,
          isMine: msg.sender_id === userId
        }))
      });
      
    }
    
    // roomId, purchaseId, orderNumber 중 하나는 필수
    return NextResponse.json(
      { error: 'roomId, purchaseId, 또는 orderNumber 파라미터가 필요합니다.' },
      { status: 400 }
    );
    
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