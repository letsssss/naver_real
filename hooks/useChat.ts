import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

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

export function useChat(options: ChatOptions | null = null): ChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [transactionInfo, setTransactionInfo] = useState<any | null>(null);
  const [otherUserInfo, setOtherUserInfo] = useState<any | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  
  const userId = options?.userId || '';
  const transactionId = options?.transactionId || '';
  const otherUserId = options?.otherUserId || '';
  
  const channelRef = useRef<any>(null);

  // 메시지 가져오기 함수
  const fetchMessages = useCallback(async (options: { force?: boolean } = {}): Promise<boolean> => {
    if (!transactionId) return false;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;

      const formattedMessages: Message[] = data?.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        receiverId: msg.receiver_id,
        text: msg.content,
        timestamp: msg.created_at,
        isMine: msg.sender_id === userId,
        status: 'sent',
        isRead: msg.is_read,
        transactionId: msg.transaction_id,
        roomId: msg.room_id
      })) || [];
      
      setMessages(formattedMessages);
      if (formattedMessages.length > 0 && formattedMessages[0].roomId) {
        setRoomId(formattedMessages[0].roomId);
      }

      return true;
    } catch (error: any) {
      setError('메시지 불러오기 실패');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, userId]);

  useEffect(() => {
    if (!userId || !transactionId) return;

    const channel = supabase
      .channel(`transaction-${transactionId}`)
      .on('postgres_changes', {
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
      })
      .on('postgres_changes', {
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
      })
      .subscribe(status => {
        setSupabaseConnected(status === 'SUBSCRIBED');
      });
      
    channelRef.current = channel;
    
    fetchMessages({ force: true });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [userId, transactionId, fetchMessages]);

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!content || !content.trim()) return false;
    if (!userId || !transactionId) return false;

    const clientId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: Message = {
      id: clientId,
      senderId: userId,
      receiverId: otherUserId,
      text: content,
      timestamp: new Date().toISOString(),
      isMine: true,
      status: 'sending'
    };

    setMessages(prev => [...prev, newMessage]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: userId,
          receiver_id: otherUserId,
          content,
          transaction_id: transactionId,
          room_id: roomId,
          is_read: false
        }])
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        msg.id === clientId ? { ...msg, ...data, status: 'sent' } : msg
      ));

      return true;
    } catch (error: any) {
      setMessages(prev => prev.map(msg => 
        msg.id === clientId ? { ...msg, status: 'failed' } : msg
      ));
      setError('메시지 전송 실패');
      return false;
    }
  }, [userId, transactionId, otherUserId, roomId]);

  const markMessagesAsRead = useCallback(async (): Promise<boolean> => {
    if (!userId || !transactionId) return false;

    const unreadMessages = messages.filter(msg => !msg.isMine && !msg.isRead);
    if (unreadMessages.length === 0) return true;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('transaction_id', transactionId)
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      setMessages(prev => prev.map(msg => 
        !msg.isMine && !msg.isRead ? { ...msg, isRead: true } : msg
      ));

      return true;
    } catch (error) {
      setError('메시지 읽음 처리 실패');
      return false;
    }
  }, [messages, userId, transactionId]);

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
    markMessagesAsRead
  };
}