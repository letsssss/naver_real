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

// 상태 배지 컴포넌트
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusColor = (status: string) => {
    switch(status?.toUpperCase()) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
      {status || '알 수 없음'}
    </span>
  );
};

export default function TransactionDetail() {
  const params = useParams()
  const router = useRouter()
  const orderNumber = params?.order_number as string
  
  const [transaction, setTransaction] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Tailwind 테스트 요소
  const tailwindTest = (
    <div className="p-5 mt-4 mb-4 bg-red-500 text-white rounded-xl shadow-lg">
      테일윈드 CSS 테스트 - 이 요소가 빨간 배경과 흰색 텍스트로 표시되면 정상입니다.
    </div>
  )
  
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
        {tailwindTest}
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
  
  // 날짜 포맷팅 함수
  const formatDate = (dateString: string) => {
    if (!dateString) return '정보 없음';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    });
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">거래 상세</h1>
      
      {tailwindTest}
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* 상단 정보 섹션 */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">거래 번호: {transaction.order_number}</h2>
            <StatusBadge status={transaction.status} />
          </div>
          
          <div className="text-sm text-gray-500">
            거래 생성일: {formatDate(transaction.created_at)}
          </div>
        </div>
        
        {/* 주요 정보 섹션 */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-gray-500 text-sm">구매자</div>
            <div className="font-medium">{transaction.buyer?.name || "정보 없음"}</div>
          </div>
          
          <div className="space-y-2">
            <div className="text-gray-500 text-sm">판매자</div>
            <div className="font-medium">{transaction.seller?.name || "정보 없음"}</div>
          </div>
          
          <div className="space-y-2">
            <div className="text-gray-500 text-sm">상품</div>
            <div className="font-medium">{transaction.post?.title || "정보 없음"}</div>
          </div>
          
          <div className="space-y-2">
            <div className="text-gray-500 text-sm">가격</div>
            <div className="font-medium text-lg text-blue-600">
              {transaction.total_price ? `${transaction.total_price.toLocaleString()}원` : "정보 없음"}
            </div>
          </div>
        </div>
        
        {/* 추가 정보 섹션 - 필요시 표시 */}
        {transaction.post && (
          <div className="p-6 border-t bg-gray-50">
            <h3 className="font-medium mb-3">상품 정보</h3>
            <div className="text-sm text-gray-700">
              {transaction.post.description || "상세 설명이 없습니다."}
            </div>
          </div>
        )}
        
        {/* 액션 버튼 섹션 */}
        <div className="flex p-6 border-t bg-gray-50 justify-end space-x-3">
          <button 
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-50"
          >
            뒤로 가기
          </button>
          
          <button 
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
} 
