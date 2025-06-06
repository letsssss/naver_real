'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';

// 캐시 타입 정의
interface MessageCache {
  [key: string]: {
    count: number;
    timestamp: number;
  }
}

// 전역 캐시 객체 - 컴포넌트 간 공유
const globalMessageCache: MessageCache = {};

// 캐시 유효 시간 (10초)
const CACHE_DURATION = 10000;
// API 호출 디바운스 시간 (1초)
const API_DEBOUNCE_DELAY = 1000;
// 주기적 업데이트 간격 (1분)
const UPDATE_INTERVAL = 60000;

export function useUnreadMessages(orderNumber?: string) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  
  const isMountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout>();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const MAX_RETRIES = 3;

  // API 호출 함수
  const fetchUnreadMessages = async () => {
    // 사용자가 없으면 실행하지 않음
    if (!user?.id || !isMountedRef.current) {
      console.log('[Debug] No user info available');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`[Debug] Fetching message count: userId=${user.id}, orderNumber=${orderNumber || 'none'}`);
      
      // 캐시 키 생성
      const cacheKey = orderNumber 
        ? `message-count-${user.id}-${orderNumber}` 
        : `message-count-${user.id}`;

      // 캐시 확인
      const cachedData = globalMessageCache[cacheKey];
      const now = Date.now();
      
      // 유효한 캐시가 있으면 사용
      if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
        console.log(`[Debug] Using cached count: ${cachedData.count}`);
        if (isMountedRef.current) {
          setUnreadCount(cachedData.count);
          setIsLoading(false);
        }
        return;
      }

      // API 엔드포인트 URL 구성
      const params = new URLSearchParams();
      params.append('userId', user.id);
      if (orderNumber) {
        params.append('orderNumber', orderNumber);
      }

      // API 호출 - 우리가 만든 백엔드 엔드포인트 사용
      const response = await fetch(`/api/messages/unread-count?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const messageCount = data.count || 0;
      
      // Update cache
      globalMessageCache[cacheKey] = {
        count: messageCount,
        timestamp: now
      };

      if (isMountedRef.current) {
        setUnreadCount(messageCount);
        setRetryCount(0);
      }
    } catch (err) {
      console.error('[Error] Failed to fetch message count:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        
        if (retryCount < MAX_RETRIES) {
          const nextRetry = retryCount + 1;
          setRetryCount(nextRetry);
          
          console.log(`[Debug] Retrying message count (${nextRetry}/${MAX_RETRIES})...`);
          
          timeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              fetchUnreadMessages();
            }
          }, Math.pow(2, nextRetry) * 1000);
        } else {
          console.error(`[Error] Max retry count (${MAX_RETRIES}) exceeded`);
          setUnreadCount(0);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // API 호출 디바운스 처리
  const debouncedFetch = useRef<NodeJS.Timeout>();
  
  const scheduleDebouncedFetch = () => {
    if (debouncedFetch.current) {
      clearTimeout(debouncedFetch.current);
    }
    debouncedFetch.current = setTimeout(fetchUnreadMessages, API_DEBOUNCE_DELAY);
  };

  // 컴포넌트 마운트/언마운트 및 의존성 변경 처리
  useEffect(() => {
    isMountedRef.current = true;
    
    // 초기 데이터 로딩
    scheduleDebouncedFetch();

    // 주기적 업데이트 설정
    intervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        scheduleDebouncedFetch();
      }
    }, UPDATE_INTERVAL);

    // 정리 함수
    return () => {
      isMountedRef.current = false;
      if (debouncedFetch.current) {
        clearTimeout(debouncedFetch.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, orderNumber]);

  return { unreadCount, isLoading, error };
} 