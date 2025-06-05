"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Calendar, MapPin, Clock, CreditCard, Play, ThumbsUp, CheckCircle, Send, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { TransactionStepper } from "@/components/transaction-stepper"
import { TicketingStatusCard } from "@/components/ticketing-status-card"
import { useAuth } from "@/contexts/auth-context"
import ChatModal from "@/components/chat/ChatModal"
import MessageButton from "@/components/MessageButton"

// 기본 거래 데이터 (로딩 중에 표시할 데이터)
const defaultTransaction = {
  id: "",
  order_number: "",
  type: "purchase", // 기본값을 구매로 변경
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
  ticketingInfo: "로딩 중...",
  buyer: {
    id: "",
    name: "",
    profileImage: "/placeholder.svg?height=50&width=50",
    contactNumber: ""
  },
  seller: {
    id: "",
    name: "",
    profileImage: "/placeholder.svg?height=50&width=50",
    contactNumber: ""
  },
}

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

export default function TransactionDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user: currentUser } = useAuth() // 로그인한 사용자 정보

  const [transaction, setTransaction] = useState(defaultTransaction)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatRoomId, setChatRoomId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'buyer' | 'seller' | null>(null) // 사용자 역할 상태 추가

  // 실제 구현에서는 이 부분에서 API를 호출하여 거래 정보를 가져와야 합니다
  useEffect(() => {
    const fetchTransaction = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (!params?.id) {
          throw new Error("주문번호가 없습니다.")
        }
        
        if (!currentUser?.id) {
          throw new Error("로그인이 필요합니다.")
        }
        
        const orderId = params.id
        console.log("Transaction ID:", orderId)
        console.log("Current User ID:", currentUser.id)
        
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
        console.log("API 응답 데이터:", data)
        
        // 🔍 현재 사용자가 구매자인지 판매자인지 판단
        const isBuyer = data.buyer?.id === currentUser.id
        const isSeller = data.post?.author_id === currentUser.id || data.seller?.id === currentUser.id
        
        console.log("역할 판단:", { 
          isBuyer, 
          isSeller, 
          buyerId: data.buyer?.id, 
          sellerId: data.seller?.id || data.post?.author_id,
          currentUserId: currentUser.id 
        })
        
        if (!isBuyer && !isSeller) {
          throw new Error("이 거래에 접근할 권한이 없습니다.")
        }
        
        setUserRole(isBuyer ? 'buyer' : 'seller')
        
        // API 응답을 UI용 데이터로 변환 (사용자 역할에 따라 다르게)
        const formattedData = {
          id: data.id.toString(),
          order_number: data.order_number || params.id,
          type: isBuyer ? "purchase" : "sale", // 🔄 구매자면 purchase, 판매자면 sale
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
          ticketingInfo: isBuyer 
            ? "판매자가 취켓팅을 진행하고 있습니다. 완료되면 알림을 보내드립니다."
            : "취소표 발생 시 알림을 보내드립니다. 취소표 발생 시 빠르게 예매를 진행해 드립니다.",
          buyer: {
            id: data.buyer?.id || "",
            name: data.buyer?.name || "구매자",
            profileImage: data.buyer?.profile_image || "/placeholder.svg?height=50&width=50",
            contactNumber: data.buyer?.phone_number || "연락처 정보 없음"
          },
          seller: {
            id: data.seller?.id || data.post?.author_id || "",
            name: data.seller?.name || data.post?.author?.name || "판매자", 
            profileImage: data.seller?.profile_image || data.post?.author?.profile_image || "/placeholder.svg?height=50&width=50",
            contactNumber: data.seller?.phone_number || data.post?.author?.phone_number || "연락처 정보 없음"
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
      } catch (error) {
        console.error("거래 정보 로딩 에러:", error)
        setError(error instanceof Error ? error.message : "거래 정보를 불러오는데 실패했습니다.")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchTransaction()
  }, [params, currentUser])

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

    if (userRole === 'buyer') {
      // 구매자 액션
      if (transaction.currentStep === "ticketing_completed") {
        // 구매 확정
        import('canvas-confetti').then((confetti) => {
          confetti.default({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#4CAF50", "#2196F3", "#FFC107"],
          });
        });

        toast.success("구매 확정 처리되었습니다!", {
          description: "거래가 완료되었습니다.",
          duration: 3000,
        });

        const response = await fetch(`/api/purchase/${transaction.order_number}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            status: "CONFIRMED"
          }),
          credentials: 'include'
        })

        if (response.ok) {
          window.location.reload()
        } else {
          const errorText = await response.text()
          console.error("API 오류:", errorText)
          toast.error("구매 확정에 실패했습니다.", {
            description: "잠시 후 다시 시도해주세요.",
            duration: 4000,
          });
        }
      } else if (transaction.currentStep === "confirmed") {
        // 리뷰 작성 페이지로 이동
        router.push(`/review/${transaction.order_number}?role=buyer`)
      }
    } else {
      // 판매자 액션
      if (transaction.currentStep === "ticketing_started") {
        // 취켓팅 성공 시 confetti 효과 추가
        import('canvas-confetti').then((confetti) => {
          confetti.default({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#4CAF50", "#2196F3", "#FFC107"],
          });
        });

        // 성공 토스트 메시지
        toast.success("취켓팅 완료 처리되었습니다!", {
          description: "구매자의 확정을 기다리고 있습니다.",
          duration: 3000,
        });

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
          toast.error("상태 변경에 실패했습니다.", {
            description: "잠시 후 다시 시도해주세요.",
            duration: 4000,
          });
        }
      } else if (transaction.currentStep === "confirmed") {
        // 구매자에 대한 리뷰 작성 페이지로 이동
        router.push(`/review/${transaction.order_number}?role=seller`)
      }
    }
  }

  const openChat = () => {
    console.log("채팅방 열기 요청 - roomId:", chatRoomId);
    //console.log("현재 거래 ID:", params.id);
    setIsChatOpen(true);
  }
  const closeChat = () => setIsChatOpen(false)

  // 현재 단계에 따른 버튼 텍스트 결정 (역할에 따라 다르게)
  const getActionButtonText = () => {
    if (userRole === 'buyer') {
      // 구매자 버튼
      switch (transaction.currentStep) {
        case "ticketing_completed":
          return "구매 확정하기"
        case "confirmed":
          return "리뷰 작성하기"
        default:
          return "취켓팅 대기 중"
      }
    } else {
      // 판매자 버튼
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
            onClick={() => router.push(userRole === 'buyer' ? "/mypage" : "/seller/dashboard")}
            className="mt-4 px-4 py-2 bg-teal-100 text-teal-700 rounded-md hover:bg-teal-200"
          >
            {userRole === 'buyer' ? "마이페이지로 돌아가기" : "판매자 대시보드로 돌아가기"}
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
            href={userRole === 'buyer' ? "/mypage" : "/seller/dashboard"}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>{userRole === 'buyer' ? "마이페이지로 돌아가기" : "판매자 대시보드로 돌아가기"}</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">
            {userRole === 'buyer' ? "구매 거래 상세" : "판매 거래 상세"}
          </h1>
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
              <MessageButton 
                orderNumber={params.id} 
                onClick={openChat}
                className="justify-center rounded-md disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 shadow-sm text-sm flex items-center gap-2 border-2 border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors font-medium"
                debug={true}
              />
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
                      <span className="text-xs text-gray-500 block">{userRole === 'buyer' ? "구매 금액" : "판매 금액"}</span>
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
              <h3 className="text-xl font-semibold mb-6 text-gray-800">
                {userRole === 'buyer' ? "취켓팅 현황" : "취켓팅 정보"}
              </h3>

              <TicketingStatusCard
                status={transaction.currentStep === "ticketing_completed" ? "completed" : "in_progress"}
                message={
                  userRole === 'buyer'
                    ? (transaction.currentStep === "ticketing_completed"
                        ? "취켓팅이 완료되었습니다! 구매를 확정해주세요."
                        : "판매자가 취켓팅을 진행하고 있습니다. 완료되면 알림을 보내드립니다.")
                    : (transaction.currentStep === "ticketing_completed"
                        ? "취켓팅이 완료되었습니다. 구매자의 구매 확정을 기다리고 있습니다."
                        : "취소표 발생 시 즉시 예매를 진행해 드립니다. 취소표를 발견하면 '취켓팅 성공 확정' 버튼을 눌러주세요.")
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
                  <span className="text-xs text-gray-500 block mb-1">
                    {userRole === 'buyer' ? "판매자 정보" : "구매자 정보"}
                  </span>
                  <span className="font-medium">
                    {userRole === 'buyer' ? transaction.seller.name : transaction.buyer.name}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">
                    {userRole === 'buyer' ? "판매자 연락처" : "구매자 연락처"}
                  </span>
                  <span className="font-medium">
                    {userRole === 'buyer' ? transaction.seller.contactNumber : transaction.buyer.contactNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* 액션 버튼 영역 */}
            <div className="mt-10 flex justify-end gap-4">
              <MessageButton
                orderNumber={params.id}
                onClick={openChat}
                className="justify-center rounded-md disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 shadow-sm text-sm flex items-center gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              />

              {userRole === 'seller' ? (
                // 판매자용 버튼들
                <>
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

                  {/* 리뷰 작성 (구매 확정 단계일 때) */}
                  {transaction.currentStep === "confirmed" && (
                    <Button
                      onClick={handleAction}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
                    >
                      리뷰 작성하기
                    </Button>
                  )}
                </>
              ) : (
                // 구매자용 버튼들
                <>
                  {/* 취켓팅 대기 중 (취켓팅 시작 단계일 때) */}
                  {transaction.currentStep === "ticketing_started" && (
                    <Button
                      disabled
                      className="bg-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg shadow-md cursor-not-allowed"
                    >
                      취켓팅 대기 중
                    </Button>
                  )}

                  {/* 구매 확정하기 버튼 (취켓팅 완료 단계일 때) */}
                  {transaction.currentStep === "ticketing_completed" && (
                    <Button
                      onClick={handleAction}
                      className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
                    >
                      구매 확정하기
                    </Button>
                  )}

                  {/* 리뷰 작성 (구매 확정 단계일 때) */}
                  {transaction.currentStep === "confirmed" && (
                    <Button
                      onClick={handleAction}
                      className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md"
                    >
                      리뷰 작성하기
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 하단 고정 액션 버튼 영역 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md p-4">
          <div className="container mx-auto flex justify-end">
            <button
              onClick={handleAction}
              disabled={
                (userRole === 'seller' && transaction.currentStep === "ticketing_completed") ||
                (userRole === 'buyer' && transaction.currentStep === "ticketing_started")
              }
              className={`px-6 py-3 rounded-lg font-medium ${
                ((userRole === 'seller' && transaction.currentStep === "ticketing_completed") ||
                 (userRole === 'buyer' && transaction.currentStep === "ticketing_started"))
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : (userRole === 'buyer' && transaction.currentStep === "ticketing_completed")
                    ? "bg-green-500 text-white hover:bg-green-600 transition-colors"
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