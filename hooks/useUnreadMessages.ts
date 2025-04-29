import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export function useUnreadMessages(orderNumber?: string) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      console.log('🔄 useUnreadMessages: 유저 정보 없음, 메시지 조회 생략');
      setIsLoading(false);
      return;
    }

    const fetchUnreadMessages = async () => {
      setIsLoading(true);
      try {
        console.log(`🔄 useUnreadMessages: 메시지 조회 시작, orderNumber=${orderNumber || 'undefined'}`);
        
        // 특정 주문번호에 대한 메시지 수를 가져오는 엔드포인트
        const endpoint = orderNumber 
          ? `/api/messages/unread-count?orderNumber=${orderNumber}`
          : '/api/messages/unread-count';
        
        // 로컬스토리지에서 토큰 가져오기
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.error('🔒 토큰이 없습니다.');
          setError(new Error('인증 토큰이 없습니다.'));
          setIsLoading(false);
          return;
        }
        
        console.log(`🔑 토큰: ${token ? '있음' : '없음'}`);
        
        // API 요청 보내기
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        console.log(`🌐 API 응답 상태: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ API 응답 오류: ${errorText}`);
          throw new Error(`메시지 정보를 불러오는데 실패했습니다. (${response.status})`);
        }

        const data = await response.json();
        console.log(`✅ API 응답 데이터:`, data);
        
        setUnreadCount(data.count || 0);
      } catch (err) {
        console.error('📛 읽지 않은 메시지 조회 오류:', err);
        setError(err instanceof Error ? err : new Error('알 수 없는 오류가 발생했습니다.'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadMessages();

    // 60초마다 업데이트
    const intervalId = setInterval(fetchUnreadMessages, 60000);
    
    return () => clearInterval(intervalId);
  }, [user, orderNumber]);

  return { unreadCount, isLoading, error };
} 