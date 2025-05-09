"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export default function WriteReview() {
  const params = useParams()
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [review, setReview] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [purchase, setPurchase] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 거래 정보 가져오기
    const fetchTransactionData = async () => {
      try {
        // order_number 파라미터 사용
        const orderNumber = params.order_number
        console.log("리뷰 페이지 로딩 - 주문번호:", orderNumber)
        
        const response = await fetch(`/api/transactions/${orderNumber}`)
        
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login?redirect=' + encodeURIComponent(`/review/${orderNumber}`))
            return
          }
          throw new Error('데이터를 불러오는데 실패했습니다.')
        }
        
        const data = await response.json()
        console.log("트랜잭션 데이터 응답:", data)
        
        // API 응답 구조에 맞게 데이터 매핑
        if (data.success && data.transaction) {
          // confirmed-purchases API와 동일한 구조로 매핑
          const mappedData = {
            id: data.transaction.id,
            order_number: orderNumber, // 주문번호 저장
            title: data.transaction.ticket.title || "제목 없음",
            date: data.transaction.ticket.date || '날짜 정보 없음',
            venue: data.transaction.ticket.venue || '장소 정보 없음',
            price: data.transaction.price ? `${data.transaction.price.toLocaleString()}원` : '가격 정보 없음',
            status: data.transaction.status,
            seller: data.transaction.seller?.name || "판매자 없음",
            completedAt: data.transaction.stepDates?.confirmed || new Date().toISOString(),
            reviewSubmitted: false, // 리뷰 작성 페이지이므로 false로 설정
            sellerId: data.transaction.seller?.id || "",
          }
          setPurchase(mappedData)
        } else {
          throw new Error('응답 데이터 형식이 올바르지 않습니다.')
        }
      } catch (err) {
        console.error('거래 정보 로딩 오류:', err)
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactionData()
  }, [params.order_number, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      alert("별점을 선택해주세요.")
      return
    }

    if (review.trim() === "") {
      alert("리뷰 내용을 입력해주세요.")
      return
    }

    setIsSubmitting(true)

    try {
      console.log("리뷰 제출 - 트랜잭션 ID:", purchase.id)
      
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: Number(purchase.id), // ID 값을 사용 (숫자 형식)
          rating,
          comment: review,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "리뷰 등록에 실패했습니다.");
      }

      alert("리뷰가 성공적으로 등록되었습니다.")
      router.push("/mypage/confirmed-purchases")
    } catch (error) {
      alert(error instanceof Error ? error.message : "리뷰 등록 중 오류가 발생했습니다. 다시 시도해주세요.")
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-t-[#FFD600] border-gray-200 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">거래 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12 text-red-500">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 text-sm px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    )
  }

  if (!purchase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12 text-red-500">
          <p>해당 거래를 찾을 수 없습니다.</p>
          <Link href="/mypage/confirmed-purchases">
            <span className="mt-4 text-sm px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors inline-block">
              구매 내역으로 돌아가기
            </span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/mypage" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>마이페이지로 돌아가기</span>
          </Link>
          <h1 className="text-2xl font-bold mt-4">판매자 리뷰 작성</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-medium mb-2">거래 정보</h2>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="mb-1">
                    <span className="font-medium">판매자:</span> {purchase.seller}
                  </p>
                  <p>
                    <span className="font-medium">티켓:</span> {purchase.title}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">별점</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="text-2xl focus:outline-none"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            (hoverRating || rating) >= star ? "text-yellow-500 fill-current" : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="review" className="block text-sm font-medium text-gray-700 mb-2">
                    리뷰 내용
                  </label>
                  <Textarea
                    id="review"
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="판매자와의 거래 경험을 자세히 알려주세요."
                    className="min-h-[150px]"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#FFD600] hover:bg-[#FFE600] text-black"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "제출 중..." : "리뷰 등록하기"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 