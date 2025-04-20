"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Calendar, MapPin, Clock, CreditCard, Play, ThumbsUp, CheckCircle, Send, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TransactionStepper } from "@/components/transaction-stepper"
import { TicketingStatusCard } from "@/components/ticketing-status-card"
import { useAuth } from "@/contexts/auth-context"
import ChatModal from "@/components/chat/ChatModal"

// 기본 거래 데이터 (로딩 중에 표시할 데이터)
const defaultTransaction = {
  id: "",
  type: "sale",
  status: "로딩 중...",
  currentStep: "",
  stepDates: {
    payment: null as string | null,
    ticketing_started: null as string | null,
    ticketing_completed: null as string | null,
    confirmed: null as string | null,
  },
  ticket: {
    title: "로딩 중...",
    date: "",
    time: "",
    venue: "",
    seat: "",
    image: "/placeholder.svg",
  },
  price: 0,
  paymentMethod: "",
  paymentStatus: "",
  ticketingStatus: "",
  ticketingInfo: "취소표 발생 시 알림을 보내드립니다. 취소표 발생 시 빠르게 예매를 진행해 드립니다.",
  buyer: {
    id: "",
    name: "",
    profileImage: "/placeholder.svg?height=50&width=50",
  },
}

// 샘플 메시지 데이터
const initialMessages = [
  {
    id: 1,
    senderId: "seller123", // 판매자 ID
    text: "안녕하세요! 세븐틴 콘서트 티켓 구매해주셔서 감사합니다. 취켓팅 진행 중이니 조금만 기다려주세요.",
    timestamp: "2024-03-16T10:30:00",
  },
  {
    id: 2,
    senderId: "buyer123", // 구매자 ID
    text: "네, 감사합니다. 혹시 취켓팅 완료 예상 시간이 언제인가요?",
    timestamp: "2024-03-16T10:35:00",
  },
  {
    id: 3,
    senderId: "seller123", // 판매자 ID
    text: "보통 공연 1-2일 전에 완료되지만, 취소표가 빨리 나오면 더 일찍 완료될 수도 있어요. 상황에 따라 다를 수 있으니 메시지로 안내해 드릴게요.",
    timestamp: "2024-03-16T10:40:00",
  },
]

// 상태 변환 함수들
const getStatusText = (status: string) => {
  switch (status) {
    case "PENDING":
    case "PENDING_PAYMENT":
    case "PROCESS":
    case "PROCESSING":
      return "취켓팅 시작"
    case "COMPLETED":
      return "취켓팅 완료"
    case "CONFIRMED":
      return "구매 확정"
    case "CANCELLED":
      return "거래 취소"
    default:
      return "알 수 없음"
  }
}

const getCurrentStep = (status: string) => {
  switch (status) {
    case "PENDING":
    case "PENDING_PAYMENT":
    case "PROCESS":
    case "PROCESSING":
      return "ticketing_started"
    case "COMPLETED":
      return "ticketing_completed"
    case "CONFIRMED":
      return "confirmed"
    case "CANCELLED":
      return "cancelled"
    default:
      return ""
  }
}

const getTicketingStatusText = (status: string) => {
  switch (status) {
    case "PENDING":
    case "PENDING_PAYMENT":
    case "PROCESS":
    case "PROCESSING":
      return "취켓팅 진행중"
    case "COMPLETED":
      return "취켓팅 완료"
    case "CONFIRMED":
      return "구매 확정"
    case "CANCELLED":
      return "거래 취소"
    default:
      return "알 수 없음"
  }
}

interface Message {
  id: number;
  senderId: string;
  text: string;
  timestamp: string;
}

