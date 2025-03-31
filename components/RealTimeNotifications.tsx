'use client';

import { useEffect } from 'react';
import { useRealtime } from '@/hooks/useRealtime';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bell, Mail, Check } from 'lucide-react';
import Link from 'next/link';

export default function RealTimeNotifications() {
  const { 
    notifications, 
    loading, 
    error, 
    refreshNotifications, 
    markNotificationAsRead 
  } = useRealtime();

  // 초기 데이터 로딩
  useEffect(() => {
    refreshNotifications();
  }, []);

  // 새 알림이 도착할 때 토스트 메시지 표시
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      
      // 읽지 않은 새 알림만 토스트로 표시
      if (!latestNotification.isRead) {
        toast.info('새 알림이 도착했습니다', {
          description: latestNotification.message,
          action: {
            label: '확인',
            onClick: () => markNotificationAsRead(latestNotification.id)
          }
        });
      }
    }
  }, [notifications]);

  // 알림 아이콘 선택 함수
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE':
        return <Mail className="h-4 w-4" />;
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

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          알림 
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </h2>
        <Button variant="outline" onClick={refreshNotifications}>
          새로고침
        </Button>
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