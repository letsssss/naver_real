import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export function useUnreadMessages(orderNumber?: string) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchUnreadMessages = async () => {
      setIsLoading(true);
      try {
        // 특정 주문번호에 대한 메시지 수를 가져오는 엔드포인트
        const endpoint = orderNumber 
          ? `/api/messages/unread-count?orderNumber=${orderNumber}`
          : '/api/messages/unread-count';
        
        const token = localStorage.getItem('token');
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('메시지 정보를 불러오는데 실패했습니다.');
        }

        const data = await response.json();
        setUnreadCount(data.count || 0);
      } catch (err) {
        console.error('읽지 않은 메시지 조회 오류:', err);
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