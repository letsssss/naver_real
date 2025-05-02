'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export function useUnreadMessages(orderNumber?: string) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // 사용자가 로그인되어 있지 않다면 API 호출을 건너뜁니다
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function fetchUnreadMessages() {
      try {
        setIsLoading(true);
        
        // 디버깅 로그: 메시지 가져오기 시작
        console.log(`🔄 읽지 않은 메시지 가져오기 시작... userId: ${user.id}, orderNumber: ${orderNumber || 'none'}`);
        
        // 토큰 가져오기 (두 가지 가능한 위치 확인)
        const token = localStorage.getItem('token') || 
                      localStorage.getItem('sb-jdubrjczdyqqtsppojgu-auth-token');
        
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
        console.log('📊 API 응답 데이터:', data);
        
        setUnreadCount(data.count || 0);
      } catch (err) {
        console.error('❌ 읽지 않은 메시지 가져오기 실패:', err);
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
  }, [orderNumber, user]);

  return { unreadCount, isLoading, error };
} 