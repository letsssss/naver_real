'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getSupabaseClient, supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useRealtimeMessages } from './useRealtimeMessages';

/**
 * 타입 정의
 */
export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    profile_image?: string;
  };
}

interface ChatParticipant {
  user_id: string;
  user: {
    id: string;
    name: string;
    profile_image?: string;
  };
}

interface RoomData {
  id: string;
  name: string;
  created_at: string;
  purchase?: any;
}

interface UseChatReturn {
  messages: ChatMessage[];
  participants: ChatParticipant[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => Promise<void>;
  sendMessageWithEnter: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  loading: boolean;
  sendingMessage: boolean;
  markMessagesAsRead: () => Promise<void>;
  error: string | null;
  roomName: string;
}

export function useChatWithRoomInit(roomId: string, userId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  
  // 메시지 읽음 처리 함수를 ref로 저장하여 의존성 순환 방지
  const markMessagesAsReadRef = useRef<() => Promise<void>>();
  
  // markMessagesAsRead 함수 정의
  const markMessagesAsRead = useCallback(async (): Promise<void> => {
    if (!roomId || !userId) return;
    
    try {
      // 기본 Supabase 클라이언트 사용
      const { error: updateError } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (updateError) {
        console.error('[채팅] 읽음 표시 오류:', updateError);
        return;
      }

      // 로컬 상태 업데이트
      setMessages(prev => 
        prev.map(msg => 
          msg.sender_id !== userId && !msg.is_read
            ? { ...msg, is_read: true }
            : msg
        )
      );
    } catch (error) {
      console.error('[채팅] 읽음 표시 중 오류:', error);
    }
  }, [roomId, userId]);

  // ref 업데이트
  useEffect(() => {
    markMessagesAsReadRef.current = markMessagesAsRead;
  }, [markMessagesAsRead]);

  // 메시지 핸들러
  const handleNewMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      // 중복 메시지 체크
      if (prev.some(msg => msg.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });

    // 내가 보낸 메시지가 아닌 경우에만 읽음 처리
    if (message.sender_id !== userId && markMessagesAsReadRef.current) {
      markMessagesAsReadRef.current();
    }
  }, [userId]);

  // 실시간 메시지 구독
  useRealtimeMessages(roomId, handleNewMessage);

  /**
   * 채팅방 초기화
   */
  const initializeChat = useCallback(async () => {
    if (!roomId) return;

    try {
      setLoading(true);
      setError(null);

      // 기본 Supabase 클라이언트 사용
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select(`
          id,
          name,
          created_at,
          purchase:purchases(*)
        `)
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error('[채팅] 채팅방 정보 조회 오류:', roomError);
        throw new Error('채팅방 정보를 불러올 수 없습니다.');
      }

      const typedRoomData = roomData as RoomData;
      setRoomName(typedRoomData.name || '채팅방');

      // 2. 메시지 목록 조회
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_id,
          receiver_id,
          room_id,
          is_read,
          created_at,
          sender:users!sender_id (
            id,
            name,
            profile_image
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('[채팅] 메시지 목록 조회 오류:', messagesError);
        throw new Error('메시지 목록을 불러올 수 없습니다.');
      }

      // 타입 안전성을 위해 타입 가드 추가
      const typedMessagesData = messagesData as unknown as ChatMessage[];
      if (!Array.isArray(typedMessagesData)) {
        throw new Error('메시지 데이터 형식이 올바르지 않습니다.');
      }
      setMessages(typedMessagesData || []);

      // 3. 참가자 목록 조회
      const { data: participantsData, error: participantsError } = await supabase
        .from('rooms')
        .select(`
          buyer_id,
          seller_id,
          buyer:users!rooms_buyer_id_fkey (
            id,
            name,
            profile_image
          ),
          seller:users!rooms_seller_id_fkey (
            id,
            name,
            profile_image
          )
        `)
        .eq('id', roomId)
        .single();

      if (participantsError) {
        console.error('[채팅] 참가자 정보 조회 오류:', participantsError);
        setParticipants([]);
      } else if (participantsData) {
        // buyer와 seller를 participants 배열로 변환
        const participants: ChatParticipant[] = [];
        
        const buyerData = participantsData.buyer as any;
        const sellerData = participantsData.seller as any;
        
        if (buyerData && buyerData.id) {
          participants.push({
            user_id: participantsData.buyer_id,
            user: {
              id: buyerData.id.toString(),
              name: buyerData.name,
              profile_image: buyerData.profile_image
            }
          });
        }
        
        if (sellerData && sellerData.id && participantsData.seller_id !== participantsData.buyer_id) {
          participants.push({
            user_id: participantsData.seller_id,
            user: {
              id: sellerData.id.toString(),
              name: sellerData.name,
              profile_image: sellerData.profile_image
            }
          });
        }
        
        setParticipants(participants);
      } else {
        setParticipants([]);
      }

      // 4. 읽지 않은 메시지 읽음 표시
      await markMessagesAsRead();

    } catch (error) {
      console.error('[채팅] 초기화 중 오류:', error);
      setError('채팅방 초기화 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId, userId]);

  /**
   * 메시지 전송
   */
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !roomId || !userId) return;
    
    try {
      setSendingMessage(true);
      
      const messageId = uuidv4();
      
      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          id: messageId,
          room_id: roomId,
          sender_id: userId,
          content: newMessage.trim(),
        });
      
      if (sendError) {
        console.error('[채팅] 메시지 전송 오류:', sendError);
        toast.error('메시지 전송에 실패했습니다.');
        return;
      }
      
      setNewMessage('');
      
    } catch (error) {
      console.error('[채팅] 메시지 전송 중 오류:', error);
      toast.error('메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingMessage(false);
    }
  }, [newMessage, roomId, userId]);

  /**
   * 엔터 키로 메시지 전송
   */
  const sendMessageWithEnter = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // 초기 데이터 로딩
  useEffect(() => {
    if (roomId) {
      initializeChat();
    }
  }, [roomId, initializeChat]);

  return {
    messages,
    participants,
    newMessage,
    setNewMessage,
    sendMessage,
    sendMessageWithEnter,
    loading,
    sendingMessage,
    markMessagesAsRead,
    error,
    roomName
  };
} 