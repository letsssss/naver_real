'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabaseClient, subscribeToChannel, unsubscribeFromChannel } from '@/lib/supabase';
import { ChatContextType, ChatState, Message, ChatRoom, ChatNotification } from '@/types/chat';
import { useAuth } from './auth-context';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// 초기 상태
const initialState: ChatState = {
  activeRoomId: null,
  rooms: [],
  messages: {},
  participants: {},
  notifications: [],
  isLoading: true,
  error: null
};

// 채팅 컨텍스트 생성
const ChatContext = createContext<ChatContextType | null>(null);

// 채팅 관리자 싱글톤
class ChatStateManager {
  private static instance: ChatStateManager | null = null;
  private supabase: SupabaseClient<Database> | null = null;
  private subscriptions: Map<string, () => void> = new Map();
  private state: ChatState = initialState;
  private setState: (state: ChatState) => void = () => {};
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): ChatStateManager {
    if (!ChatStateManager.instance) {
      ChatStateManager.instance = new ChatStateManager();
    }
    return ChatStateManager.instance;
  }

  public async initialize(setState: (state: ChatState) => void) {
    if (this.isInitialized) return;
    
    this.setState = setState;
    try {
      this.supabase = await getSupabaseClient();
      this.isInitialized = true;
      this.setState({
        ...this.state,
        isLoading: false
      });
    } catch (error) {
      console.error('채팅 관리자 초기화 실패:', error);
      this.setState({
        ...this.state,
        isLoading: false,
        error: '채팅 서비스 초기화에 실패했습니다.'
      });
    }
  }

  public getState(): ChatState {
    return this.state;
  }

  public isReady(): boolean {
    return this.isInitialized && !!this.supabase;
  }

  public async sendMessage(roomId: string, content: string): Promise<boolean> {
    if (!this.isReady()) {
      console.error('채팅 서비스가 초기화되지 않았습니다.');
      return false;
    }

    try {
      const { data, error } = await this.supabase!
        .from('messages')
        .insert([{
          room_id: roomId,
          content,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      return false;
    }
  }

  public async markAsRead(roomId: string): Promise<boolean> {
    if (!this.isReady()) {
      console.error('채팅 서비스가 초기화되지 않았습니다.');
      return false;
    }

    try {
      const { error } = await this.supabase!
        .from('messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('읽음 처리 실패:', error);
      return false;
    }
  }

  public async joinRoom(roomId: string): Promise<boolean> {
    if (!this.isReady()) {
      console.error('채팅 서비스가 초기화되지 않았습니다.');
      return false;
    }

    try {
      // 채팅방 구독
      subscribeToChannel(`room-${roomId}`, (channel) => {
        // 메시지 추가 이벤트
        channel.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        }, this.handleNewMessage.bind(this));

        // 메시지 업데이트 이벤트
        channel.on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        }, this.handleMessageUpdate.bind(this));
      });

      // 초기 메시지 로드
      const { data: messages, error: messagesError } = await this.supabase!
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // 상태 업데이트
      this.setState({
        ...this.state,
        activeRoomId: roomId,
        messages: {
          ...this.state.messages,
          [roomId]: messages || []
        }
      });

      return true;
    } catch (error) {
      console.error('채팅방 참여 실패:', error);
      return false;
    }
  }

  public leaveRoom(roomId: string): Promise<boolean> {
    try {
      unsubscribeFromChannel(`room-${roomId}`);
      
      // 상태 업데이트
      this.setState({
        ...this.state,
        activeRoomId: null,
        messages: {
          ...this.state.messages,
          [roomId]: []
        }
      });

      return Promise.resolve(true);
    } catch (error) {
      console.error('채팅방 나가기 실패:', error);
      return Promise.resolve(false);
    }
  }

  public clearNotifications(roomId: string): void {
    this.setState({
      ...this.state,
      notifications: this.state.notifications.filter(n => n.chatRoomId !== roomId)
    });
  }

  private handleNewMessage(payload: any) {
    const roomId = payload.new.room_id;
    const messages = this.state.messages[roomId] || [];
    
    this.setState({
      ...this.state,
      messages: {
        ...this.state.messages,
        [roomId]: [...messages, payload.new]
      }
    });
  }

  private handleMessageUpdate(payload: any) {
    const roomId = payload.new.room_id;
    const messages = this.state.messages[roomId] || [];
    
    this.setState({
      ...this.state,
      messages: {
        ...this.state.messages,
        [roomId]: messages.map(msg => 
          msg.id === payload.new.id ? payload.new : msg
        )
      }
    });
  }
}

// 채팅 컨텍스트 프로바이더
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ChatState>(initialState);
  const { user, loading: isAuthLoading } = useAuth();
  const chatManager = ChatStateManager.getInstance();

  // 채팅 관리자 초기화
  useEffect(() => {
    if (!isAuthLoading) {
      chatManager.initialize(setState);
    }
  }, [isAuthLoading]);

  // 사용자가 변경될 때 채팅방 재연결
  useEffect(() => {
    if (user && chatManager.isReady()) {
      loadUserChatRooms();
    }
  }, [user, chatManager.isReady()]);

  // 사용자의 채팅방 목록 로드
  const loadUserChatRooms = async () => {
    if (!user || !chatManager.isReady()) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const supabase = await getSupabaseClient();
      const { data: rooms, error } = await supabase
        .from('rooms')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        rooms: rooms || [],
        isLoading: false
      }));
    } catch (error) {
      console.error('채팅방 목록 로드 실패:', error);
      setState(prev => ({
        ...prev,
        error: '채팅방 목록을 불러오는데 실패했습니다.',
        isLoading: false
      }));
    }
  };

  const contextValue: ChatContextType = {
    ...state,
    sendMessage: chatManager.sendMessage.bind(chatManager),
    markAsRead: chatManager.markAsRead.bind(chatManager),
    joinRoom: chatManager.joinRoom.bind(chatManager),
    leaveRoom: chatManager.leaveRoom.bind(chatManager),
    clearNotifications: chatManager.clearNotifications.bind(chatManager)
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

// 채팅 컨텍스트 훅
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
} 