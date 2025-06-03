"use client";

import { useEffect, useState, useRef } from 'react';
import type { Database } from '@/types/supabase.types';
import { Button } from '@/components/ui/button';
import { X, Send } from 'lucide-react';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { getSupabaseClient } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/auth-context';

type MessageRow = Database['public']['Tables']['messages']['Row'];
type RoomRow = Database['public']['Tables']['rooms']['Row'];
type UserRow = Database['public']['Tables']['users']['Row'];

interface Message {
  id: string;
  text: string;
  timestamp: string;
  sender_id: string;
  isMine: boolean;
  isRead?: boolean;
  status?: 'sending' | 'sent' | 'failed';
  clientId?: string;
}

interface RoomWithUsers {
  id: string;
  buyer_id: string;
  seller_id: string;
  buyer: UserRow;
  seller: UserRow;
  created_at?: string;
  updated_at?: string;
}

interface MessageWithSender extends Omit<MessageRow, 'sender'> {
  sender: UserRow;
  is_read: boolean;
}

interface ChatModalProps {
  roomId: string;
  onClose: () => void;
  onError?: (error: string) => void;
}

// 사용자 타입 정의
type User = Database['public']['Tables']['users']['Row'];

// ChatModalManager 싱글톤 클래스
class ChatModalManager {
  private static instance: ChatModalManager | null = null;
  private activeRooms: Set<string> = new Set();
  private messageCache: Map<string, Message[]> = new Map();
  private currentUser: User | null = null;
  private supabase: any = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): ChatModalManager {
    if (!ChatModalManager.instance) {
      ChatModalManager.instance = new ChatModalManager();
    }
    return ChatModalManager.instance;
  }

  public async initialize(user: User | null): Promise<void> {
    if (this.isInitialized && this.currentUser?.id === user?.id) return;

    try {
      this.supabase = await getSupabaseClient();
      this.currentUser = user;
      this.isInitialized = true;

      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
    } catch (error) {
      console.error('[ChatModalManager] 초기화 실패:', error);
      this.isInitialized = false;
      this.currentUser = null;
      throw error;
    }
  }

  public isReady(): boolean {
    return this.isInitialized && !!this.supabase && !!this.currentUser;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async loadRoomData(roomId: string): Promise<{ room: RoomWithUsers; otherUser: UserRow }> {
    if (!this.isReady()) {
      throw new Error('ChatModalManager가 초기화되지 않았습니다.');
    }

    const { data: roomData, error: roomError } = await this.supabase
      .from('rooms')
      .select('*, buyer:users!rooms_buyer_id_fkey(*), seller:users!rooms_seller_id_fkey(*)')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      throw new Error(`채팅방 정보를 찾을 수 없습니다 (${roomId})`);
    }

    const typedRoomData = roomData as unknown as RoomWithUsers;
    const otherUserId = typedRoomData.buyer_id === this.currentUser!.id ? typedRoomData.seller_id : typedRoomData.buyer_id;
    const otherUserData = typedRoomData.buyer_id === this.currentUser!.id ? typedRoomData.seller : typedRoomData.buyer;

    return { room: typedRoomData, otherUser: otherUserData };
  }

  public async loadMessages(roomId: string): Promise<Message[]> {
    if (!this.isReady()) {
      throw new Error('ChatModalManager가 초기화되지 않았습니다.');
    }

    // Check cache first
    const cachedMessages = this.messageCache.get(roomId);
    if (cachedMessages) {
      return cachedMessages;
    }

    const { data: messagesData, error: messagesError } = await this.supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        sender_id,
        room_id,
        is_read,
        sender:users(*)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new Error('메시지 목록을 불러올 수 없습니다.');
    }

    const messages = (messagesData || []).map((msg: MessageWithSender) => ({
      id: msg.id,
      text: msg.content,
      timestamp: msg.created_at,
      sender_id: msg.sender.id,
      isMine: msg.sender.id === this.currentUser!.id,
      isRead: msg.is_read
    }));

    // Cache the messages
    this.messageCache.set(roomId, messages);
    return messages;
  }

  public async sendMessage(roomId: string, content: string): Promise<Message> {
    if (!this.isReady()) {
      throw new Error('ChatModalManager가 초기화되지 않았습니다.');
    }

    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert([
          {
            room_id: roomId,
            content,
            sender_id: this.currentUser!.id,
            created_at: new Date().toISOString(),
            is_read: false
          }
        ])
        .select(`
          id,
          content,
          created_at,
          sender_id,
          is_read,
          room_id
        `)
        .single();

      if (error) {
        console.error('[메시지 전송 오류]:', error);
        throw new Error('메시지 전송에 실패했습니다.');
      }

      if (!data) {
        throw new Error('메시지 전송 응답이 없습니다.');
      }

      const message: Message = {
        id: data.id,
        text: data.content,
        timestamp: data.created_at,
        sender_id: data.sender_id,
        isMine: true,
        isRead: false,
        status: 'sent'
      };

      // Update cache
      const cachedMessages = this.messageCache.get(roomId) || [];
      this.messageCache.set(roomId, [...cachedMessages, message]);

      return message;
    } catch (error) {
      console.error('[메시지 전송 상세 오류]:', error);
      throw error;
    }
  }

  public async markAsRead(roomId: string, messageId: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('ChatModalManager가 초기화되지 않았습니다.');
    }

    await this.supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .eq('receiver_id', this.currentUser!.id);

    // Update cache
    const cachedMessages = this.messageCache.get(roomId);
    if (cachedMessages) {
      const updatedMessages = cachedMessages.map(msg =>
        msg.id === messageId ? { ...msg, isRead: true } : msg
      );
      this.messageCache.set(roomId, updatedMessages);
    }
  }

  public clearCache(roomId: string): void {
    this.messageCache.delete(roomId);
  }
}

