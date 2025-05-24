import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';
import { createBrowserClient } from '@/lib/supabase';

export function useRealtimeMessages(
  roomId: string | null,
  onNewMessage?: (message: any) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 채널 참조를 저장하기 위한 ref
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      console.log(`[📡 실시간 구독] roomId가 없어서 구독하지 않음`);
      return;
    }

    console.log(`[📡 실시간 구독 시작] roomId: ${roomId}`);
    setError(null);

    // 기존 채널이 있다면 정리
    if (channelRef.current) {
      console.log(`[📡 이전 채널 정리] 새 구독을 위해 정리`);
      createBrowserClient().removeChannel(channelRef.current);
      channelRef.current = null;
      subscribedRef.current = false;
    }

    // 새 채널 구독
    const channel = createBrowserClient()
      .channel(`room_messages:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log(`[📡 새 메시지 수신] roomId: ${roomId}`, payload);
          
          if (onNewMessage && payload.new) {
            onNewMessage(payload.new);
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        console.log(`[📡 Presence 동기화] roomId: ${roomId}`);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`[📡 사용자 입장] roomId: ${roomId}, key: ${key}`, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(`[📡 사용자 퇴장] roomId: ${roomId}, key: ${key}`, leftPresences);
      })
      .subscribe((status) => {
        console.log(`[📡 구독 상태 변경] roomId: ${roomId}, status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          subscribedRef.current = true;
          console.log(`[📡 실시간 구독 성공] roomId: ${roomId}`);
        } else if (status === 'CHANNEL_ERROR') {
          setError('실시간 연결에 실패했습니다');
          setIsConnected(false);
          subscribedRef.current = false;
          console.error(`[📡 실시간 구독 실패] roomId: ${roomId}`);
        } else if (status === 'TIMED_OUT') {
          setError('실시간 연결이 시간 초과되었습니다');
          setIsConnected(false);
          subscribedRef.current = false;
          console.error(`[📡 실시간 구독 시간 초과] roomId: ${roomId}`);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
          subscribedRef.current = false;
          console.log(`[📡 실시간 구독 종료] roomId: ${roomId}`);
        }
      });

    // 채널 참조 저장
    channelRef.current = channel;

    // 정리 함수
    return () => {
      if (channelRef.current) {
        console.log(`[📡 실시간 구독 정리] roomId: ${roomId}`);
        createBrowserClient().removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedRef.current = false;
      }
      setIsConnected(false);
    };
  }, [roomId, onNewMessage]);

  return { isConnected, error };
} 