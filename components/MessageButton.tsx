'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useAuth } from '@/contexts/auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// 채팅 관리자 싱글톤
class ChatManager {
  private static instance: ChatManager | null = null;
  private activeChats: Set<string> = new Set();
  private supabase: SupabaseClient<Database> | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    this.initializationPromise = this.initialize();
  }

  private async initialize() {
    if (this.isInitialized) return;
    
    try {
      this.supabase = await getSupabaseClient();
      this.isInitialized = true;
    } catch (error) {
      console.error('ChatManager 초기화 실패:', error);
      throw error;
    }
  }

  public static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager();
    }
    return ChatManager.instance;
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      if (this.initializationPromise) {
        await this.initializationPromise;
      } else {
        this.initializationPromise = this.initialize();
        await this.initializationPromise;
      }
    }
  }

  public async activateChat(orderNumber?: string, postId?: number): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.supabase) {
      console.error('Supabase 클라이언트가 초기화되지 않았습니다.');
      return false;
    }

    const chatId = orderNumber || `post-${postId}`;
    
    if (this.activeChats.has(chatId)) {
      return true;
    }

    try {
      // 채팅방 활성화 로직
      const { data, error } = await this.supabase
        .from('rooms')
        .upsert([
          {
            id: chatId,
            order_number: orderNumber,
            post_id: postId,
            status: 'active'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      this.activeChats.add(chatId);
      return true;
    } catch (error) {
      console.error('채팅방 활성화 실패:', error);
      return false;
    }
  }

  public deactivateChat(chatId: string): void {
    this.activeChats.delete(chatId);
  }

  public isActive(chatId: string): boolean {
    return this.activeChats.has(chatId);
  }
}

interface MessageButtonProps {
  orderNumber?: string;
  postId?: number;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  debug?: boolean;
}

export default function MessageButton({ 
  orderNumber, 
  postId,
  onClick, 
  disabled = false, 
  isLoading = false,
  className = "text-sm flex items-center gap-2 border-2 border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors font-medium",
  debug = false
}: MessageButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const { unreadCount, isLoading: isOrderNumberLoading } = useUnreadMessages(orderNumber);
  const [chatManager] = useState(() => ChatManager.getInstance());
  const [isActivating, setIsActivating] = useState(false);

  const handleClick = useCallback(async () => {
    if (onClick) {
      onClick();
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsActivating(true);
    try {
      const success = await chatManager.activateChat(orderNumber, postId);
      if (!success) {
        throw new Error('채팅방 활성화에 실패했습니다.');
      }

      // 채팅 UI 활성화 이벤트 발생
      window.dispatchEvent(new CustomEvent('chat:activate', {
        detail: { orderNumber, postId }
      }));
    } catch (error) {
      console.error('채팅 활성화 오류:', error);
      alert('채팅을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsActivating(false);
    }
  }, [onClick, user, orderNumber, postId, chatManager]);

  const buttonDisabled = disabled || isLoading || isOrderNumberLoading || isActivating || authLoading;
  const shouldDisplayCount = !isLoading && !isOrderNumberLoading && !authLoading && unreadCount > 0;

  if (debug) {
    console.log('MessageButton Debug:', {
      orderNumber,
      postId,
      unreadCount,
      isLoading,
      isOrderNumberLoading,
      isActivating,
      authLoading,
      buttonDisabled,
      shouldDisplayCount
    });
  }

  return (
    <Button
      variant="outline"
      className={className}
      onClick={handleClick}
      disabled={buttonDisabled}
    >
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        
        {shouldDisplayCount && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
      {isLoading || isOrderNumberLoading || isActivating || authLoading ? "로딩 중..." : "메시지"}
    </Button>
  );
} 