import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient, subscribeToChannel, unsubscribeFromChannel } from '@/lib/supabase';
import { Message } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

// 메시지 인터페이스 정의
export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  text: string;
  timestamp: string;
  isMine: boolean;
  status?: 'sending' | 'sent' | 'failed';
  isRead?: boolean;
  roomId?: string;
  transactionId?: string;
}

// useChat 훅의 옵션
export interface ChatOptions {
  userId?: string;
  transactionId?: string;
  otherUserId?: string;
  userRole?: 'buyer' | 'seller' | 'user';
}

// 훅 반환 타입
export interface ChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  socketConnected: boolean;
  sendMessage: (content: string) => Promise<boolean>;
  fetchMessages: (options?: { force?: boolean, forceScrollToBottom?: boolean }) => Promise<boolean>;
  roomId: string | null;
  transactionInfo: any | null;
  otherUserInfo: any | null;
  conversations: any[];
  hasMore: boolean;
  markMessagesAsRead: () => Promise<boolean>;
}

interface UseChatProps {
  userId: string;
  transactionId: string;
}

export function useChat({ userId, transactionId }: UseChatProps): ChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [transactionInfo, setTransactionInfo] = useState<any | null>(null);
  const [otherUserInfo, setOtherUserInfo] = useState<any | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  
  const supabase = getSupabaseClient();
  const channelRef = useRef<any>(null);
  const lastFetchRef = useRef<number>(0);
  const FETCH_COOLDOWN = 1000; // 1초 쿨다운

  // 메시지 가져오기
  const fetchMessages = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < FETCH_COOLDOWN) {
      return;
    }
    lastFetchRef.current = now;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = data.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        receiverId: msg.receiver_id,
        text: msg.content,
        timestamp: msg.created_at,
        isMine: msg.sender_id === userId,
        status: 'sent',
        isRead: msg.is_read,
        transactionId: msg.transaction_id
      }));

      setMessages(formattedMessages);
      setError(null);
    } catch (err) {
      console.error('메시지 로딩 오류:', err);
      setError('메시지를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, userId, supabase]);

  // 메시지 전송
  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim() || !userId || !transactionId) return false;

    const tempId = `temp-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Optimistic update
    setMessages(prev => [...prev, {
      id: tempId,
      senderId: userId,
      receiverId: '', // 실제 수신자 ID는 서버에서 결정
      text: content,
      timestamp,
      isMine: true,
      status: 'sending',
      transactionId
    }]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          content,
          sender_id: userId,
          transaction_id: transactionId,
          created_at: timestamp
        }])
        .select()
        .single();

      if (error) throw error;

      // 성공적으로 전송된 메시지로 업데이트
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? {
          ...msg,
          id: data.id,
          status: 'sent',
          receiverId: data.receiver_id
        } : msg
      ));

      return true;
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      // 실패 상태로 업데이트
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, status: 'failed' } : msg
      ));
      return false;
    }
  }, [userId, transactionId, supabase]);

  // 메시지 읽음 처리
  const markAsRead = useCallback(async (): Promise<boolean> => {
    if (!userId || !transactionId) return false;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('transaction_id', transactionId)
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        !msg.isMine ? { ...msg, isRead: true } : msg
      ));

      return true;
    } catch (error) {
      console.error('읽음 처리 오류:', error);
      return false;
    }
  }, [userId, transactionId, supabase]);

  // 실시간 구독 설정
  useEffect(() => {
    if (!userId || !transactionId) return;

    const channelId = `transaction-${transactionId}`;
    
    subscribeToChannel(channelId, (channel) => {
      channelRef.current = channel;

      // 메시지 추가 이벤트
      channel.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `transaction_id=eq.${transactionId}`,
      }, payload => {
        const newMsg: Message = {
          id: payload.new.id,
          senderId: payload.new.sender_id,
          receiverId: payload.new.receiver_id,
          text: payload.new.content,
          timestamp: payload.new.created_at,
          isMine: payload.new.sender_id === userId,
          status: 'sent',
          isRead: payload.new.is_read,
          transactionId: payload.new.transaction_id
        };
        
        setMessages(prev => {
          if (prev.some(msg => msg.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      });

      // 메시지 업데이트 이벤트
      channel.on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `transaction_id=eq.${transactionId}`,
      }, payload => {
        const updatedMsg: Message = {
          id: payload.new.id,
          senderId: payload.new.sender_id,
          receiverId: payload.new.receiver_id,
          text: payload.new.content,
          timestamp: payload.new.created_at,
          isMine: payload.new.sender_id === userId,
          status: 'sent',
          isRead: payload.new.is_read,
          transactionId: payload.new.transaction_id
        };
        
        setMessages(prev => prev.map(msg => 
          msg.id === updatedMsg.id ? updatedMsg : msg
        ));
      });
    });

    // 초기 메시지 로드
    fetchMessages({ force: true });

    return () => {
      unsubscribeFromChannel(channelId);
    };
  }, [userId, transactionId, fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    socketConnected: supabaseConnected,
    sendMessage,
    fetchMessages,
    roomId,
    transactionInfo,
    otherUserInfo,
    conversations: [],
    hasMore: false,
    markMessagesAsRead: markAsRead
  };
}