export default function ChatModal({ roomId, onClose, onError }: ChatModalProps) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatManager = useRef(ChatModalManager.getInstance());

  const handleNewMessage = async (newMessage: any) => {
    if (!currentUser) return;

    setMessages(prev => {
      if (prev.some(msg => msg.id === newMessage.id)) return prev;
      return [
        ...prev,
        {
          id: newMessage.id,
          text: newMessage.content,
          timestamp: newMessage.created_at,
          sender_id: newMessage.sender_id,
          isMine: newMessage.sender_id === currentUser.id,
          isRead: newMessage.is_read,
        },
      ];
    });

    if (newMessage.sender_id !== currentUser.id) {
      await chatManager.current.markAsRead(roomId, newMessage.id);
    }

    scrollToBottom();
  };

  // 세션 체크를 먼저 수행
  useEffect(() => {
    const initializeChat = async () => {
      if (authLoading) {
        setIsLoading(true);
        return;
      }

      try {
        // Wait for auth to be ready
        if (!authUser) {
          setError('로그인이 필요합니다.');
          if (onError) onError('로그인이 필요합니다.');
          return;
        }

        await chatManager.current.initialize(authUser);
        setCurrentUser(authUser);
        setIsSessionChecked(true);
        setError(null);
      } catch (error) {
        console.error('[채팅] 초기화 오류:', error);
        setError(error instanceof Error ? error.message : '채팅을 시작할 수 없습니다.');
        if (onError) onError(error instanceof Error ? error.message : '채팅을 시작할 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();
  }, [authUser, authLoading, onError]);

  // 실시간 구독은 세션 체크가 완료된 후에만 시작
  const { isConnected, error: realtimeError } = useRealtimeMessages(
    isSessionChecked ? roomId : null,
    handleNewMessage
  );

  useEffect(() => {
    if (realtimeError) {
      console.error('[채팅] 실시간 구독 오류:', realtimeError);
      setError(realtimeError);
      setIsReconnecting(true);
    } else {
      setError(null);
      setIsReconnecting(false);
    }
  }, [realtimeError]);

  useEffect(() => {
    const loadChatData = async () => {
      if (!isSessionChecked || !currentUser) return;

      try {
        setIsLoading(true);
        console.log(`🔄 ChatModal - 채팅 데이터 불러오기 시작 (roomId: ${roomId})`);

        // Load room data and messages using ChatModalManager
        const { otherUser: otherUserData } = await chatManager.current.loadRoomData(roomId);
        const messagesData = await chatManager.current.loadMessages(roomId);

        setOtherUser(otherUserData);
        setMessages(messagesData);
        setError(null);
      } catch (error) {
        console.error('[채팅] 데이터 로드 오류:', error);
        setError(error instanceof Error ? error.message : '채팅 데이터를 불러올 수 없습니다.');
        if (onError) onError(error instanceof Error ? error.message : '채팅 데이터를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadChatData();
  }, [roomId, currentUser, isSessionChecked, onError]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      text: messageContent,
      timestamp: new Date().toISOString(),
      sender_id: currentUser.id,
      isMine: true,
      status: 'sending'
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();

    const maxRetries = 3;
    let currentRetry = 0;

    const attemptSend = async (): Promise<void> => {
      try {
        const sentMessage = await chatManager.current.sendMessage(roomId, messageContent);
        setMessages(prev => 
          prev.map(msg => msg.id === tempId ? { ...sentMessage, status: 'sent' } : msg)
        );
      } catch (error) {
        console.error(`[채팅] 메시지 전송 오류 (시도 ${currentRetry + 1}/${maxRetries}):`, error);
        
        if (currentRetry < maxRetries - 1) {
          currentRetry++;
          // Exponential backoff: 1초, 2초, 4초...
          const delay = Math.pow(2, currentRetry) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptSend();
        }

        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId ? { ...msg, status: 'failed' } : msg
          )
        );
        
        // Show error message to user
        setError('메시지 전송에 실패했습니다. 다시 시도해주세요.');
        setTimeout(() => setError(null), 3000); // 3초 후 에러 메시지 제거
      }
    };

    await attemptSend();
  };

  // 연결 상태 UI 표시
  const renderConnectionStatus = () => {
    if (isReconnecting) {
      return (
        <div className="text-center py-2 bg-yellow-50 text-yellow-700">
          <span className="animate-pulse">재연결 시도 중...</span>
        </div>
      );
    }
    if (!isConnected) {
      return (
        <div className="text-center py-2 bg-red-50 text-red-700">
          연결이 끊어졌습니다
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">채팅</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <span className="sr-only">닫기</span>
            ✕
          </button>
        </div>

        {/* 연결 상태 표시 */}
        {renderConnectionStatus()}

        {/* 채팅 내용 */}
        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="text-center text-red-600 py-4">
              {error}
            </div>
          ) : isLoading ? (
            <div className="text-center py-4">
              <span className="animate-pulse">로딩 중...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-lg p-3 ${
                    message.isMine
                      ? 'bg-teal-500 text-white rounded-tr-none'
                      : 'bg-gray-200 text-gray-800 rounded-tl-none'
                  }`}>
                    <p className="text-sm break-words">{message.text}</p>
                    <div className="flex items-center justify-end mt-1 space-x-1">
                      <span className="text-xs opacity-80">
                        {new Date(message.timestamp).toLocaleTimeString('ko-KR', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'Asia/Seoul' 
                        })}
                      </span>
                      {message.isMine && (
                        <span className="text-xs">
                          {message.status === 'sending' && '전송 중...'}
                          {message.status === 'failed' && '⚠️'}
                          {message.status === 'sent' && (message.isRead ? '읽음' : '전송됨')}
                          {!message.status && (message.isRead ? '읽음' : '전송됨')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="메시지를 입력하세요..."
              className="flex-1 py-2 px-4 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={isLoading || !!error}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !!error || !newMessage.trim()}
              className="rounded-full w-10 h-10 flex items-center justify-center p-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 