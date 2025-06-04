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

  private constructor() {}

  public static getInstance(): ChatManager {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager();
    }
    return ChatManager.instance;
  }

  public async activateChat(orderNumber?: string, postId?: number): Promise<boolean> {
    const chatId = orderNumber || `post-${postId}`;
    
    console.log('[ChatManager] 🚀 채팅 활성화 시작:', { orderNumber, postId, chatId });
    
    if (this.activeChats.has(chatId)) {
      console.log('[ChatManager] ✅ 이미 활성화된 채팅:', chatId);
      return true;
    }

    try {
      console.log('[ChatManager] 📡 API 호출 중...');
      
      // 현재 사용자 세션에서 토큰 가져오기
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // 토큰이 있으면 Authorization 헤더 추가
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        console.log('[ChatManager] 🔑 토큰 추가됨:', session.access_token.substring(0, 20) + '...');
      } else {
        console.warn('[ChatManager] ⚠️ 토큰 없음 - 인증 문제 발생 가능');
      }
      
      // API를 통해 채팅방 생성/초기화
      const response = await fetch('/api/chat/init-room', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderNumber: orderNumber,
          postId: postId
        }),
      });

      console.log('[ChatManager] 📨 API 응답 상태:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ChatManager] ❌ API 요청 실패:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('[ChatManager] ✅ API 응답 데이터:', data);
      
      if (data.error) {
        console.error('[ChatManager] ❌ API 응답 에러:', data.error);
        throw new Error(data.error);
      }

      this.activeChats.add(chatId);
      console.log('[ChatManager] ✅ 채팅 활성화 완료:', { chatId, roomId: data.roomId });
      return true;
    } catch (error) {
      console.error('[ChatManager] ❌ 채팅방 활성화 실패:', {
        chatId,
        error: error?.message,
        stack: error?.stack
      });
      return false;
    }
  }

  public deactivateChat(chatId: string): void {
    this.activeChats.delete(chatId);
    console.log('[ChatManager] 🔄 채팅 비활성화:', chatId);
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
    console.log('[MessageButton] 🖱️ 클릭 이벤트:', { orderNumber, postId, user: user?.id });
    
    if (onClick) {
      console.log('[MessageButton] 🔗 커스텀 onClick 핸들러 실행');
      onClick();
      return;
    }

    if (!user) {
      console.log('[MessageButton] ❌ 사용자 미로그인');
      alert('로그인이 필요합니다.');
      return;
    }

    console.log('[MessageButton] ✅ 사용자 확인 완료:', user.id);
    setIsActivating(true);
    
    try {
      console.log('[MessageButton] 🚀 채팅 활성화 시작...');
      const success = await chatManager.activateChat(orderNumber, postId);
      
      if (!success) {
        console.error('[MessageButton] ❌ 채팅방 활성화 실패');
        throw new Error('채팅방 활성화에 실패했습니다.');
      }

      console.log('[MessageButton] ✅ 채팅방 활성화 성공');
      
      // 채팅 UI 활성화 이벤트 발생
      const eventDetail = { orderNumber, postId };
      console.log('[MessageButton] 📢 이벤트 발생:', eventDetail);
      window.dispatchEvent(new CustomEvent('chat:activate', {
        detail: eventDetail
      }));
    } catch (error) {
      console.error('[MessageButton] ❌ 채팅 활성화 오류:', {
        error: error?.message,
        orderNumber,
        postId
      });
      alert('채팅을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsActivating(false);
      console.log('[MessageButton] 🏁 처리 완료');
    }
  }, [onClick, user, orderNumber, postId, chatManager]);

  const buttonDisabled = disabled || isLoading || isOrderNumberLoading || isActivating || authLoading;
  const shouldDisplayCount = !isLoading && !isOrderNumberLoading && !authLoading && unreadCount > 0;

  if (debug) {
    console.log('[MessageButton] 🐛 디버그 정보:', {
      orderNumber,
      postId,
      unreadCount,
      isLoading,
      isOrderNumberLoading,
      isActivating,
      authLoading,
      buttonDisabled,
      shouldDisplayCount,
      user: user?.id
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