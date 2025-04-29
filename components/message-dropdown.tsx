"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Mail } from "lucide-react"
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

// API에서 받는 메시지 데이터 타입
interface Message {
  id: number
  roomId: string
  senderId: string
  senderName: string
  content: string
  isRead: boolean
  createdAt: string
  productName: string  // 어떤 상품과 관련된 메시지인지 표시
  formattedDate?: string // 가공된 날짜 (옵셔널)
}

export function MessageDropdown() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const unreadCount = messages.filter((message) => !message.isRead).length

  // 컴포넌트가 클라이언트에 마운트되었는지 확인
  useEffect(() => {
    setIsMounted(true)
    
    if (user) {
      fetchMessages()
    }
    
    return () => {
      setIsMounted(false)
    }
  }, [user])

  // 드롭다운이 열릴 때만 데이터를 가져오도록 설정
  useEffect(() => {
    if (isOpen && user && messages.length === 0) {
      fetchMessages()
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
      console.error("날짜 변환 오류:", error);
      return "방금 전";
    }
  };

  const fetchMessages = async () => {
    if (!user) return;
    
    setIsLoadingMessages(true);
    try {
      const token = localStorage.getItem('token');
      // 메시지 API 호출
      const response = await fetch('/api/messages/unread', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('메시지를 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();

      if (!data.messages || !Array.isArray(data.messages)) {
        console.error('유효하지 않은 메시지 데이터:', data);
        setMessages([]);
        return;
      }

      const processedMessages = data.messages.map((item: any) => ({
        ...item,
        formattedDate: formatDateToRelative(item.createdAt)
      }));

      setMessages(processedMessages);
    } catch (error) {
      console.error('메시지 목록 로딩 오류:', error);
      toast.error('메시지 목록을 불러오는데 실패했습니다.');
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleMessageClick = async (roomId: string, messageId: number) => {
    try {
      // 메시지 읽음 처리 API 호출
      const response = await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('메시지 상태 업데이트에 실패했습니다.')
      }

      // 로컬 상태 업데이트
      setMessages(
        messages.map((message) => 
          message.id === messageId ? { ...message, isRead: true } : message
        )
      )
      
      // 채팅 페이지로 이동
      router.push(`/chat/${roomId}`);
    } catch (error) {
      console.error('메시지 상태 업데이트 중 오류 발생:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const unreadMessages = messages.filter(m => !m.isRead)
      
      // 모든 메시지 읽음 처리 API 호출
      const response = await fetch('/api/messages/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('메시지 상태 업데이트에 실패했습니다.')
      }

      // 로컬 상태 업데이트
      setMessages(messages.map(message => ({ ...message, isRead: true })))
      
      toast.success(`${unreadMessages.length}개의 메시지가 읽음 처리되었습니다.`);
    } catch (error) {
      console.error('메시지 상태 일괄 업데이트 중 오류 발생:', error)
      toast.error('메시지 읽음 처리에 실패했습니다.');
    }
  }

  // 서버 렌더링과 클라이언트 렌더링 간 불일치 방지
  if (!user) return null
  if (!isMounted) return null

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger className="relative cursor-pointer focus:outline-none">
        <Mail className="h-5 w-5 text-gray-700 hover:text-[#0061FF] transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <div className="flex items-center justify-between p-4">
          <DropdownMenuLabel className="text-lg font-semibold">메시지</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
              모두 읽음 표시
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup className="max-h-[400px] overflow-y-auto">
          {isLoadingMessages ? (
            <div className="p-4 text-center text-gray-500">메시지를 불러오는 중...</div>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <div 
                key={message.id}
                onClick={() => handleMessageClick(message.roomId, message.id)}
                className="cursor-pointer"
              >
                <DropdownMenuItem className="p-0">
                  <div className={`p-4 w-full ${message.isRead ? "bg-white" : "bg-blue-50"}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-medium ${message.isRead ? "text-gray-800" : "text-blue-700"}`}>
                        {message.senderName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {message.formattedDate}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{message.content}</p>
                    <div className="mt-1 text-xs text-gray-500">
                      {message.productName && `상품: ${message.productName}`}
                    </div>
                  </div>
                </DropdownMenuItem>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">새 메시지가 없습니다</div>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <Link href="/dashboard/messages" onClick={() => setIsOpen(false)}>
          <DropdownMenuItem className="cursor-pointer">
            <div className="w-full text-center py-2 text-blue-600 font-medium">모든 메시지 보기</div>
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 