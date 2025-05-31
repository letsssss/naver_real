import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// 타입 정의
interface RoomParticipant {
  id: number;
  room_id: number;
  user_id: number;
  user?: {
    id: number;
    name: string;
    profile_image?: string;
  };
}

interface Room {
  id: number;
  name: string;
  purchase_id?: number;
  created_at: string;
  time_of_last_chat?: string;
  participants: RoomParticipant[];
  messages?: any[];
  purchase?: {
    id: number;
    status: string;
    post?: {
      id: number;
      title: string;
    };
  };
}

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  
  // 인증 확인
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
  }

  const userId = user.id;
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  const purchaseId = searchParams.get('purchaseId');

  // 특정 채팅방 조회
  if (roomId) {
    const { data: room, error } = await supabase
      .from('rooms')
      .select(`*,
        room_participants (user:users (id, name, profile_image)),
        messages (id, content, created_at, sender:users (id, name, profile_image))
      `)
      .eq('order_number', roomId)
      .maybeSingle();

    if (error || !room) {
      console.error('채팅방 조회 오류:', error);
      return NextResponse.json({ error: '채팅방 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const isParticipant = room.room_participants.some((p: any) => p.user.id === userId);
    if (!isParticipant) {
      return NextResponse.json({ error: '채팅방에 접근할 권한이 없습니다.' }, { status: 403 });
    }

    return NextResponse.json({ room });
  }

  // 특정 구매에 연결된 채팅방 조회
  if (purchaseId) {
    const parsedPurchaseId = /^\d+$/.test(purchaseId) ? parseInt(purchaseId, 10) : undefined;

    if (!parsedPurchaseId) {
      return NextResponse.json({ error: '유효하지 않은 구매 ID입니다.' }, { status: 400 });
    }

    const { data: roomList, error } = await supabase
      .from('room_participants')
      .select(`room:rooms (id, order_number, purchase_id)`)
      .eq('user_id', userId);

    if (error || !roomList) {
      console.error('구매 관련 채팅방 조회 오류:', error);
      return NextResponse.json({ error: '채팅방 조회 중 오류가 발생했습니다.' }, { status: 500 });
    }

    const matched = roomList.find((r: any) => r.room.purchase_id === parsedPurchaseId);
    return NextResponse.json({ room: matched?.room || null });
  }

  // 사용자의 모든 채팅방 목록 조회
  const { data: participantRooms, error } = await supabase
    .from('room_participants')
    .select(`room:rooms (*,
      participants:room_participants (user:users (id, name, profile_image)),
      purchase:purchases (id, status, post:posts (id, title))
    )`)
    .eq('user_id', userId);

  if (error) {
    console.error('채팅방 목록 조회 오류:', error);
    return NextResponse.json({ error: '채팅방 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  const rooms = participantRooms?.map((r: any) => r.room) || [];
  return NextResponse.json({ rooms });
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  
  // 인증 확인
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
  }

  const userId = user.id;
  const body = await request.json();
  const { name, purchaseId, participantIds } = body;

  if (!name || !Array.isArray(participantIds) || participantIds.length < 2) {
    return NextResponse.json({ error: '유효하지 않은 채팅방 생성 요청입니다.' }, { status: 400 });
  }

  if (!participantIds.includes(userId)) {
    return NextResponse.json({ error: '생성자는 반드시 참여자여야 합니다.' }, { status: 400 });
  }

  // 채팅방 이름 중복 확인
  const { data: existingRoom, error: checkError } = await supabase
    .from('rooms')
    .select('id')
    .eq('order_number', name)
    .maybeSingle();

  if (checkError) {
    console.error('채팅방 확인 오류:', checkError);
    return NextResponse.json({ error: '채팅방 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }

  if (existingRoom) {
    return NextResponse.json({ error: '이미 존재하는 채팅방 이름입니다.' }, { status: 409 });
  }

  // 채팅방 생성
  const parsedPurchaseId = purchaseId && /^\d+$/.test(purchaseId)
    ? parseInt(purchaseId, 10)
    : purchaseId;

  const { data: createdRoom, error: createError } = await supabase
    .from('rooms')
    .insert({
      name,
      purchase_id: parsedPurchaseId,
      order_number: name
    })
    .select()
    .single();

  if (createError || !createdRoom) {
    console.error('채팅방 생성 오류:', createError);
    return NextResponse.json({ error: '채팅방 생성 실패' }, { status: 500 });
  }

  // 참가자 추가
  const participants = participantIds.map((id: number) => ({
    room_id: createdRoom.id,
    user_id: id
  }));

  const { error: participantError } = await supabase
    .from('room_participants')
    .insert(participants);

  if (participantError) {
    console.error('참가자 추가 오류:', participantError);
    // 실패한 경우 생성된 채팅방 삭제
    await supabase.from('rooms').delete().eq('id', createdRoom.id);
    return NextResponse.json({ error: '채팅방 참가자 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }

  return NextResponse.json({ room: createdRoom }, { status: 201 });
}

export async function PUT(request: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  
  // 인증 확인
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 });
  }

  const userId = user.id;
  const body = await request.json();
  const { roomId, action } = body;

  if (!roomId) {
    return NextResponse.json({ error: '채팅방 ID는 필수입니다.' }, { status: 400 });
  }

  // 채팅방 존재 확인
  const { data: roomData, error: roomError } = await supabase
    .from('rooms')
    .select(`
      *,
      participants:room_participants(*)
    `)
    .eq('name', roomId);

  if (roomError || !roomData || roomData.length === 0) {
    console.error('채팅방 조회 오류:', roomError);
    return NextResponse.json({ error: '채팅방을 찾을 수 없습니다.' }, { status: 404 });
  }

  const room = roomData[0] as Room;

  // 채팅방 참여자 확인
  const isParticipant = room.participants.some(p => p.user_id === userId);
  if (!isParticipant) {
    return NextResponse.json({ error: '채팅방에 접근할 권한이 없습니다.' }, { status: 403 });
  }

  // 채팅방 나가기
  if (action === 'leave') {
    const { error: leaveError } = await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', room.id)
      .eq('user_id', userId);

    if (leaveError) {
      console.error('채팅방 나가기 오류:', leaveError);
      return NextResponse.json({ error: '채팅방을 나가는 중 오류가 발생했습니다.' }, { status: 500 });
    }

    // 참가자가 없으면 채팅방 삭제
    const { data: remainingParticipants, error: countError } = await supabase
      .from('room_participants')
      .select('id')
      .eq('room_id', room.id);

    if (countError) {
      console.error('참가자 확인 오류:', countError);
    } else if (remainingParticipants.length === 0) {
      // 채팅방 삭제
      await supabase.from('rooms').delete().eq('id', room.id);
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
} 