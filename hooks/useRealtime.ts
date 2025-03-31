import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { initializeRealtimeSubscriptions, unsubscribeRealtimeChannel } from '@/lib/supabase';

export function useRealtime() {
  const [channel, setChannel] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 실시간 구독 설정
  useEffect(() => {
    setLoading(true);

    try {
      // 사용자 정의 이벤트 핸들러
      const handleNotification = (payload: any) => {
        if (payload.new) {
          setNotifications(prev => [payload.new, ...prev]);
        }
      };

      const handleMessage = (payload: any) => {
        if (payload.new) {
          setMessages(prev => [payload.new, ...prev]);
        }
      };

      // 커스텀 채널 생성
      const customChannel = supabase.channel('custom-channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'Notification' }, 
            handleNotification)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'Message' }, 
            handleMessage)
        .subscribe();

      setChannel(customChannel);
      setLoading(false);
    } catch (err) {
      console.error('실시간 설정 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }

    // 정리 함수
    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  // 수동으로 알림 목록 갱신
  const refreshNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('Notification')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        throw error;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('알림 목록 갱신 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  // 알림을 읽음 상태로 표시
  const markNotificationAsRead = async (notificationId: number) => {
    try {
      const { error } = await supabase
        .from('Notification')
        .update({ isRead: true })
        .eq('id', notificationId);

      if (error) {
        throw error;
      }

      // 로컬 상태 업데이트
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true } 
            : notification
        )
      );
    } catch (err) {
      console.error('알림 읽음 표시 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return {
    notifications,
    messages,
    loading,
    error,
    refreshNotifications,
    markNotificationAsRead
  };
} 