export default function SellerTransactionDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user: currentUser } = useAuth() // 로그인한 사용자 정보

  const [transaction, setTransaction] = useState(defaultTransaction)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatRoomId, setChatRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 실제 구현에서는 이 부분에서 API를 호출하여 거래 정보를 가져와야 합니다
  useEffect(() => {
    const fetchTransaction = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (!params?.id) {
          throw new Error("주문번호가 없습니다.")
        }
        
        const orderId = params.id
        console.log("Transaction ID:", orderId)
        
        // API 경로 수정 - /api/purchase 엔드포인트 사용
        const response = await fetch(`/api/purchase/${orderId}`, {
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("로그인이 필요합니다.")
          } else if (response.status === 403) {
            throw new Error("이 거래에 접근할 권한이 없습니다.")
          } else if (response.status === 404) {
            throw new Error("거래 정보를 찾을 수 없습니다.")
          }
          const errorText = await response.text()
          console.error("API 응답 에러:", errorText)
          throw new Error("거래 정보를 불러오는데 실패했습니다.")
        }
        
        const data = await response.json()
        
        // API 응답을 UI용 데이터로 변환
        const formattedData = {
          id: data.id.toString(),
          type: "sale", // 판매자 관점
          status: getStatusText(data.status),
          currentStep: getCurrentStep(data.status),
          stepDates: {
            payment: data.created_at as string | null,
            ticketing_started: data.created_at as string | null,
            ticketing_completed: (data.status === "COMPLETED" || data.status === "CONFIRMED")
              ? (data.updated_at || new Date().toISOString()) as string | null
              : null,
            confirmed: data.status === "CONFIRMED"
              ? (data.updated_at || new Date().toISOString()) as string | null
              : null,
          },
          ticket: {
            title: data.post?.title || "제목 없음",
            date: data.post?.event_date || "",
            time: "미정", // API에서 시간 정보가 없는 경우
            venue: data.post?.event_venue || "",
            seat: data.selected_seats || "",
            image: data.post?.image_url || "/placeholder.svg",
          },
          price: Number(data.total_price) || 0,
          paymentMethod: data.payment_method || "신용카드",
          paymentStatus: "결제 완료",
          ticketingStatus: getTicketingStatusText(data.status),
          ticketingInfo: "취소표 발생 시 알림을 보내드립니다. 취소표 발생 시 빠르게 예매를 진행해 드립니다.",
          buyer: {
            id: data.buyer?.id || "",
            name: data.buyer?.name || "구매자",
            profileImage: data.buyer?.profile_image || "/placeholder.svg?height=50&width=50",
          },
        }
        
        setTransaction(formattedData)
        
        // 채팅방 정보 조회
        try {
          const chatResponse = await fetch(`/api/chat/init-room`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderNumber: orderId
            }),
            credentials: 'include'
          });
          
          if (chatResponse.ok) {
            const chatData = await chatResponse.json();
            if (chatData.roomId) {
              setChatRoomId(chatData.roomId);
              console.log("채팅방 ID:", chatData.roomId);
            }
          } else {
            console.error("채팅방 정보 로딩 에러");
          }
        } catch (chatError) {
          console.error("채팅방 정보 로딩 에러:", chatError);
          // 채팅방 로딩 실패는 전체 페이지 에러로 처리하지 않음
        }
        
        // 메시지 데이터 불러오기
        try {
          const messagesResponse = await fetch(`/api/messages/${orderId}`, {
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          })
          if (messagesResponse.ok) {
            const messageData = await messagesResponse.json()
            setMessages(messageData)
          }
        } catch (messageError) {
          console.error("메시지 데이터 로딩 에러:", messageError)
          // 메시지 로딩 실패는 전체 페이지 에러로 처리하지 않음
        }
      } catch (error) {
        console.error("거래 정보 로딩 에러:", error)
        setError(error instanceof Error ? error.message : "거래 정보를 불러오는데 실패했습니다.")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchTransaction()
  }, [params])

  // 채팅창이 열릴 때 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom()
    }
  }, [isChatOpen, messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // 거래 단계 정의 - 4단계로 수정
  const transactionSteps = [
    {
      id: "payment",
      label: "결제 완료",
      icon: <CreditCard className="w-5 h-5" />,
      date: transaction.stepDates.payment
        ? new Date(transaction.stepDates.payment).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
    },
    {
      id: "ticketing_started",
      label: "취켓팅 시작",
      icon: <Play className="w-5 h-5" />,
      date: transaction.stepDates.ticketing_started
        ? new Date(transaction.stepDates.ticketing_started).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
    },
    {
      id: "ticketing_completed",
      label: "취켓팅 완료",
      icon: <CheckCircle className="w-5 h-5" />,
      date: transaction.stepDates.ticketing_completed
        ? new Date(transaction.stepDates.ticketing_completed).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
    },
    {
      id: "confirmed",
      label: "구매 확정",
      icon: <ThumbsUp className="w-5 h-5" />,
      date: transaction.stepDates.confirmed
        ? new Date(transaction.stepDates.confirmed).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
    },
  ]

  const handleAction = async () => {
    if (!transaction.id) {
      console.error("거래 ID가 없습니다.")
      return
    }

    if (transaction.currentStep === "ticketing_started") {
      // 취켓팅 완료 상태로 변경
      const response = await fetch(`/api/purchase/status/${transaction.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: "COMPLETED"
        }),
        credentials: 'include'
      })

      if (response.ok) {
        // 상태 업데이트 성공 시 페이지 새로고침
        window.location.reload()
      } else {
        const errorText = await response.text()
        console.error("API 오류:", errorText)
        alert("상태 변경에 실패했습니다.")
      }
    } else if (transaction.currentStep === "confirmed") {
      // 구매자에 대한 리뷰 작성 페이지로 이동
      router.push(`/review/${transaction.id}?role=seller`)
    }
  }

  const openChat = () => setIsChatOpen(true)
  const closeChat = () => setIsChatOpen(false)

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  }

  // 현재 단계에 따른 버튼 텍스트 결정 (판매자용)
  const getActionButtonText = () => {
    switch (transaction.currentStep) {
      case "ticketing_started":
        return "취켓팅 성공 확정"
      case "ticketing_completed":
        return "구매자 확정 대기 중"
      case "confirmed":
        return "구매자 리뷰 작성"
      default:
        return "다음 단계로"
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <h3 className="text-lg font-medium">오류가 발생했습니다</h3>
          <p>{error}</p>
          <button
            onClick={() => router.push("/seller/dashboard")}
            className="mt-4 px-4 py-2 bg-teal-100 text-teal-700 rounded-md hover:bg-teal-200"
          >
            판매자 대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/seller/dashboard"
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>판매자 대시보드로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">판매 거래 상세</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6 transition-all duration-300 hover:shadow-md">
          <div className="p-6 md:p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <span className="text-sm text-gray-500 mb-1 block">티켓 정보</span>
                <h2 className="text-2xl font-bold text-gray-900">{transaction.ticket.title}</h2>
              </div>
              <button
                onClick={openChat}
                className="bg-teal-50 text-teal-600 px-4 py-2 rounded-full flex items-center hover:bg-teal-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                구매자와 채팅하기
              </button>
            </div>

            {/* 거래 진행 상태 스텝퍼 */}
            <div className="mb-10 bg-gray-50 p-6 rounded-xl border border-gray-100">
              <h3 className="text-lg font-semibold mb-6 text-gray-800">거래 진행 상태</h3>
              <TransactionStepper currentStep={transaction.currentStep} steps={transactionSteps} />
            </div>

            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-1/3">
                <div className="relative h-60 md:h-full w-full rounded-xl overflow-hidden shadow-sm">
                  <Image
                    src={transaction.ticket.image || "/placeholder.svg"}
                    alt={transaction.ticket.title}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              </div>
              <div className="md:w-2/3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <Calendar className="h-5 w-5 mr-3 text-teal-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">공연 날짜</span>
                      <span className="font-medium">{transaction.ticket.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <Clock className="h-5 w-5 mr-3 text-teal-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">공연 시간</span>
                      <span className="font-medium">{transaction.ticket.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <MapPin className="h-5 w-5 mr-3 text-teal-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">공연 장소</span>
                      <span className="font-medium">{transaction.ticket.venue}</span>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <CreditCard className="h-5 w-5 mr-3 text-teal-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">판매 금액</span>
                      <span className="font-medium">{transaction.price.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-teal-50 rounded-lg border border-teal-100">
                  <div className="flex items-center">
                    <div className="p-2 bg-teal-100 rounded-full mr-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-teal-600"
                      >
                        <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
                        <path d="M15 3v6h6" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs text-teal-600 block">좌석 정보</span>
                      <span className="font-medium text-teal-800">{transaction.ticket.seat}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 border-t pt-8">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">결제 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">결제 방법</span>
                  <span className="font-medium">{transaction.paymentMethod}</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">결제 상태</span>
                  <span className="font-medium text-green-600">{transaction.paymentStatus}</span>
                </div>
              </div>
            </div>

            <div className="mt-10 border-t pt-8">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">취켓팅 정보</h3>

              <TicketingStatusCard
                status={transaction.currentStep === "ticketing_completed" ? "completed" : "in_progress"}
                message={
                  transaction.currentStep === "ticketing_completed"
                    ? "취켓팅이 완료되었습니다. 구매자의 구매 확정을 기다리고 있습니다."
                    : "취소표 발생 시 즉시 예매를 진행해 드립니다. 취소표를 발견하면 '취켓팅 성공 확정' 버튼을 눌러주세요."
                }
                updatedAt={
                  transaction.currentStep === "ticketing_completed" && transaction.stepDates.ticketing_completed
                    ? transaction.stepDates.ticketing_completed || undefined
                    : transaction.stepDates.ticketing_started || undefined
                }
              />

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">취켓팅 상태</span>
                  <span className="font-medium text-teal-600">
                    {transaction.currentStep === "ticketing_completed" ? "취켓팅 완료" : transaction.ticketingStatus}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">구매자 정보</span>
                  <span className="font-medium">{transaction.buyer.name}</span>
                </div>
              </div>
            </div>

            {/* 판매자용 버튼 영역 */}
            <div className="mt-10 flex justify-end gap-4">
              <Button onClick={openChat} variant="outline" className="flex items-center gap-2 border-gray-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                구매자에게 메시지
              </Button>

              {/* 취켓팅 성공 확정 버튼 (취켓팅 시작 단계일 때만 활성화) */}
              {transaction.currentStep === "ticketing_started" && (
                <Button
                  onClick={handleAction}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
                >
                  취켓팅 성공 확정
                </Button>
              )}

              {/* 구매자 확정 대기 중 (취켓팅 완료 단계일 때) */}
              {transaction.currentStep === "ticketing_completed" && (
                <Button
                  disabled
                  className="bg-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg shadow-md cursor-not-allowed"
                >
                  구매자 확정 대기 중
                </Button>
              )}

              {/* 구매자 리뷰 작성 (구매 확정 단계일 때) */}
              {transaction.currentStep === "confirmed" && (
                <Button
                  onClick={handleAction}
                  className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
                >
                  구매자 리뷰 작성
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 하단 고정 액션 버튼 영역 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md p-4">
          <div className="container mx-auto flex justify-end">
            <button
              onClick={handleAction}
              disabled={transaction.currentStep === "ticketing_completed"}
              className={`px-6 py-3 rounded-lg font-medium ${
                transaction.currentStep === "ticketing_completed"
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-teal-500 text-white hover:bg-teal-600 transition-colors"
              }`}
            >
              {getActionButtonText()}
            </button>
          </div>
        </div>
      </main>

      {/* 채팅 모달 */}
      {isChatOpen && chatRoomId && (
        <ChatModal roomId={chatRoomId} onClose={closeChat} />
      )}
    </div>
  );
} 