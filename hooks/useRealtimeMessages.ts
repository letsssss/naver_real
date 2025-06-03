'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'SUBSCRIBE_ERROR' | 'joined' | 'joining' | string;

interface RetryConfig {
  maxRetries: number;
  retryInterval: number;
  currentRetry: number;
}

export function useRealtimeMessages(
  roomId: string | null,
  onNewMessage?: (message: any) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // refs for managing subscription state
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const currentRoomIdRef = useRef<string | null>(null);
  const isSubscribingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const retryConfigRef = useRef<RetryConfig>({
    maxRetries: 5,
    retryInterval: 2000,
    currentRetry: 0
  });

  // Cleanup function for subscription
  const cleanupSubscription = useCallback(async () => {
    try {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }

      const channel = channelRef.current;
      if (!channel) {
        return;
      }

      const supabase = await getSupabaseClient();
      if (!supabase) {
        return;
      }

      console.log(`[Cleanup] Starting cleanup for room: ${currentRoomIdRef.current}`);
      
      try {
        console.log(`[Cleanup] Unsubscribing from room: ${currentRoomIdRef.current}`);
        await channel.unsubscribe();
      } catch (unsubError) {
        console.error('[Error] Failed to unsubscribe:', unsubError);
      }

      try {
        console.log(`[Cleanup] Removing channel for room: ${currentRoomIdRef.current}`);
        await supabase.removeChannel(channel);
      } catch (removeError) {
        console.error('[Error] Failed to remove channel:', removeError);
      }
    } catch (error) {
      console.error('[Error] Failed during cleanup:', error);
    } finally {
      channelRef.current = null;
      currentRoomIdRef.current = null;
      setIsConnected(false);
      console.log('[Cleanup] Cleanup completed');
    }
  }, []);

  const attemptReconnection = useCallback(async () => {
    if (!isMountedRef.current || !roomId) return;

    const { maxRetries, retryInterval, currentRetry } = retryConfigRef.current;

    if (currentRetry >= maxRetries) {
      console.log('[Reconnect] Max retries reached');
      setError('연결을 재시도할 수 없습니다.');
      return;
    }

    console.log(`[Reconnect] Attempting reconnection (${currentRetry + 1}/${maxRetries})`);
    
    try {
      await cleanupSubscription();
      await initializeSubscription(true);
      retryConfigRef.current.currentRetry = 0;
    } catch (error) {
      console.error('[Reconnect] Failed:', error);
      retryConfigRef.current.currentRetry++;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        attemptReconnection();
      }, retryInterval);
    }
  }, [roomId, cleanupSubscription]);

  // Initialize subscription
  const initializeSubscription = useCallback(async (isRetry: boolean = false) => {
    if (!roomId || !isMountedRef.current || isSubscribingRef.current) {
      console.log('[Info] Skipping subscription initialization:', {
        roomId: !!roomId,
        isMounted: isMountedRef.current,
        isSubscribing: isSubscribingRef.current
      });
      return;
    }

    if (!isRetry && channelRef.current && currentRoomIdRef.current === roomId && isConnected) {
      console.log(`[Info] Already subscribed to room: ${roomId}`);
      return;
    }

    try {
      isSubscribingRef.current = true;
      console.log(`[Info] Initializing subscription for room: ${roomId}`);

      if (channelRef.current || currentRoomIdRef.current) {
        console.log('[Info] Cleaning up existing subscription before initializing new one');
        await cleanupSubscription();
      }

      const supabase = await getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      if (!isMountedRef.current) {
        console.log('[Info] Component unmounted during initialization');
        return;
      }

      // Create new channel
      const channel = supabase.channel(`room:${roomId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: '' },
        },
      });

      // Set up event handlers before subscribing
      channel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        }, (payload) => {
          if (!isMountedRef.current) return;
          console.log(`[Message] New message in room ${roomId}:`, payload);
          if (payload.eventType === 'INSERT') {
            onNewMessage?.(payload.new);
          }
        })
        .on('system', { event: 'disconnect' }, () => {
          console.log('[System] Disconnected');
          setIsConnected(false);
          if (isMountedRef.current) {
            attemptReconnection();
          }
        });

      // Store the channel reference
      channelRef.current = channel;
      
      // Subscribe to the channel
      const status = await channel.subscribe((status: string) => {
        console.log(`[Status] Subscription status: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log(`[Success] Subscribed to room: ${roomId}`);
          setIsConnected(true);
          currentRoomIdRef.current = roomId;
          setError(null);
        } else if (status === 'CHANNEL_ERROR' || status === 'SUBSCRIBE_ERROR') {
          console.error(`[Error] Channel error for room: ${roomId}`);
          setError('Connection error occurred');
          attemptReconnection();
        } else if (status === 'TIMED_OUT') {
          console.error(`[Error] Connection timed out for room: ${roomId}`);
          setError('Connection timed out');
          attemptReconnection();
        } else if (status === 'CLOSED') {
          console.log(`[Info] Channel closed for room: ${roomId}`);
          setIsConnected(false);
          if (isMountedRef.current) {
            attemptReconnection();
          }
        }
      });

      if (!status) {
        throw new Error('Failed to subscribe to channel');
      }

    } catch (error) {
      console.error('[Error] Subscription initialization failed:', error);
      setError(error instanceof Error ? error.message : 'Subscription failed');
      await cleanupSubscription();
      attemptReconnection();
    } finally {
      isSubscribingRef.current = false;
    }
  }, [roomId, onNewMessage, isConnected, cleanupSubscription, attemptReconnection]);

  // Handle component mount/unmount and roomId changes
  useEffect(() => {
    isMountedRef.current = true;
    retryConfigRef.current.currentRetry = 0;

    if (roomId !== currentRoomIdRef.current) {
      initializeSubscription();
    }

    return () => {
      isMountedRef.current = false;
      cleanupSubscription();
    };
  }, [roomId, initializeSubscription, cleanupSubscription]);

  return { isConnected, error };
} 