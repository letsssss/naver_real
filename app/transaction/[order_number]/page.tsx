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
import ChatWithOrderInit from "@/components/ChatWithOrderInit"

// 기본 거래 데이터 (로딩 중에 표시할 데이터)
const defaultTransaction = {
  id: "",
  type: "purchase",
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
  seller: {
    id: "",
    name: "",
    profileImage: "/placeholder.svg?height=50&width=50",
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
  const params = useParams()
  const router = useRouter()
  const orderNumber = params?.order_number as string
  const { user: currentUser } = useAuth() // 로그인한 사용자 정보
  
  const [transaction, setTransaction] = useState(defaultTransaction)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // API에서 거래 정보 불러오기
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (!orderNumber) {
          throw new Error("주문번호가 없습니다.")
        }

        // 로그인한 사용자가 구매자인지 판매자인지 확인
        const isSeller = currentUser?.role === "seller" || false
        
        // API 엔드포인트 선택 (구매자/판매자에 따라)
        const endpoint = isSeller 
          ? `/api/purchase/seller/${orderNumber}` 
          : `/api/purchase/${orderNumber}`

        const response = await fetch(endpoint)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "거래 정보를 불러오는데 실패했습니다.")
        }
        
        const purchaseData = await response.json()
        
        // API 응답을 UI용 데이터로 변환
        const formattedData = {
          id: purchaseData.id.toString(),
          type: isSeller ? "sale" : "purchase",
          status: getStatusText(purchaseData.status),
          currentStep: getCurrentStep(purchaseData.status),
          stepDates: {
            payment: purchaseData.created_at as string | null,
            ticketing_started: purchaseData.created_at as string | null,
            ticketing_completed: (purchaseData.status === "COMPLETED" || purchaseData.status === "CONFIRMED")
              ? (purchaseData.updated_at || new Date().toISOString()) as string | null
              : null,
            confirmed: purchaseData.status === "CONFIRMED"
              ? (purchaseData.updated_at || new Date().toISOString()) as string | null
              : null,
          },
          ticket: {
            title: purchaseData.post?.title || "제목 없음",
            date: purchaseData.post?.event_date || "",
            time: "미정", // API에서 시간 정보가 없는 경우
            venue: purchaseData.post?.event_venue || "",
            seat: purchaseData.selected_seats || "",
            image: purchaseData.post?.image_url || "/placeholder.svg",
          },
          price: Number(purchaseData.total_price) || 0,
          paymentMethod: purchaseData.payment_method || "신용카드",
          paymentStatus: "결제 완료",
          ticketingStatus: getTicketingStatusText(purchaseData.status),
          ticketingInfo: "취소표 발생 시 알림을 보내드립니다. 취소표 발생 시 빠르게 예매를 진행해 드립니다.",
          seller: {
            id: purchaseData.seller?.id || "",
            name: purchaseData.seller?.name || "판매자",
            profileImage: purchaseData.seller?.profile_image || "/placeholder.svg?height=50&width=50",
          },
        }
        
        setTransaction(formattedData)
      } catch (error) {
        console.error("거래 정보 로딩 에러:", error)
        setError(error instanceof Error ? error.message : "거래 정보를 불러오는데 실패했습니다.")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [orderNumber, currentUser])

  const openChat = () => setIsChatOpen(true)
  const closeChat = () => setIsChatOpen(false)

  const handleAction = async () => {
    if (transaction.currentStep === "ticketing_started") {
      // 취켓팅 상태 확인 로직
      alert("현재 취켓팅이 진행 중입니다. 취소표 발생 시 알림을 보내드립니다.")
    } else if (transaction.currentStep === "ticketing_completed") {
      // 취켓팅 완료 후 구매 확정 로직
      if (confirm("구매를 확정하시겠습니까? 구매확정 후에는 취소할 수 없습니다.")) {
        try {
          // 거래 상태 업데이트 API 호출
          const response = await fetch(`/api/transactions/${orderNumber}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currentStep: "confirmed",
            }),
          })
          
          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "구매 확정에 실패했습니다.")
          }
          
          alert("구매가 확정되었습니다.")
          
          // 상태 업데이트
          setTransaction({
            ...transaction,
            currentStep: "confirmed",
            status: "구매 확정",
            stepDates: {
              ...transaction.stepDates,
              confirmed: new Date().toISOString(),
            },
          })
        } catch (error) {
          console.error("구매 확정 에러:", error)
          alert(error instanceof Error ? error.message : "구매 확정에 실패했습니다.")
        }
      }
    } else if (transaction.currentStep === "confirmed") {
      // 이미 구매 확정된 경우 리뷰 페이지로 이동
      router.push(`/review/${orderNumber}`)
    }
  }

  // 현재 단계에 따른 버튼 텍스트 결정
  const getActionButtonText = () => {
    switch (transaction.currentStep) {
      case "ticketing_started":
        return "취켓팅 상태 확인"
      case "ticketing_completed":
        return "구매 확정하기"
      case "confirmed":
        return "리뷰 작성하기"
      default:
        return "다음 단계로"
    }
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
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
            onClick={() => router.push("/mypage")}
            className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            마이페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <Link href="/mypage" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>마이페이지로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">구매 거래 상세</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6 transition-all duration-300 hover:shadow-md">
          <div className="p-6 md:p-8">
            <div className="mb-8">
              <div>
                <span className="text-sm text-gray-500 mb-1 block">티켓 정보</span>
                <h2 className="text-2xl font-bold text-gray-900">{transaction.ticket.title}</h2>
              </div>
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
                    <Calendar className="h-5 w-5 mr-3 text-blue-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">공연 날짜</span>
                      <span className="font-medium">{transaction.ticket.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <Clock className="h-5 w-5 mr-3 text-blue-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">공연 시간</span>
                      <span className="font-medium">{transaction.ticket.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <MapPin className="h-5 w-5 mr-3 text-blue-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">공연 장소</span>
                      <span className="font-medium">{transaction.ticket.venue}</span>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <CreditCard className="h-5 w-5 mr-3 text-blue-500" />
                    <div>
                      <span className="text-xs text-gray-500 block">결제 금액</span>
                      <span className="font-medium">{transaction.price.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-full mr-3">
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
                        className="text-blue-600"
                      >
                        <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
                        <path d="M15 3v6h6" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs text-blue-600 block">좌석 정보</span>
                      <span className="font-medium text-blue-800">{transaction.ticket.seat}</span>
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
                message="취소표 발생 시 즉시 예매를 진행해 드립니다. 취소표 발생 알림을 받으시면 앱을 확인해주세요."
                updatedAt={
                  transaction.currentStep === "ticketing_completed"
                    ? transaction.stepDates.ticketing_completed || undefined
                    : transaction.stepDates.ticketing_started || undefined
                }
              />

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">취켓팅 상태</span>
                  <span className="font-medium text-blue-600">{transaction.ticketingStatus}</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">예상 완료 시간</span>
                  <span className="font-medium">
                    {transaction.currentStep === "ticketing_completed" ? "완료됨" : "판매자와 협의"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-6 flex flex-col sm:flex-row justify-end gap-4">
              {transaction.currentStep === "confirmed" && (
                <Link href={`/review/${transaction.id}`}>
                  <Button variant="outline" className="w-full sm:w-auto">
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
                      className="mr-2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    판매자 리뷰 작성
                  </Button>
                </Link>
              )}
            </div>
            {/* 오른쪽 아래 구매확정 버튼 */}
            <div className="mt-10 flex flex-col items-end gap-2">
              <div className="flex justify-end gap-4 w-full">
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
                  판매자에게 메시지
                </Button>
                <Button
                  onClick={handleAction}
                  disabled={transaction.currentStep !== "ticketing_completed"}
                  className={`px-6 py-3 rounded-lg shadow-md font-semibold ${
                    transaction.currentStep === "ticketing_completed"
                      ? "bg-[#FFD600] hover:bg-[#FFE600] text-black"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                  }`}
                >
                  구매확정
                </Button>
              </div>
              {transaction.currentStep !== "ticketing_completed" && (
                <p className="text-sm text-gray-500 italic">
                  판매자가 취켓팅을 완료한 이후 구매확정 버튼을 누르실 수 있습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 1:1 채팅 인터페이스 */}
      {isChatOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
            {/* 채팅 헤더 */}
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden">
                  <Image
                    src={transaction.seller.profileImage || "/placeholder.svg"}
                    alt={transaction.seller.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-medium">{transaction.seller.name}</h3>
                  <p className="text-xs text-gray-500">판매자</p>
                </div>
              </div>
              <button
                onClick={closeChat}
                className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 실제 채팅 컴포넌트 */}
            <div className="flex-1 overflow-hidden">
              {currentUser?.id && (
                <ChatWithOrderInit 
                  orderNumber={String(orderNumber)} 
                  currentUserId={String(currentUser.id)} 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 
