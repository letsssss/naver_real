import { useEffect, useState, useRef, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
// 타입 임포트 문제 수정
// import { Database } from '@/types/supabase.types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useRealtimeMessages } from './useRealtimeMessages';

/**
 * 채팅 메시지 타입 정의
 */
export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    name: string;
    profile_image?: string;
  };
}

/**
 * 채팅 참가자 타입 정의
 */
interface ChatParticipant {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
  user?: {
    id: string;
    name: string;
    profile_image?: string;
  };
}

/**
 * 훅 반환 타입
 */
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

/**
 * 채팅 기능을 위한 커스텀 훅
 * @param roomId 채팅방 ID
 * @param userId 현재 사용자 ID
 * @returns 채팅 관련 상태와 함수들
 */
export function useChatWithRoomInit(roomId: string, userId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * 메시지 데이터 불러오기
   */
  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      console.log(`[채팅] 메시지 불러오기 시작 - 방ID: ${roomId}`);
      
      // 1. 채팅방 정보 조회
      const { data: roomData, error: roomError } = await createBrowserClient()
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
        
      if (roomError) {
        console.error('[채팅] 채팅방 정보 조회 오류:', roomError);
        setError('채팅방 정보를 불러올 수 없습니다.');
        return;
      }
      
      if (roomData.name) {
        setRoomName(roomData.name);
      }
      
      // 2. 채팅 메시지 조회
      const { data: messagesData, error: messagesError } = await createBrowserClient()
        .from('messages')
        .select(`
          *,
          sender:users!sender_id (
            id,
            name,
            profile_image
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error('[채팅] 메시지 조회 오류:', messagesError);
        setError('메시지를 불러올 수 없습니다.');
        return;
      }
      
      console.log(`[채팅] ${messagesData?.length || 0}개의 메시지를 불러왔습니다.`);
      setMessages(messagesData || []);
      
      // 3. 참가자 정보 조회
      const { data: participantsData, error: participantsError } = await createBrowserClient()
        .from('room_participants')
        .select(`
          *,
          user:users!user_id (
            id,
            name,
            profile_image
          )
        `)
        .eq('room_id', roomId);
      
      if (participantsError) {
        console.error('[채팅] 참가자 정보 조회 오류:', participantsError);
      } else {
        setParticipants(participantsData || []);
      }
      
      // 4. 읽지 않은 메시지 읽음 표시
      await markMessagesAsRead();
    } catch (err) {
      console.error('[채팅] 데이터 로딩 중 오류:', err);
      setError('채팅 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId, createBrowserClient]);

  /**
   * 메시지 읽음 표시
   */
  const markMessagesAsRead = useCallback(async () => {
    if (!roomId || !userId) return;
    
    try {
      const { error } = await createBrowserClient()
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
        .eq('is_read', false);
      
      if (error) {
        console.error('[채팅] 메시지 읽음 처리 오류:', error);
      }
    } catch (err) {
      console.error('[채팅] 메시지 읽음 처리 중 오류:', err);
    }
  }, [roomId, userId, createBrowserClient]);

  /**
   * 초기 데이터 로딩
   */
  useEffect(() => {
    if (roomId) {
      fetchMessages();
    }
  }, [roomId, fetchMessages]);

  /**
   * 실시간 메시지 구독 (useRealtimeMessages 훅 사용)
   */
  useRealtimeMessages(roomId, async (newMessage) => {
    // userId가 없으면 처리하지 않음 (불필요한 작업 방지)
    if (!userId) {
      console.warn('[채팅] userId가 없어 메시지 처리를 건너뜁니다:', newMessage.id);
      return;
    }
    
    console.log('[채팅] 새 메시지 수신:', newMessage);
    
    const chatMessage = newMessage as unknown as ChatMessage;
    
    if (userId && chatMessage.sender_id !== userId) {
      // 내가 보낸 메시지가 아닐 경우 읽음 표시
      await createBrowserClient()
        .from('messages')
        .update({ is_read: true })
        .eq('id', chatMessage.id);
        
      // 다른 사람의 메시지인 경우 발신자 정보 조회
      const { data: sender } = await createBrowserClient()
        .from('users')
        .select('id, name, profile_image')
        .eq('id', chatMessage.sender_id)
        .single();
        
      if (sender) {
        chatMessage.sender = sender;
      }
    }
    
    // 중복 메시지 방지를 위한 검사 추가
    setMessages((prev) => {
      // 이미 동일한 ID의 메시지가 있는지 확인
      const exists = prev.some((msg) => msg.id === chatMessage.id);
      // 중복이면 기존 상태 유지, 새 메시지면 추가
      return exists ? prev : [...prev, chatMessage];
    });
  });

  /**
   * 메시지 전송 함수
   */
  const sendMessage = useCallback(async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !roomId || !userId) return;
    
    try {
      setSendingMessage(true);
      console.log(`[채팅] 메시지 전송 시도: "${trimmedMessage.substring(0, 20)}${trimmedMessage.length > 20 ? '...' : ''}"`);
      
      // 메시지 ID 생성
      const messageId = uuidv4();
      
      // 메시지 삽입
      const { error } = await createBrowserClient()
        .from('messages')
        .insert([
          {
            id: messageId,
            room_id: roomId,
            sender_id: userId,
            content: trimmedMessage,
            is_read: false,
            created_at: new Date().toISOString()
          },
        ]);
      
      if (error) {
        console.error('[채팅] 메시지 전송 오류:', error);
        toast.error('메시지 전송에 실패했습니다.');
        return;
      }
      
      // 채팅방 마지막 메시지 업데이트
      await createBrowserClient()
        .from('rooms')
        .update({
          last_chat: trimmedMessage,
          time_of_last_chat: new Date().toISOString()
        })
        .eq('id', roomId);
      
      // 입력 필드 초기화
      setNewMessage('');
      console.log('[채팅] 메시지 전송 성공');
    } catch (err) {
      console.error('[채팅] 메시지 전송 중 오류:', err);
      toast.error('메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setSendingMessage(false);
    }
  }, [newMessage, roomId, userId, createBrowserClient]);

  /**
   * 엔터 키로 메시지 전송
   */
  const sendMessageWithEnter = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // 새 메시지가 추가될 때 스크롤 아래로 이동
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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