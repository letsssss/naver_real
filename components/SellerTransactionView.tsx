import React from "react"
import { Button } from "@/components/ui/button"
import { TransactionStepper } from "@/components/transaction-stepper"
import { Calendar, MapPin, Clock, CreditCard, Play, ThumbsUp, CheckCircle } from "lucide-react"
import Image from "next/image"

export default function SellerTransactionView({ transaction }: { transaction: any }) {
  // 거래 단계 정의 - 4단계
  const transactionSteps = [
    {
      id: "payment",
      label: "결제 완료",
      icon: <CreditCard className="w-5 h-5" />,
      date: transaction.stepDates?.payment
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
      date: transaction.stepDates?.ticketing_started
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
      date: transaction.stepDates?.ticketing_completed
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
      date: transaction.stepDates?.confirmed
        ? new Date(transaction.stepDates.confirmed).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
    },
  ]

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mt-4">판매자 거래 상세</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6 transition-all duration-300 hover:shadow-md">
          <div className="p-6 md:p-8">
            <div className="mb-8">
              <div>
                <span className="text-sm text-gray-500 mb-1 block">티켓 정보</span>
                <h2 className="text-2xl font-bold text-gray-900">{transaction.ticket?.title || "정보 없음"}</h2>
                <p className="text-sm text-gray-500 mt-1">주문번호: {transaction.id}</p>
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
                    src={transaction.ticket?.image || "/placeholder.svg"}
                    alt={transaction.ticket?.title || "티켓 이미지"}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              </div>
              <div className="md:w-2/3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 p-2 mr-3 bg-blue-100 rounded-full">
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
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">구매자</span>
                      <span className="font-medium">{transaction.buyer?.name || "정보 없음"}</span>
                    </div>
                  </div>
                  <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 p-2 mr-3 bg-blue-100 rounded-full">
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
                        <rect width="20" height="14" x="2" y="5" rx="2" />
                        <line x1="2" x2="22" y1="10" y2="10" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">거래 금액</span>
                      <span className="font-medium">
                        {transaction.price ? transaction.price.toLocaleString() + "원" : "정보 없음"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 구매자와의 메시지 */}
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center">
                    <div className="p-2 bg-purple-100 rounded-full mr-3">
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
                        className="text-purple-600"
                      >
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-xs text-purple-600 block">구매자와 대화</span>
                      <span className="font-medium text-purple-800">실시간 메시지로 소통하세요</span>
                    </div>
                    <div className="ml-auto">
                      <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                        메시지 보내기
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 티켓팅 상태 및 관리 */}
            <div className="mt-10 border-t pt-8">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">티켓팅 상태 관리</h3>
              <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-lg">현재 상태: <span className="text-blue-600">{transaction.ticketingStatus}</span></h4>
                    <p className="mt-2 text-gray-600">{transaction.currentStep === "ticketing_started" 
                      ? "취켓팅을 시작했습니다. 취소표 예매를 완료했다면 아래 버튼을 클릭해주세요." 
                      : transaction.currentStep === "ticketing_completed" 
                        ? "취켓팅이 완료되었습니다. 구매자의 확인을 기다리고 있습니다." 
                        : transaction.currentStep === "confirmed" 
                          ? "구매가 확정되었습니다. 거래가 성공적으로 완료되었습니다."
                          : "정보 없음"}</p>
                  </div>
                  
                  {transaction.currentStep === "ticketing_started" && (
                    <Button 
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                      onClick={() => alert("티켓팅 완료 처리 API 연동 예정")}
                    >
                      티켓팅 완료 처리
                    </Button>
                  )}
                </div>

                {transaction.currentStep === "ticketing_completed" && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <div className="p-1 bg-yellow-200 rounded-full mr-3">
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
                          className="text-yellow-600"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" x2="12" y1="8" y2="12" />
                          <line x1="12" x2="12.01" y1="16" y2="16" />
                        </svg>
                      </div>
                      <p className="text-yellow-800 text-sm">구매자가 구매를 확정하면 거래가 완료됩니다. 구매자에게 확정 요청 메시지를 보낼 수 있습니다.</p>
                    </div>
                    <Button className="mt-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm">
                      구매확정 요청 메시지 보내기
                    </Button>
                  </div>
                )}

                {transaction.currentStep === "confirmed" && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <div className="p-1 bg-green-200 rounded-full mr-3">
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
                          className="text-green-600"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                      <p className="text-green-800 text-sm">구매가 확정되었습니다! 정산이 완료되면 알림을 보내드립니다.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 거래 요약 정보 */}
            <div className="mt-10 border-t pt-8">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">거래 요약</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">주문일시</span>
                  <span className="font-medium">
                    {transaction.stepDates?.payment 
                      ? new Date(transaction.stepDates.payment).toLocaleString("ko-KR") 
                      : "정보 없음"}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-500 block mb-1">거래 상태</span>
                  <span className="font-medium text-blue-600">{transaction.status || "정보 없음"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
} 