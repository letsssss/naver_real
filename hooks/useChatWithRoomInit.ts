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
   * 채팅방 초기화 함수
   */
  const initializeChat = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      console.log(`[채팅] 메시지 불러오기 시작 - 방ID: ${roomId}`);
      
      const supabase = createBrowserClient();
      
      // 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('[채팅] 세션 오류:', sessionError);
        setError('로그인이 필요합니다.');
        return;
      }
      
      // 1. 채팅방 정보 조회
      const { data: roomData, error: roomError } = await supabase
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
      const { data: messagesData, error: messagesError } = await supabase
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
      const { data: participantsData, error: participantsError } = await supabase
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
      
    } catch (error) {
      console.error('[채팅] 초기화 중 오류:', error);
      setError('채팅방 초기화 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId, userId]);

  /**
   * 메시지 읽음 표시
   */
  const markMessagesAsRead = useCallback(async () => {
    if (!roomId || !userId) return;
    
    try {
      const supabase = createBrowserClient();
      
      // 세션 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .eq('receiver_id', userId)
        .eq('is_read', false);
        
    } catch (error) {
      console.error('[채팅] 읽음 표시 오류:', error);
    }
  }, [roomId, userId]);

  /**
   * 초기 데이터 로딩
   */
  useEffect(() => {
    if (roomId) {
      initializeChat();
    }
  }, [roomId, initializeChat]);

  /**
   * 실시간 메시지 구독 (useRealtimeMessages 훅 사용)
   */
  useRealtimeMessages(roomId, (newMessage) => {
    setMessages((prev) => [...prev, newMessage]);
    if (newMessage.sender_id !== userId) {
      markMessagesAsRead();
    }
  });

  /**
   * 메시지 전송 함수
   */
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !roomId || !userId) return;
    
    try {
      setSendingMessage(true);
      
      const supabase = createBrowserClient();
      
      // 세션 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('로그인이 필요합니다.');
        return;
      }
      
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