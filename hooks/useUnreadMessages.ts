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

export function useUnreadMessages(orderNumber?: string) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  
  // 요청 캐시 키
  const cacheKey = orderNumber 
    ? `${user?.id || 'guest'}_${orderNumber}` 
    : `${user?.id || 'guest'}_all`;

  useEffect(() => {
    // 사용자가 로그인되어 있지 않다면 API 호출을 건너뜁니다
    if (!user) {
      setIsLoading(false);
      return;
    }

    // 캐시에서 데이터를 먼저 확인 (30초 이내의 데이터만 사용)
    const cachedData = globalMessageCache[cacheKey];
    const now = Date.now();
    
    if (cachedData && (now - cachedData.timestamp < 30000)) {
      console.log(`🗂️ 캐시에서 메시지 수 사용: ${cachedData.count} (orderNumber: ${orderNumber || 'all'})`);
      setUnreadCount(cachedData.count);
      setIsLoading(false);
    }

    async function fetchUnreadMessages() {
      try {
        setIsLoading(true);
        
        // 디버깅 로그: 메시지 가져오기 시작
        console.log(`🔄 읽지 않은 메시지 가져오기 시작... userId: ${user.id}, orderNumber: ${orderNumber || 'none'}`);
        
        // 토큰 가져오기 (두 가지 가능한 위치 확인)
        const token = localStorage.getItem('token') || 
                      localStorage.getItem('sb-jdubrjczdyqqtsppojgu-auth-token') ||
                      localStorage.getItem('auth-token');
        
        if (!token) {
          console.error('🚫 토큰이 없어 API 호출을 취소합니다.');
          setError(new Error('Authentication token not found'));
          setIsLoading(false);
          return;
        }
        
        console.log(`🔑 토큰 존재 여부: ${!!token}`);
        console.log(`🔑 토큰 길이: ${token.length}`);
        console.log(`🔑 토큰 미리보기: ${token.substring(0, 20)}...`);
        
        // 쿠키 정보도 확인
        console.log('🍪 쿠키 정보:', document.cookie);
        
        // 현재 호스트를 기준으로 API URL 구성
        const baseUrl = window.location.origin;
        let endpoint = `${baseUrl}/api/messages/unread-count?userId=${user.id}`;
        if (orderNumber) {
          endpoint += `&orderNumber=${orderNumber}`;
        }
        
        console.log(`🌐 API 요청 URL: ${endpoint}`);
        
        // API 요청 헤더
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        
        console.log('📤 API 요청 헤더:', headers);
        
        // API 호출
        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
          credentials: 'include'  // 쿠키를 포함하여 요청
        });
        
        console.log(`📥 API 응답 상태: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch unread messages: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`📊 API 응답 데이터 [${orderNumber || 'all'}]:`, data);
        
        // 응답 데이터 저장 및 캐싱
        const count = data.count || 0;
        setUnreadCount(count);
        
        // 캐시에 저장
        globalMessageCache[cacheKey] = {
          count,
          timestamp: Date.now()
        };
        
        console.log(`💾 메시지 수 캐시 업데이트: ${count} (orderNumber: ${orderNumber || 'all'})`);
      } catch (err) {
        console.error(`❌ 읽지 않은 메시지 가져오기 실패 [${orderNumber || 'all'}]:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }

    fetchUnreadMessages();
    
    // 일정 시간마다 메시지 업데이트 (필요에 따라 조정 가능)
    const intervalId = setInterval(fetchUnreadMessages, 60000); // 60초마다 갱신
    
    // 컴포넌트 언마운트시 인터벌 정리
    return () => clearInterval(intervalId);
  }, [orderNumber, user, cacheKey]);

  return { unreadCount, isLoading, error };
} 