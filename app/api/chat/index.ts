import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { cors } from '@/lib/cors';
import { verifyToken, getTokenFromHeaders, getTokenFromCookies } from '@/lib/auth';

// 타입 정의 추가
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

// 채팅방 API 핸들러
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // 인증 토큰 검증
  try {
    // NextApiRequest를 Headers와 Request로 적절히 변환
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : null;
    
    // 쿠키에서 토큰 확인
    if (!token && req.cookies) {
      token = req.cookies['accessToken'] || req.cookies['sb-access-token'] || null;
    }
    
    if (!token) {
      return res.status(401).json({ error: '인증되지 않은 요청입니다.' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }
    
    const userId = decoded.userId;
    
    // GET 요청 처리 - 채팅방 목록 또는 특정 채팅방 조회
    if (req.method === 'GET') {
      const { roomId, purchaseId } = req.query;
      
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
          return res.status(500).json({ error: '채팅방 조회 중 오류가 발생했습니다.' });
        }
        
        const isParticipant = room.room_participants.some((p: any) => p.user.id === userId);
        if (!isParticipant) {
          return res.status(403).json({ error: '채팅방에 접근할 권한이 없습니다.' });
        }
        
        return res.status(200).json({ room });
      }
      
      // 특정 구매에 연결된 채팅방 조회
      if (purchaseId) {
        const parsedPurchaseId = typeof purchaseId === 'string' && /^\d+$/.test(purchaseId) 
          ? parseInt(purchaseId, 10)
          : undefined;
          
        if (!parsedPurchaseId) {
          return res.status(400).json({ error: '유효하지 않은 구매 ID입니다.' });
        }
        
        const { data: roomList, error } = await supabase
          .from('room_participants')
          .select(`room:rooms (id, order_number, purchase_id)`) // 확장 가능
          .eq('user_id', userId);

        if (error || !roomList) {
          console.error('구매 관련 채팅방 조회 오류:', error);
          return res.status(500).json({ error: '채팅방 조회 중 오류가 발생했습니다.' });
        }

        const matched = roomList.find((r: any) => r.room.purchase_id === parsedPurchaseId);
        return res.status(200).json({ room: matched?.room || null });
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
        return res.status(500).json({ error: '채팅방 목록 조회 중 오류가 발생했습니다.' });
      }
      
      const rooms = participantRooms?.map((r: any) => r.room) || [];
      return res.status(200).json({ rooms });
    }
    
    // POST 요청 처리 - 새 채팅방 생성
    if (req.method === 'POST') {
      const { name, purchaseId, participantIds } = req.body;
      
      if (!name || !Array.isArray(participantIds) || participantIds.length < 2) {
        return res.status(400).json({ error: '유효하지 않은 채팅방 생성 요청입니다.' });
      }
      
      if (!participantIds.includes(userId)) {
        return res.status(400).json({ error: '생성자는 반드시 참여자여야 합니다.' });
      }
      
      // 채팅방 이름 중복 확인
      const { data: existingRoom, error: checkError } = await supabase
        .from('rooms')
        .select('id')
        .eq('order_number', name)
        .maybeSingle();
      
      if (checkError) {
        console.error('채팅방 확인 오류:', checkError);
        return res.status(500).json({ error: '채팅방 확인 중 오류가 발생했습니다.' });
      }
      
      if (existingRoom) {
        return res.status(409).json({ error: '이미 존재하는 채팅방 이름입니다.' });
      }
      
      // 채팅방 생성
      const parsedPurchaseId = purchaseId && typeof purchaseId === 'string' && /^\d+$/.test(purchaseId)
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
        return res.status(500).json({ error: '채팅방 생성 실패' });
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
        return res.status(500).json({ error: '채팅방 참가자 추가 중 오류가 발생했습니다.' });
      }
      
      return res.status(201).json({ room: createdRoom });
    }
    
    // PUT 요청 처리 - 채팅방 업데이트 (나가기 등)
    if (req.method === 'PUT') {
      const { roomId, action } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ error: '채팅방 ID는 필수입니다.' });
      }
      
      // 채팅방 존재 확인
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select(`
          *,
          participants:room_participants(*)
        `)
        .eq('name', roomId as string);
        
      if (roomError || !roomData || roomData.length === 0) {
        console.error('채팅방 조회 오류:', roomError);
        return res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
      }

      const room = roomData[0] as Room;
      
      // 채팅방 참여자 확인
      const isParticipant = room.participants.some(p => p.user_id === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: '채팅방에 접근할 권한이 없습니다.' });
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
          return res.status(500).json({ error: '채팅방을 나가는 중 오류가 발생했습니다.' });
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
        
        return res.status(200).json({ success: true });
      }
      
      return res.status(400).json({ error: '지원하지 않는 작업입니다.' });
    }
    
    return res.status(405).json({ error: '허용되지 않는 메서드입니다.' });
  } catch (error) {
    console.error('채팅 API 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
} 