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
// 각 주문번호별 캐시와 전역 캐시를 별도로 관리
const globalMessageCache: MessageCache = {};

export function useUnreadMessages(orderNumber?: string) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const MAX_RETRIES = 3;

  // 디버깅을 위한 상태 추가
  const [debugData, setDebugData] = useState<any>(null);
  
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      // 사용자가 없으면 실행하지 않음
      if (!user?.id) {
        console.log('사용자 정보가 없어 메시지 개수를 조회하지 않습니다.');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        console.log(`📱 메시지 개수 조회 시작: userId=${user.id}, orderNumber=${orderNumber || '없음'}`);
        
        // 현재 브라우저의 호스트 사용 (개발/프로덕션 환경 자동 감지)
        const host = window.location.origin;
        const apiUrl = orderNumber 
          ? `${host}/api/messages/unread-count?userId=${user.id}&orderNumber=${orderNumber}`
          : `${host}/api/messages/unread-count?userId=${user.id}`;
        
        // 요청 전 캐시 확인
        const cacheKey = orderNumber 
          ? `message-count-${user.id}-${orderNumber}` 
          : `message-count-${user.id}`;

        const cachedData = globalMessageCache[cacheKey];
        const now = Date.now();
        
        // 최근 10초 이내 캐시된 데이터가 있으면 사용
        if (cachedData && (now - cachedData.timestamp < 10000)) {
          console.log(`🗂️ 캐시된 메시지 개수 사용: ${cachedData.count} (orderNumber: ${orderNumber || '없음'})`);
          setUnreadCount(cachedData.count);
          setIsLoading(false);
          return;
        }
        
        // API 요청 헤더 설정
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };
        
        // 토큰 가져오기 - localStorage에서 토큰 확인
        const token = localStorage.getItem('token') || 
                     localStorage.getItem('sb-jdubrjczdyqqtsppojgu-auth-token');
                     
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('🔑 토큰을 헤더에 추가했습니다.');
        } else {
          console.log('⚠️ 토큰이 없습니다.');
        }
        
        // API 요청
        const response = await fetch(apiUrl, { 
          method: 'GET',
          headers
        });
        
        // 응답 확인
        if (!response.ok) {
          console.error(`❌ API 오류: HTTP ${response.status} - ${response.statusText}`);
          
          // 응답 내용까지 로깅
          try {
            const errorText = await response.text();
            console.error(`❌ 에러 응답 내용: ${errorText}`);
            
            // 접근 권한 오류 (401)인 경우 재인증 제안
            if (response.status === 401) {
              throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
            } else {
              throw new Error(`API 오류: ${response.status} ${response.statusText}`);
            }
          } catch (responseError) {
            throw responseError;
          }
        }
        
        // 응답 데이터 파싱
        const data = await response.json();
        
        console.log(`✅ 메시지 개수 조회 결과:`, data);
        
        // 디버그 데이터 설정
        if (data.debug) {
          setDebugData(data.debug);
          console.log(`🔍 디버그 정보:`, data.debug);
        }
        
        // 유효한 카운트 값이 있는지 확인
        if (typeof data.count === 'number') {
          // 캐시 업데이트
          globalMessageCache[cacheKey] = {
            count: data.count,
            timestamp: now
          };
          
          setUnreadCount(data.count);
          setRetryCount(0); // 성공하면 재시도 카운트 초기화
        } else {
          console.warn('⚠️ API 응답에 유효한 count 값이 없습니다:', data);
          // 데이터가 없으면 0으로 설정
          setUnreadCount(0);
        }
      } catch (err: any) {
        console.error('❌ 메시지 개수 조회 중 오류:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        
        // 오류 시 재시도 로직 (최대 3회)
        if (retryCount < MAX_RETRIES) {
          const nextRetry = retryCount + 1;
          setRetryCount(nextRetry);
          
          console.log(`🔄 메시지 개수 조회 재시도 (${nextRetry}/${MAX_RETRIES})...`);
          
          // 지수 백오프로 재시도 - 1초, 2초, 4초 간격
          setTimeout(() => {
            fetchUnreadMessages();
          }, Math.pow(2, nextRetry) * 1000);
        } else {
          console.error(`❌ 최대 재시도 횟수(${MAX_RETRIES})를 초과했습니다.`);
          // 오류 상태에서도 UI가 깨지지 않도록 0 설정
          setUnreadCount(0);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadMessages();

    // 주기적으로 메시지 개수 업데이트 (60초마다)
    const intervalId = setInterval(fetchUnreadMessages, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, orderNumber, retryCount]);

  return { unreadCount, isLoading, error, debugData };
} 