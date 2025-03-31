'use client';

import { useEffect, useState } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bell, Mail, Check, Wifi, WifiOff } from 'lucide-react';
import Link from 'next/link';

// 개발 환경인지 확인
const isDevelopment = process.env.NODE_ENV === 'development';

export default function RealTimeNotifications() {
  const { 
    notifications, 
    messages, 
    loading, 
    error, 
    refreshNotifications, 
    markNotificationAsRead,
    markAllNotificationsAsRead,
    supabaseAvailable
  } = useRealtime();
  
  // 마지막으로 표시한 알림 ID 추적 (중복 토스트 방지)
  const [lastShownNotificationId, setLastShownNotificationId] = useState<number | null>(null);

  // 초기 데이터 로딩
  useEffect(() => {
    refreshNotifications();
    
    // 주기적 갱신 설정 (30초마다)
    const intervalId = setInterval(() => {
      refreshNotifications();
      if (isDevelopment) {
        console.log('알림 주기적 갱신 실행');
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // 새 알림이 도착할 때 토스트 메시지 표시
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      
      // 이미 표시된 알림인지 확인 (ID로 중복 방지)
      if (!latestNotification.isRead && 
          latestNotification.id !== lastShownNotificationId) {
        // 알림 ID 업데이트
        setLastShownNotificationId(latestNotification.id);
        
        // 토스트 메시지 표시
        toast.info('새 알림이 도착했습니다', {
          description: latestNotification.message,
          action: {
            label: '확인',
            onClick: () => markNotificationAsRead(latestNotification.id)
          },
          duration: 5000 // 5초간 표시
        });
        
        // 개발 환경에서 확인용 로그
        if (isDevelopment) {
          console.log('토스트 알림 표시:', latestNotification);
        }
      }
    }
  }, [notifications, lastShownNotificationId]);

  // 알림 아이콘 선택 함수
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE':
        return <Mail className="h-4 w-4" />;
      case 'TICKET_REQUEST':
        return <Bell className="h-4 w-4 text-blue-500" />;
      case 'PURCHASE_STATUS':
        return <Bell className="h-4 w-4 text-green-500" />;
      case 'PURCHASE_COMPLETE':
        return <Bell className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  if (loading && notifications.length === 0) {
    return <div className="text-center p-4">알림 로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        알림을 불러오는 중 오류가 발생했습니다
        <Button variant="outline" onClick={refreshNotifications} className="ml-2">
          다시 시도
        </Button>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // 모든 알림 읽음 처리 기능
  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) {
      toast.info('모든 알림이 이미 읽음 상태입니다.');
      return;
    }
    
    markAllNotificationsAsRead();
    toast.success(`${unreadCount}개의 알림이 읽음 처리되었습니다.`);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">
            알림 
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </h2>
          
          {/* Supabase 연결 상태 표시 */}
          {supabaseAvailable ? (
            <div className="flex items-center text-xs text-green-600">
              <Wifi className="h-3 w-3 mr-1" /> 실시간
            </div>
          ) : (
            <div className="flex items-center text-xs text-amber-600">
              <WifiOff className="h-3 w-3 mr-1" /> 폴백 모드
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={handleMarkAllAsRead} 
              disabled={loading}
              className="text-sm px-3 py-1"
            >
              모두 읽음
            </Button>
          )}
          <Button variant="outline" onClick={refreshNotifications} disabled={loading}>
            {loading ? '로딩 중...' : '새로고침'}
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center p-8 border rounded-md">
          알림이 없습니다
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => (
            <li 
              key={notification.id}
              className={`p-3 border rounded-md transition-colors ${
                notification.isRead ? 'bg-slate-50' : 'bg-blue-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  {getNotificationIcon(notification.type)}
                  <div>
                    <Link 
                      href={notification.link || '#'} 
                      className="font-medium hover:underline"
                    >
                      {notification.title || '시스템 알림'}
                    </Link>
                    <p className="text-sm">{notification.message}</p>
                    <span className="text-xs text-gray-500">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                {!notification.isRead && (
                  <Button 
                    variant="ghost" 
                    onClick={() => markNotificationAsRead(notification.id)}
                    disabled={loading}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 