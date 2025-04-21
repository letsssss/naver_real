import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';
import supabase from '@/lib/supabase-browser';

export function useRealtimeMessages(
  roomId: string, 
  onNewMessage: (msg: any) => void, 
  userId?: string
) {
  // 채널 참조를 저장하기 위한 ref 생성
  const channelRef = useRef<RealtimeChannel | null>(null);
  // 이미 구독 중인지 확인하기 위한 ref
  const subscribedRef = useRef<boolean>(false);
  // onNewMessage 콜백을 ref로 저장 (의존성 없이 최신 참조 유지)
  const onNewMessageRef = useRef(onNewMessage);
  
  // onNewMessage가 변경될 때마다 ref 업데이트
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    // roomId가 없으면 구독 불가
    if (!roomId) {
      console.log(`[📡 구독 건너뜀] roomId가 없습니다.`);
      return;
    }
    
    // userId가 없으면 RLS 정책을 통과할 수 없음
    if (!userId) {
      console.log(`[📡 구독 건너뜀] userId가 없어 RLS 정책을 통과할 수 없습니다. roomId: ${roomId}`);
      return;
    }

    // 이미 같은 roomId에 구독 중이면 중복 구독 방지
    if (channelRef.current && subscribedRef.current) {
      console.log(`[📡 중복 구독 방지] 이미 구독 중입니다. roomId: ${roomId}`);
      return;
    }

    // 기존 채널 제거
    if (channelRef.current) {
      console.log(`[📡 이전 채널 정리] 새 구독을 위해 정리`);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      subscribedRef.current = false;
    }
    
    console.log(`[📡 실시간 구독 시작] roomId: ${roomId}, userId: ${userId}`);

    // 새 채널 구독
    const channel = supabase
      .channel(`room_messages:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const message = payload.new;
          
          // 현재 유저가 수신자 또는 발신자인 경우만 처리
          if (message.sender_id !== userId && message.receiver_id !== userId) {
            console.log(`[📩 메시지 무시] 현재 유저(${userId})와 관련 없는 메시지입니다.`, 
              `sender: ${message.sender_id}, receiver: ${message.receiver_id}`);
            return; // 무시
          }
          
          console.log(`[📩 새 메시지 수신] id: ${message.id}, sender: ${message.sender_id}`);
          // ref를 통해 최신 콜백 사용
          onNewMessageRef.current(message);
        }
      )
      .subscribe((status) => {
        console.log('[📡 실시간 채널 상태]', status);
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          console.log(`[📡 채널 구독 성공] roomId: ${roomId}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          subscribedRef.current = false;
          console.log(`[❌ 채널 오류/종료] 상태: ${status}, roomId: ${roomId}`);
          
          // 연결이 끊어졌을 때 자동 재연결 시도
          if (status === 'CLOSED') {
            console.log('[📡 채널 재연결 시도]', roomId);
            setTimeout(() => {
              if (!subscribedRef.current && channelRef.current) {
                channelRef.current.subscribe();
              }
            }, 2000);
          }
        }
      });

    channelRef.current = channel;

    // 컴포넌트 언마운트 또는 의존성 변경 시 정리
    return () => {
      if (channelRef.current) {
        console.log(`[📡 실시간 구독 정리] roomId: ${roomId}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedRef.current = false;
      }
    };
  }, [roomId, userId]); // userId를 의존성 배열에 포함
} 