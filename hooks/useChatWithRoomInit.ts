import { useEffect, useState, useRef, useCallback } from 'react';
import supabase from '@/lib/supabase-browser';
// 타입 임포트 문제 수정
// import { Database } from '@/types/supabase.types';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

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
  
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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
    } catch (err) {
      console.error('[채팅] 데이터 로딩 중 오류:', err);
      setError('채팅 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [roomId, supabase]);

  /**
   * 메시지 읽음 표시
   */
  const markMessagesAsRead = useCallback(async () => {
    if (!roomId || !userId) return;
    
    try {
      const { error } = await supabase
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
  }, [roomId, userId, supabase]);

  /**
   * 초기 데이터 로딩
   */
  useEffect(() => {
    if (roomId) {
      fetchMessages();
    }
  }, [roomId, fetchMessages]);

  /**
   * 실시간 메시지 구독
   */
  useEffect(() => {
    if (!roomId) return;
    
    console.log(`[채팅] 실시간 구독 시작 - 방ID: ${roomId}`);
    
    // Supabase 채널 생성 및 구독
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `room_id=eq.${roomId}` 
        },
        async (payload) => {
          console.log('[채팅] 새 메시지 수신:', payload);
          
          // 보낸 사람 정보 조회
          const newMessage = payload.new as ChatMessage;
          
          if (newMessage.sender_id !== userId) {
            // 내가 보낸 메시지가 아닐 경우 읽음 표시
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMessage.id);
              
            // 다른 사람의 메시지인 경우 발신자 정보 조회
            const { data: sender } = await supabase
              .from('users')
              .select('id, name, profile_image')
              .eq('id', newMessage.sender_id)
              .single();
              
            if (sender) {
              newMessage.sender = sender;
            }
          }
          
          setMessages((prev) => [...prev, newMessage]);
        }
      )
      .subscribe((status) => {
        console.log(`[채팅] 구독 상태: ${status}`);
      });
    
    // 참조 저장 (정리 함수에서 사용)
    subscriptionRef.current = channel;
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log('[채팅] 실시간 구독 정리');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [roomId, userId, supabase]);

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
      const { error } = await supabase.from('messages').insert([
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
      await supabase
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
  }, [newMessage, roomId, userId, supabase]);

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