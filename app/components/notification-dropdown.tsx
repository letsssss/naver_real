"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { supabase } from '@/lib/supabase'

// API에서 받는 알림 데이터 타입
interface ApiNotification {
  id: number
  title: string
  message: string
  link: string
  isRead: boolean
  createdAt: string
  type: string
}

// 컴포넌트 내부에서 사용하는 가공된 알림 데이터 타입
interface Notification {
  id: number
  title: string
  message: string
  link: string
  isRead: boolean
  createdAt: string
  formattedDate: string // 미리 가공된 시간 문자열
  type: string
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const unreadCount = notifications.filter((notification) => !notification.isRead).length

  // 컴포넌트가 클라이언트에 마운트되었는지 확인
  useEffect(() => {
    setIsMounted(true)
    
    if (user) {
      fetchNotifications()
    }
    
    return () => {
      setIsMounted(false)
    }
  }, [user])

  // 알림이 열릴 때만 데이터를 가져오도록 설정
  useEffect(() => {
    if (isOpen && user && notifications.length === 0) {
      fetchNotifications()
    }
  }, [isOpen, user])

  // 순수 JavaScript로 구현한 날짜 포맷팅 함수
  const formatDateToRelative = (dateStr: string): string => {
    try {
      if (!dateStr) return "방금 전";

      // Date 객체 생성
      const date = new Date(dateStr);
      
      // 유효하지 않은 날짜인 경우
      if (isNaN(date.getTime())) {
        return "방금 전";
      }
      
      const now = new Date();
      
      // 미래 시간인 경우 - 서버/클라이언트 시간 차이를 고려해 10분까지는 허용
      if (date > now) {
        const diffMs = date.getTime() - now.getTime();
        if (diffMs <= 10 * 60 * 1000) { // 10분 이내
          return "방금 전";
        }
        // 심각한 미래 시간인 경우 (하이드레이션 오류 방지를 위해 정적 텍스트 반환)
        return "최근";
      }
      
      // 시간 차이 계산
      const diffMs = now.getTime() - date.getTime();
      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      // 상대적 시간 표시
      if (days > 30) {
        // 절대 날짜 형식으로 표시 (1달 이상 지난 경우)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
      } else if (days > 0) {
        return `${days}일 전`;
      } else if (hours > 0) {
        return `${hours}시간 전`;
      } else if (minutes > 0) {
        return `${minutes}분 전`;
      } else {
        return "방금 전";
      }
    } catch (error) {
      return "방금 전";
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    setIsLoadingNotifications(true);
    
    try {
      // Supabase 세션에서 access_token 가져오기
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        setNotifications([]);
        return;
      }
      
      const accessToken = session?.access_token;
      
      // 세션이 없거나 기본 사용자인 경우 API 호출 건너뛰기
      if (!session || !accessToken) {
        setNotifications([]);
        return;
      }
      
      // 기본 사용자 (users 테이블에 없는 사용자)의 경우 알림 건너뛰기
      if (user.name === '사용자' && !user.profile_image) {
        setNotifications([]);
        return;
      }

      // auth-context에서 생성된 기본 사용자 확인 (created_at이 최근이고 다른 필드가 기본값인 경우)
      const isDefaultUser = user.name === '사용자' || 
                           (!user.profile_image && user.email && !user.email.includes('@')) ||
                           (user.updated_at && user.created_at && 
                            new Date(user.updated_at).getTime() - new Date(user.created_at).getTime() < 1000);
      
      if (isDefaultUser) {
        setNotifications([]);
        return;
      }
      
      // 개발 환경에서 사용할 userId 추가
      const isDev = process.env.NODE_ENV === 'development';
      const userId = user?.id;
      const apiUrl = isDev && userId 
        ? `/api/notifications?userId=${userId}` 
        : '/api/notifications';
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : '',
        },
        credentials: 'include', // 쿠키 포함
      });

      if (!response.ok) {
        if (response.status === 401) {
          setNotifications([]);
          return;
        } else if (response.status === 402) {
          setNotifications([]);
          return;
        } else if (response.status === 500) {
          setNotifications([]);
          return;
        } else {
          setNotifications([]);
          return;
        }
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        
        if (responseText.includes('<!DOCTYPE html>')) {
          throw new Error('서버 오류가 발생했습니다.');
        }
        
        throw new Error('서버 응답이 JSON 형식이 아닙니다.');
      }

      const data = await response.json();
      
      if (!data || !Array.isArray(data.notifications)) {
        throw new Error('잘못된 알림 데이터 형식');
      }
      
      const sortedNotifications = [...data.notifications].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setNotifications(sortedNotifications);
    } catch (error) {
      // 개발 환경에서만 토스트 표시
      if (process.env.NODE_ENV === 'development') {
        // 401 오류는 토스트로 표시하지 않음
        if (error instanceof Error && !error.message.includes('401')) {
          toast.error(`알림 로드 실패: ${error.message}`);
        }
      }
      
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleNotificationClick = async (id: number) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId: id }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('알림 상태 업데이트에 실패했습니다.')
      }

      setNotifications(
        notifications.map((notification) => 
          notification.id === id ? { ...notification, isRead: true } : notification
        )
      )
    } catch (error) {
      // 오류는 조용히 처리
    }
  }

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead)
      await Promise.all(
        unreadNotifications.map(notification =>
          fetch('/api/notifications', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notificationId: notification.id }),
            credentials: 'include'
          })
        )
      )

      setNotifications(notifications.map(notification => ({ ...notification, isRead: true })))
    } catch (error) {
      // 오류는 조용히 처리
    }
  }

  // 서버 렌더링과 클라이언트 렌더링 간 불일치 방지
  if (!user) return null
  if (!isMounted) return null

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger className="relative cursor-pointer focus:outline-none">
        <Bell className="h-5 w-5 text-gray-700 hover:text-[#0061FF] transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <div className="flex items-center justify-between p-4">
          <DropdownMenuLabel className="text-lg font-semibold">알림</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
              모두 읽음 표시
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[400px] overflow-y-auto">
          {isLoadingNotifications ? (
            <div className="p-4 text-center text-gray-500">알림을 불러오는 중...</div>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <Link
                href={notification.link}
                key={notification.id}
                onClick={() => handleNotificationClick(notification.id)}
              >
                <DropdownMenuItem className="cursor-pointer p-0">
                  <div className={`p-4 w-full ${notification.isRead ? "bg-white" : "bg-blue-50"}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-medium ${notification.isRead ? "text-gray-800" : "text-blue-700"}`}>
                        {notification.title}
                      </span>
                      <span className="text-xs text-gray-500">
                        {notification.formattedDate}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                    <div className="ml-2 flex-shrink-0">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        notification.type === 'TICKET_REQUEST' 
                          ? 'bg-blue-100 text-blue-800'
                          : notification.type === 'PURCHASE_COMPLETE'
                          ? 'bg-green-100 text-green-800'
                          : notification.type === 'SYSTEM'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {notification.type === 'TICKET_REQUEST' 
                          ? '취켓팅 신청'
                          : notification.type === 'PURCHASE_COMPLETE'
                          ? '구매 완료'
                          : notification.type === 'SYSTEM'
                          ? '시스템'
                          : '알림'}
                      </span>
                    </div>
                  </div>
                </DropdownMenuItem>
              </Link>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">알림이 없습니다</div>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <Link href="/notifications" onClick={() => setIsOpen(false)}>
          <DropdownMenuItem className="cursor-pointer">
            <div className="w-full text-center py-2 text-blue-600 font-medium">모든 알림 보기</div>
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}