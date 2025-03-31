import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { initializeRealtimeSubscriptions, unsubscribeRealtimeChannel } from '@/lib/supabase';

// 개발 환경인지 확인
const isDevelopment = process.env.NODE_ENV === 'development';

export function useRealtime() {
  const [channel, setChannel] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [supabaseAvailable, setSupabaseAvailable] = useState(true);

  // 실시간 구독 설정
  useEffect(() => {
    setLoading(true);

    try {
      // 사용자 정의 이벤트 핸들러
      const handleNotification = (payload: any) => {
        if (payload.new) {
          setNotifications(prev => [payload.new, ...prev]);
          
          // 개발 환경에서 확인용 로그
          if (isDevelopment) {
            console.log('실시간 알림 수신:', payload.new);
          }
        }
      };

      const handleMessage = (payload: any) => {
        if (payload.new) {
          setMessages(prev => [payload.new, ...prev]);
          
          // 개발 환경에서 확인용 로그
          if (isDevelopment) {
            console.log('실시간 메시지 수신:', payload.new);
          }
        }
      };

      // Supabase 클라이언트 체크 및 채널 생성
      if (supabase) {
        try {
          // 커스텀 채널 생성 시도
          const customChannel = supabase.channel('custom-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'Notification' }, 
                handleNotification)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'Message' }, 
                handleMessage)
            .subscribe();

          setChannel(customChannel);
          setSupabaseAvailable(true);
          
          if (isDevelopment) {
            console.log('Supabase 실시간 채널 구독 성공');
          }
        } catch (channelError) {
          console.error('Supabase 채널 생성 오류:', channelError);
          setSupabaseAvailable(false);
          
          if (isDevelopment) {
            console.log('Supabase 실시간 채널 생성 실패, 폴백 사용');
          }
        }
      } else {
        setSupabaseAvailable(false);
        if (isDevelopment) {
          console.log('Supabase 클라이언트 사용 불가, 폴백 사용');
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('실시간 설정 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setSupabaseAvailable(false);
      setLoading(false);
    }

    // 정리 함수
    return () => {
      if (channel) {
        try {
          channel.unsubscribe();
          if (isDevelopment) {
            console.log('Supabase 채널 구독 해제');
          }
        } catch (error) {
          console.error('채널 구독 해제 오류:', error);
        }
      }
    };
  }, []);

  // 수동으로 알림 목록 갱신 - Supabase 직접 쿼리 또는 API 폴백
  const refreshNotifications = async () => {
    try {
      setLoading(true);
      
      // Supabase 직접 쿼리 시도
      if (supabaseAvailable && supabase) {
        try {
          const { data, error } = await supabase
            .from('Notification')
            .select('*')
            .order('createdAt', { ascending: false });

          if (error) {
            throw error;
          }

          setNotifications(data || []);
          
          if (isDevelopment) {
            console.log('Supabase 쿼리로 알림 갱신 성공:', data?.length);
          }
          
          setLoading(false);
          return;
        } catch (supabaseError) {
          console.error('Supabase 쿼리 오류, API 폴백으로 전환:', supabaseError);
          // API 폴백으로 진행
        }
      }
      
      // API 폴백: fetch를 사용하여 알림 API 호출
      try {
        if (isDevelopment) {
          console.log('API 폴백으로 알림 데이터 요청 중...');
        }
        
        const response = await fetch('/api/notifications');
        
        if (!response.ok) {
          throw new Error(`API 응답 오류: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.notifications) {
          setNotifications(result.notifications);
          
          if (isDevelopment) {
            console.log('API 폴백으로 알림 갱신 성공:', result.notifications.length);
          }
        } else {
          // 응답 형식이 다른 경우
          setNotifications(Array.isArray(result) ? result : []);
          
          if (isDevelopment) {
            console.log('API 폴백 응답:', result);
          }
        }
      } catch (apiError) {
        console.error('API 폴백 요청 오류:', apiError);
        setError(apiError instanceof Error ? apiError : new Error(String(apiError)));
      }
    } catch (err) {
      console.error('알림 목록 갱신 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  // 알림을 읽음 상태로 표시 - Supabase 직접 쿼리 또는 API 폴백
  const markNotificationAsRead = async (notificationId: number) => {
    try {
      // Supabase 직접 쿼리 시도
      if (supabaseAvailable && supabase) {
        try {
          const { error } = await supabase
            .from('Notification')
            .update({ isRead: true })
            .eq('id', notificationId);

          if (error) {
            throw error;
          }
          
          if (isDevelopment) {
            console.log('Supabase 쿼리로 알림 읽음 처리 성공:', notificationId);
          }
          
          // 로컬 상태 업데이트
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === notificationId 
                ? { ...notification, isRead: true } 
                : notification
            )
          );
          
          return;
        } catch (supabaseError) {
          console.error('Supabase 알림 읽음 처리 오류, API 폴백으로 전환:', supabaseError);
          // API 폴백으로 진행
        }
      }
      
      // API 폴백: fetch를 사용하여 알림 읽음 상태 업데이트
      try {
        if (isDevelopment) {
          console.log('API 폴백으로 알림 읽음 처리 중...');
        }
        
        const response = await fetch(`/api/notifications/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: notificationId }),
        });
        
        if (!response.ok) {
          throw new Error(`API 응답 오류: ${response.status}`);
        }
        
        // 로컬 상태 업데이트
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, isRead: true } 
              : notification
          )
        );
        
        if (isDevelopment) {
          console.log('API 폴백으로 알림 읽음 처리 성공:', notificationId);
        }
      } catch (apiError) {
        console.error('API 폴백 요청 오류:', apiError);
        setError(apiError instanceof Error ? apiError : new Error(String(apiError)));
      }
    } catch (err) {
      console.error('알림 읽음 표시 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // 모든 알림을 읽음 상태로 표시
  const markAllNotificationsAsRead = async () => {
    try {
      // Supabase 직접 쿼리 시도
      if (supabaseAvailable && supabase) {
        try {
          console.log('Supabase로 모든 알림 읽음 처리 시도...');
          
          // 현재 알림 목록에서 읽지 않은 알림 필터링
          const unreadNotificationIds = notifications
            .filter(notification => !notification.isRead)
            .map(notification => notification.id);
            
          if (unreadNotificationIds.length === 0) {
            console.log('읽지 않은 알림이 없습니다.');
            return;
          }
          
          // Supabase에서 모든 읽지 않은 알림 업데이트
          const { error } = await supabase
            .from('Notification')
            .update({ isRead: true })
            .in('id', unreadNotificationIds);

          if (error) {
            throw error;
          }

          // 로컬 상태 업데이트
          setNotifications(prev => 
            prev.map(notification => ({ ...notification, isRead: true }))
          );
          
          if (isDevelopment) {
            console.log(`Supabase로 ${unreadNotificationIds.length}개 알림 일괄 읽음 처리 성공`);
          }
          
          return;
        } catch (supabaseError) {
          console.error('Supabase 일괄 알림 읽음 처리 오류, API 폴백으로 전환:', supabaseError);
          // API 폴백으로 진행
        }
      }
      
      // API 폴백: fetch를 사용하여 모든 알림 읽음 처리
      try {
        if (isDevelopment) {
          console.log('API 폴백으로 모든 알림 읽음 처리 중...');
        }
        
        const response = await fetch('/api/notifications/mark-all-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          throw new Error(`API 응답 오류: ${response.status}`);
        }
        
        // 로컬 상태 업데이트
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
        
        if (isDevelopment) {
          console.log('API 폴백으로 모든 알림 읽음 처리 성공');
        }
      } catch (apiError) {
        console.error('API 폴백 요청 오류:', apiError);
        setError(apiError instanceof Error ? apiError : new Error(String(apiError)));
      }
    } catch (err) {
      console.error('모든 알림 읽음 표시 중 오류:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  return {
    notifications,
    messages,
    loading,
    error,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    supabaseAvailable
  };
} 