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
import BuyerTransactionView from "@/components/BuyerTransactionView"
import SellerTransactionView from "@/components/SellerTransactionView"

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
  ticketingInfo: "",
  seller: {
    id: "",
    name: "",
    profileImage: "/placeholder.svg?height=50&width=50",
  },
  buyer: {
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
          buyer: {
            id: purchaseData.buyer?.id || "",
            name: purchaseData.buyer?.name || "구매자",
            profileImage: purchaseData.buyer?.profile_image || "/placeholder.svg?height=50&width=50",
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

  // 구매자용 액션 핸들러
  const handleBuyerAction = async () => {
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

  // 판매자용 액션 핸들러
  const handleSellerAction = async () => {
    if (transaction.currentStep === "ticketing_started") {
      // 취켓팅 완료 처리 로직
      try {
        // 실제로는 API 호출하여 상태 업데이트
        const response = await fetch(`/api/transactions/seller/${orderNumber}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentStep: 'ticketing_completed',
            stepDates: {
              ...transaction.stepDates,
              ticketing_completed: new Date().toISOString()
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "취켓팅 완료 처리에 실패했습니다.")
        }

        // 성공 시 상태 업데이트
        setTransaction({
          ...transaction,
          currentStep: "ticketing_completed",
          status: "취켓팅 완료",
          stepDates: {
            ...transaction.stepDates,
            ticketing_completed: new Date().toISOString(),
          },
        })

        alert("취켓팅 완료 처리되었습니다. 구매자의 구매 확정을 기다립니다.")
      } catch (error) {
        console.error("Error updating transaction:", error)
        alert("처리 중 오류가 발생했습니다. 다시 시도해주세요.")
      }
    } else if (transaction.currentStep === "confirmed") {
      // 거래 완료 후 리뷰 작성 페이지로 이동
      router.push(`/review/${orderNumber}?role=seller`)
    }
  }

  // 사용자 역할 판별
  const userId = currentUser?.id // 로그인한 사용자 ID
  console.log("현재 사용자 ID:", userId);
  console.log("판매자 ID:", transaction.seller?.id);
  console.log("구매자 ID:", transaction.buyer?.id);
  const isBuyer = transaction.buyer?.id === userId
  const isSeller = transaction.seller?.id === userId
  console.log("isBuyer:", isBuyer, "isSeller:", isSeller);

  // 현재 사용자의 역할에 따라 적절한 액션 핸들러 선택
  const handleAction = isSeller ? handleSellerAction : handleBuyerAction;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 뒤로가기 버튼 */}
      <div className="p-4 bg-white shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span>뒤로가기</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            <h3 className="text-lg font-medium">오류가 발생했습니다</h3>
            <p>{error}</p>
            <button
              onClick={() => router.push("/transactions")}
              className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
            >
              거래 목록으로 돌아가기
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 사용자 역할에 따른 UI 분기 */}
          {isBuyer && <BuyerTransactionView transaction={transaction} onAction={handleAction} />}
          
          {isSeller && <SellerTransactionView transaction={transaction} />}
          
          {!isBuyer && !isSeller && (
            <div className="text-center text-red-500 mt-10 p-6 max-w-3xl mx-auto bg-red-50 rounded-lg border border-red-200">
              <h2 className="text-xl font-bold mb-2">접근 권한 없음</h2>
              <p>이 거래에 접근할 권한이 없습니다.</p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                홈으로 이동
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
} 
