"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { getSupabaseClient } from "@/lib/supabase"

// 통합된 알림 데이터 타입
interface NotificationData {
  id: number
  title: string
  message: string
  link: string
  isRead: boolean
  createdAt: string
  type: string
  formattedDate?: string
}

const NOTIFICATION_QUERY_LIMIT = 10

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // 컴포넌트 마운트 여부 확인
  useEffect(() => {
    setIsMounted(true)
    
    if (user) {
      loadNotifications()
    }
    
    return () => {
      setIsMounted(false)
    }
  }, [user])

  // 날짜 포맷팅 함수
  const formatDateToRelative = (dateStr: string): string => {
    try {
      if (!dateStr) return "방금 전"

      const date = new Date(dateStr)
      
      if (isNaN(date.getTime())) {
        return "방금 전"
      }
      
      const now = new Date()
      
      if (date > now) {
        const diffMs = date.getTime() - now.getTime()
        if (diffMs <= 10 * 60 * 1000) {
          return "방금 전"
        }
        return "최근"
      }
      
      const diffMs = now.getTime() - date.getTime()
      const seconds = Math.floor(diffMs / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      
      if (days > 30) {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}.${month}.${day}`
      } else if (days > 0) {
        return `${days}일 전`
      } else if (hours > 0) {
        return `${hours}시간 전`
      } else if (minutes > 0) {
        return `${minutes}분 전`
      } else {
        return "방금 전"
      }
    } catch (error) {
      return "방금 전"
    }
  }

  const loadNotifications = async () => {
    if (!user) return
    
    setIsLoadingNotifications(true)
    
    try {
      const supabase = await getSupabaseClient()
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        return
      }

      // 토큰 가져오기
      const projectRef = "jdubrjczdyqqtsppojgu"
      let accessToken = null

      const possibleKeys = [
        `sb-${projectRef}-auth-token`,
        'supabase-auth-token',
        'auth-token',
        'access_token'
      ]

      for (const key of possibleKeys) {
        const tokenData = localStorage.getItem(key) || sessionStorage.getItem(key)
        if (tokenData) {
          try {
            const parsed = JSON.parse(tokenData)
            if (parsed.access_token) {
              accessToken = parsed.access_token
              break
            }
          } catch {
            if (tokenData.includes('.')) {
              accessToken = tokenData
              break
            }
          }
        }
      }

      if (!accessToken) {
        return
      }

      // API 호출
      const response = await fetch('/api/notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      
      // 데이터 정규화 - API 응답에 따라 조정
      const normalizedData = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        link: item.link || '#',
        isRead: item.isRead || item.is_read || false,
        createdAt: item.createdAt || item.created_at,
        type: item.type,
        formattedDate: formatDateToRelative(item.createdAt || item.created_at)
      }))
      
      setNotifications(normalizedData)
      setUnreadCount(normalizedData.filter((n: NotificationData) => !n.isRead).length)
    } catch (error) {
      // 알림 로딩 오류 처리
    } finally {
      setIsLoadingNotifications(false)
    }
  }

  const handleNotificationClick = async (id: number) => {
    try {
      const supabase = await getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      if (!session || !accessToken) {
        return
      }
      
      const isDev = process.env.NODE_ENV === 'development'
      const userId = user?.id
      const apiUrl = isDev && userId 
        ? `/api/notifications?userId=${userId}` 
        : '/api/notifications'
      
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ notificationId: id }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          return
        }
        throw new Error('알림 상태 업데이트에 실패했습니다.')
      }

      setNotifications(
        notifications.map((notification) => 
          notification.id === id ? { ...notification, isRead: true } : notification
        )
      )
      
      // 읽지 않은 알림 수 업데이트
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        toast.error('알림 상태를 업데이트하는데 실패했습니다.')
      }
    }
  }

  const markAllAsRead = async () => {
    try {
      const supabase = await getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      
      if (!session || !accessToken) {
        return
      }
      
      const isDev = process.env.NODE_ENV === 'development'
      const userId = user?.id
      const apiUrl = isDev && userId 
        ? `/api/notifications/mark-all-read?userId=${userId}` 
        : '/api/notifications/mark-all-read'
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          return
        }
        throw new Error('알림 상태 일괄 업데이트에 실패했습니다.')
      }

      setNotifications(notifications.map(notification => ({ ...notification, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        toast.error('모든 알림을 읽음 처리하는데 실패했습니다.')
      }
    }
  }

  // 기본 조건 확인
  if (!user || !isMounted) return null

  // 기본 사용자 확인
  const isDefaultUser = user.name === '사용자' || 
                       (!user.profile_image && user.email && !user.email.includes('@')) ||
                       (user.updated_at && user.created_at && 
                        new Date(user.updated_at).getTime() - new Date(user.created_at).getTime() < 1000)

  if (isDefaultUser) return null

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
                        {notification.formattedDate || "방금 전"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                    <div className="ml-2 flex-shrink-0 mt-2">
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

export default NotificationDropdown

