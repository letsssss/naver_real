"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { notFound } from "next/navigation"

// 간단한 로딩 컴포넌트
const Loading = () => (
  <div className="flex justify-center items-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
)

export default function TransactionDetail() {
  const params = useParams()
  const router = useRouter()
  const orderNumber = params?.order_number as string
  
  const [transaction, setTransaction] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchTransaction = async () => {
      if (!orderNumber) return
      
      console.log(`거래 정보 조회 시작: 주문번호 ${orderNumber}`)
      
      try {
        setIsLoading(true)
        console.log(`API 요청: /api/purchase/${orderNumber}`)
        
        const response = await fetch(`/api/purchase/${orderNumber}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
        })
        
        console.log(`API 응답 상태: ${response.status}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            console.error('거래 정보가 존재하지 않습니다.')
            router.push("/404")
            return
          }
          
          const errorData = await response.json().catch(() => ({}))
          console.error('API 요청 실패:', response.status, errorData)
          throw new Error(errorData.error || "거래 정보를 불러오는데 실패했습니다.")
        }
        
        const data = await response.json()
        console.log('거래 정보 조회 성공', data ? '데이터 있음' : '데이터 없음')
        setTransaction(data)
      } catch (err) {
        console.error('거래 정보 조회 중 오류 발생:', err)
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchTransaction()
  }, [orderNumber, router])
  
  if (isLoading) return <Loading />
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-red-500 mb-4">오류 발생</h1>
        <p>{error}</p>
        <button 
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          홈으로 돌아가기
        </button>
      </div>
    )
  }
  
  if (!transaction) return notFound()
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">거래 상세</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <p className="mb-2"><span className="font-medium">거래 번호:</span> {transaction.order_number}</p>
        <p className="mb-2"><span className="font-medium">구매자:</span> {transaction.buyer?.name || "정보 없음"}</p>
        <p className="mb-2"><span className="font-medium">판매자:</span> {transaction.seller?.name || "정보 없음"}</p>
        <p className="mb-2"><span className="font-medium">상품:</span> {transaction.post?.title || "정보 없음"}</p>
        <p className="mb-2"><span className="font-medium">가격:</span> {transaction.price ? `${transaction.price.toLocaleString()}원` : "정보 없음"}</p>
        <p className="mb-2"><span className="font-medium">상태:</span> {transaction.status || "정보 없음"}</p>
        
        {/* 기타 필요한 정보 */}
      </div>
    </div>
  )
} 
