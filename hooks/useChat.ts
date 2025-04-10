import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
      // @ts-ignore - messages 테이블이 타입 정의에 없으므로 타입 오류 무시
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;

      // @ts-ignore - 데이터 매핑 과정에서 타입 오류 무시
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
    if (!userId || !transactionId) {
      console.error("사용자 ID 또는 거래 ID가 없습니다.");
      return false;
    }

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
      // UUID 형식으로 변환하는 함수
      const ensureUUID = (id: string | number): string => {
        if (typeof id === 'string' && id.includes('-')) {
          // 이미 UUID 형식인 경우
          return id;
        }
        // 숫자나 단순 문자열을 UUID의 네임스페이스로 사용하여 새 UUID 생성
        return uuidv4();
      };

      // transaction_id가 UUID 형식인지 확인하고 변환
      const safeTransactionId = ensureUUID(transactionId);
      
      // 먼저, 해당 transaction에 대한 room이 존재하는지 확인
      // @ts-ignore - rooms 테이블이 타입 정의에 없을 수 있음
      const { data: existingRoom, error: roomError } = await supabase
          .from('rooms')
          .select('id')
          .eq('purchase_id', safeTransactionId)
          .single();

      let roomIdToUse = roomId;

      if (roomError || !existingRoom) {
        // room이 없으면 새로 생성
        const newRoomId = uuidv4();
        // @ts-ignore - rooms 테이블이 타입 정의에 없을 수 있음
        const { data: newRoom, error: createRoomError } = await supabase
            .from('rooms')
            .insert([
                {
                    id: newRoomId,
                    purchase_id: safeTransactionId,
                    buyer_id: userId,
                    seller_id: otherUserId,
                    created_at: new Date().toISOString(),
                }
            ])
            .select()
            .single();
        
        if (createRoomError) {
          console.error("방 생성 실패", createRoomError);
          throw createRoomError;
        }

        // 새로운 room ID를 설정
        roomIdToUse = newRoom?.id || newRoomId;
        setRoomId(roomIdToUse);
      } else {
        // 기존 room ID 사용
        roomIdToUse = existingRoom.id;
        if (!roomId) setRoomId(roomIdToUse);
      }

      // 메시지 삽입
      // @ts-ignore - messages 테이블이 타입 정의에 없으므로 타입 오류 무시
      const { error: messageError } = await supabase
          .from('messages')
          .insert([{
              sender_id: userId,
              receiver_id: otherUserId,
              content,
              transaction_id: safeTransactionId,
              room_id: roomIdToUse,
              is_read: false,
              created_at: new Date().toISOString(),
          }]);

      if (messageError) {
        console.error("메시지 전송 실패", messageError);
        throw messageError;
      }

      // 성공적으로 전송된 경우 상태 업데이트
      setMessages(prev => prev.map(msg => 
        msg.id === clientId ? { ...msg, status: 'sent', roomId: roomIdToUse, transactionId: safeTransactionId } : msg
      ));

      return true;
    } catch (error: any) {
      console.error("메시지 전송 실패 상세:", error);
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
      // @ts-ignore - messages 테이블이 타입 정의에 없으므로 타입 오류 무시
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