'use client';

import Link from "next/link"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

// 하드코딩된 데이터 제거

interface Purchase {
  id: number;
  title: string;
  date: string;
  venue: string;
  price: string;
  status: string;
  seller: string;
  completedAt: string;
  reviewSubmitted: boolean;
}

export default function ConfirmedPurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchConfirmedPurchases() {
      try {
        const response = await fetch('/api/confirmed-purchases')
        
        if (!response.ok) {
          // 인증 오류면 로그인 페이지로 리다이렉트
          if (response.status === 401) {
            router.push('/login?redirect=/mypage/confirmed-purchases')
            return
          }
          
          throw new Error('데이터를 불러오는데 실패했습니다.')
        }
        
        const data = await response.json()
        // API 응답 구조에 맞게 데이터 접근 방식 수정
        if (data.success && Array.isArray(data.purchases)) {
          setPurchases(data.purchases)
        } else {
          throw new Error('응답 데이터 형식이 올바르지 않습니다.')
        }
      } catch (err) {
        console.error('구매 내역 로딩 오류:', err)
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchConfirmedPurchases()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/mypage" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>마이페이지로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">거래완료된 구매</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center text-[#02C39A] mb-4">
            <CheckCircle2 className="mr-2" />
            <h2 className="text-lg font-semibold">거래완료된 구매 내역</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            구매확정이 완료된 거래입니다. 공연을 즐기고 판매자에게 리뷰를 남겨주세요.
          </p>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-t-[#02C39A] border-gray-200 rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-500">거래내역을 불러오는 중입니다...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 text-sm px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                다시 시도하기
              </button>
            </div>
          ) : purchases.length > 0 ? (
            <div className="space-y-6">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="border rounded-lg p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">{purchase.title}</h3>
                      <p className="text-sm text-gray-600">
                        {purchase.date} | {purchase.venue}
                      </p>
                      <p className="text-sm font-semibold mt-2">{purchase.price}</p>
                      <p className="text-sm text-[#02C39A] mt-1">
                        <span className="inline-flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          {purchase.status}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">판매자: {purchase.seller}</p>
                      <p className="text-xs text-gray-500 mt-1">거래완료: {purchase.completedAt}</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t pt-4"></div>

                  <div className="mt-6 mb-2 flex justify-end">
                    {!purchase.reviewSubmitted ? (
                      <Link
                        href={`/review/${purchase.id}`}
                        className="text-sm px-6 py-3 bg-[#FFD600] text-black font-semibold rounded-md hover:bg-[#FFE600] transition-colors shadow-md border border-[#FFD600]"
                      >
                        리뷰 작성하기
                      </Link>
                    ) : (
                      <span className="text-sm px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-md border border-gray-300 shadow-sm">
                        리뷰 작성 완료
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">거래완료된 구매 내역이 없습니다.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
} 