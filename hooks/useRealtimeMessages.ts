'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

type ChannelStatus = REALTIME_SUBSCRIBE_STATES | 'SUBSCRIBE_ERROR';

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
  const cleanupInProgressRef = useRef(false);
  const retryConfigRef = useRef<RetryConfig>({
    maxRetries: 5,
    retryInterval: 2000,
    currentRetry: 0
  });
  const lastConnectionAttemptRef = useRef<number>(0);
  const CONNECTION_THROTTLE = 2000; // 2초 동안 재연결 시도 방지

  // Cleanup function for subscription
  const cleanupSubscription = useCallback(async (isReconnecting: boolean = false) => {
    if (cleanupInProgressRef.current) {
      console.log('[Cleanup] Cleanup already in progress, skipping');
      return;
    }

    try {
      cleanupInProgressRef.current = true;

      // Clear timeout first to prevent any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }

      const channel = channelRef.current;
      if (!channel) {
        console.log('[Cleanup] No channel to cleanup');
        return;
      }

      // Store channel reference and clear refs immediately
      const currentChannel = channelRef.current;
      channelRef.current = null;
      
      if (!isReconnecting) {
        currentRoomIdRef.current = null;
      }

      // Only update connection state if component is still mounted
      if (isMountedRef.current) {
        setIsConnected(false);
      }

      // Unsubscribe with timeout
      const unsubscribePromise = Promise.race([
        currentChannel.unsubscribe(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Unsubscribe timeout')), 2000))
      ]).catch(error => {
        console.error('[Error] Unsubscribe failed:', error);
      });

      await unsubscribePromise;
      console.log('[Cleanup] Channel unsubscribed');

      // Remove channel with timeout
      try {
        const supabase = await getSupabaseClient();
        if (supabase && currentChannel) {
          await Promise.race([
            supabase.removeChannel(currentChannel),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Remove channel timeout')), 2000))
          ]);
          console.log('[Cleanup] Channel removed from Supabase client');
        }
      } catch (removeError) {
        console.error('[Error] Failed to remove channel:', removeError);
      }

      console.log('[Cleanup] Cleanup completed');
    } catch (error) {
      console.error('[Error] Failed during cleanup:', error);
    } finally {
      if (!isReconnecting) {
        cleanupInProgressRef.current = false;
      }
    }
  }, []);

  const shouldAttemptReconnection = useCallback(() => {
    if (!isMountedRef.current || !roomId) return false;
    if (cleanupInProgressRef.current) return false;
    if (isSubscribingRef.current) return false;

    const now = Date.now();
    if (now - lastConnectionAttemptRef.current < CONNECTION_THROTTLE) {
      console.log('[Reconnect] Throttled reconnection attempt');
      return false;
    }

    const { maxRetries, currentRetry } = retryConfigRef.current;
    if (currentRetry >= maxRetries) {
      console.log('[Reconnect] Max retries reached');
      setError('연결을 재시도할 수 없습니다.');
      return false;
    }

    return true;
  }, [roomId]);

  const attemptReconnection = useCallback(async () => {
    if (!shouldAttemptReconnection()) return;

    lastConnectionAttemptRef.current = Date.now();
    const { retryInterval, currentRetry } = retryConfigRef.current;

    console.log(`[Reconnect] Attempting reconnection (${currentRetry + 1}/${retryConfigRef.current.maxRetries})`);
    
    try {
      await cleanupSubscription(true);
      await initializeSubscription(true);
      retryConfigRef.current.currentRetry = 0;
    } catch (error) {
      console.error('[Reconnect] Failed:', error);
      retryConfigRef.current.currentRetry++;
      
      if (shouldAttemptReconnection()) {
        reconnectTimeoutRef.current = setTimeout(() => {
          attemptReconnection();
        }, retryInterval);
      }
    }
  }, [cleanupSubscription, shouldAttemptReconnection]);

  // Initialize subscription
  const initializeSubscription = useCallback(async (isRetry: boolean = false) => {
    if (!roomId || !isMountedRef.current) {
      console.log('[Init] No room ID or component unmounted');
      return;
    }

    if (isSubscribingRef.current || cleanupInProgressRef.current) {
      console.log('[Init] Subscription or cleanup in progress, skipping');
      return;
    }

    const now = Date.now();
    if (!isRetry && now - lastConnectionAttemptRef.current < CONNECTION_THROTTLE) {
      console.log('[Init] Throttled initialization attempt');
      return;
    }

    if (!isRetry && channelRef.current && currentRoomIdRef.current === roomId && isConnected) {
      console.log('[Init] Channel already exists and connected');
      return;
    }

    try {
      isSubscribingRef.current = true;
      lastConnectionAttemptRef.current = now;
      
      console.log(`[Info] Initializing subscription for room: ${roomId}`);

      // Ensure any existing connection is cleaned up first
      if (channelRef.current) {
        await cleanupSubscription(true);
      }

      // Double check if component is still mounted after cleanup
      if (!isMountedRef.current) {
        console.log('[Init] Component unmounted during initialization');
        return;
      }

      const supabase = await getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      // Create new channel with broadcast and presence options
      const channel = supabase.channel(`realtime:public:messages:${roomId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: '' },
        },
      });

      // Store channel reference before setting up handlers
      channelRef.current = channel;
      currentRoomIdRef.current = roomId;

      // Set up message handler
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (!isMountedRef.current) return;
        if (payload.eventType === 'INSERT') {
          onNewMessage?.(payload.new);
        }
      }).on('system', { event: 'disconnect' }, () => {
        if (isMountedRef.current && !cleanupInProgressRef.current) {
          console.log('[System] Disconnected, attempting reconnection');
          attemptReconnection();
        }
      });

      // Subscribe to the channel with a timeout
      const subscribePromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Subscription timeout'));
        }, 10000);

        channel.subscribe(async (status: ChannelStatus) => {
          if (!isMountedRef.current) {
            clearTimeout(timeoutId);
            return;
          }

          console.log(`[Status] Channel status: ${status}`);
          
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            clearTimeout(timeoutId);
            if (isMountedRef.current) {
              setIsConnected(true);
              setError(null);
              retryConfigRef.current.currentRetry = 0;
            }
            resolve(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'SUBSCRIBE_ERROR') {
            clearTimeout(timeoutId);
            if (isMountedRef.current) {
              setError('채팅 연결 오류가 발생했습니다.');
              setIsConnected(false);
            }
            if (!cleanupInProgressRef.current) {
              reject(new Error('Channel error'));
            }
          } else if (status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
            clearTimeout(timeoutId);
            if (isMountedRef.current) {
              setError('연결 시간이 초과되었습니다.');
              setIsConnected(false);
            }
            if (!cleanupInProgressRef.current) {
              reject(new Error('Connection timeout'));
            }
          } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
            clearTimeout(timeoutId);
            if (isMountedRef.current) {
              setIsConnected(false);
            }
            if (isMountedRef.current && currentRoomIdRef.current === roomId && !cleanupInProgressRef.current) {
              reject(new Error('Connection closed'));
            }
          }
        });
      });

      await subscribePromise;

    } catch (error) {
      if (isMountedRef.current) {
        console.error('[Error] Subscription initialization failed:', error);
        setError(error instanceof Error ? error.message : '채팅 연결에 실패했습니다.');
        if (!cleanupInProgressRef.current) {
          await cleanupSubscription(true);
          attemptReconnection();
        }
      }
    } finally {
      isSubscribingRef.current = false;
    }
  }, [roomId, onNewMessage, isConnected, cleanupSubscription, attemptReconnection]);

  // Handle component mount/unmount and roomId changes
  useEffect(() => {
    isMountedRef.current = true;
    retryConfigRef.current.currentRetry = 0;
    lastConnectionAttemptRef.current = 0;
    cleanupInProgressRef.current = false;

    let setupTimeoutId: NodeJS.Timeout;

    const setupConnection = async () => {
      if (roomId && roomId !== currentRoomIdRef.current) {
        // Add a delay to handle rapid mount/unmount cycles
        setupTimeoutId = setTimeout(async () => {
          if (isMountedRef.current) {
            await initializeSubscription();
          }
        }, 300);
      }
    };

    setupConnection();

    return () => {
      isMountedRef.current = false;
      clearTimeout(setupTimeoutId);
      
      // Synchronous cleanup to ensure it runs before component is fully unmounted
      const cleanup = () => {
        const channel = channelRef.current;
        if (channel) {
          try {
            // Immediate unsubscribe without waiting
            channel.unsubscribe();
            console.log('[Unmount] Channel unsubscribed');
            
            // Clear refs
            channelRef.current = null;
            currentRoomIdRef.current = null;
            
            // Set cleanup flag
            cleanupInProgressRef.current = true;
          } catch (error) {
            console.error('[Unmount] Cleanup error:', error);
          }
        }
      };
      
      cleanup();
    };
  }, [roomId, initializeSubscription]);

  return { isConnected, error };
} 