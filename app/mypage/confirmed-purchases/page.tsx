'use client';

import Link from "next/link"
import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from '@/lib/supabase'
import { useAuth } from "@/contexts/auth-context"

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
  order_number: string;
}

export default function ConfirmedPurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  // 구매 내역을 불러오는 함수를 별도로 분리하여 필요할 때마다 호출할 수 있게 합니다.
  async function fetchConfirmedPurchases() {
    // 사용자가 로그인되지 않은 경우 로그인 페이지로 리다이렉트
    if (!user) {
      router.push('/login?redirect=/mypage/confirmed-purchases')
      return
    }

    setLoading(true)
    try {
      console.log("📋 구매 확정 내역 조회 시작:", user.id);
      
      // 구매 확정된 거래 내역 조회 (status가 CONFIRMED인 것들)
      const response = await fetch(`/api/purchase?userId=${user.id}&status=CONFIRMED`)
      
      if (!response.ok) {
        throw new Error('구매 내역을 불러오는데 실패했습니다.')
      }

      const data = await response.json()
      console.log("📋 API 응답:", data);

      if (data && Array.isArray(data) && data.length > 0) {
        // 각 거래 데이터를 확인하고 포맷팅
        const formattedPurchases = data.map((purchase: any) => {
          console.log("💾 거래 데이터 포맷팅:", purchase);
          
          const postData = purchase.post || purchase.posts;
          const productName = postData?.title || postData?.event_name || purchase.ticket_title || '제목 없음';
          const eventDate = postData?.event_date || purchase.event_date;
          const eventVenue = postData?.event_venue || purchase.event_venue || '장소 정보 없음';
          const ticketPrice = purchase.total_price || postData?.ticket_price || purchase.ticket_price;
          const sellerName = purchase.seller?.name || postData?.author?.name || '판매자';
          
          return {
            id: purchase.id,
            title: productName,
            date: eventDate ? new Date(eventDate).toLocaleDateString('ko-KR') : '날짜 미정',
            venue: eventVenue,
            price: ticketPrice ? `${Number(ticketPrice).toLocaleString()}원` : '가격 정보 없음',
            status: '거래완료',
            seller: sellerName,
            completedAt: purchase.updated_at ? 
              new Date(purchase.updated_at).toLocaleDateString('ko-KR') : 
              new Date().toLocaleDateString('ko-KR'),
            reviewSubmitted: false, // 기본값으로 설정
            order_number: purchase.order_number || purchase.id.toString()
          };
        });

        console.log("✅ 포맷팅된 구매 내역:", formattedPurchases);

        // 로컬 스토리지에서 리뷰 작성 완료된 주문번호 목록 가져오기
        const reviewCompletedOrders = JSON.parse(localStorage.getItem('reviewCompletedOrders') || '{}');
        
        // 로컬 스토리지의 리뷰 완료 상태 반영
        const updatedPurchases = formattedPurchases.map((purchase: any) => {
          const isReviewSubmitted = purchase.order_number && reviewCompletedOrders[purchase.order_number];
          
          return {
            ...purchase,
            reviewSubmitted: isReviewSubmitted
          };
        });
        
        setPurchases(updatedPurchases);
        
        // 리뷰 작성 완료 플래그가 있으면 제거 (일회성 플래그)
        if (localStorage.getItem('reviewJustCompleted') === 'true') {
          localStorage.removeItem('reviewJustCompleted');
        }
      } else {
        console.log("📭 구매 확정 내역이 없습니다.");
        setPurchases([]);
      }
    } catch (err) {
      console.error('구매 내역 로딩 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 인증 로딩이 완료되고 사용자가 있을 때만 API 호출
    if (!authLoading && user) {
      fetchConfirmedPurchases()
    } else if (!authLoading && !user) {
      // 인증 로딩이 완료되었는데 사용자가 없으면 로그인 페이지로
      router.push('/login?redirect=/mypage/confirmed-purchases')
    }

    // 페이지가 focus를 얻을 때 (다른 페이지에서 돌아왔을 때) 데이터를 다시 불러옵니다.
    // 이렇게 하면 리뷰 작성 페이지에서 돌아왔을 때 최신 상태를 보여줄 수 있습니다.
    const handleFocus = () => {
      // 리뷰가 방금 완료된 경우에만 리로드 (성능 최적화)
      if (localStorage.getItem('reviewJustCompleted') === 'true' && user) {
        fetchConfirmedPurchases()
      }
    }

    window.addEventListener('focus', handleFocus)
    
    // NextJS 특화 이벤트: 라우팅 완료 후 데이터 재로딩
    if (typeof window !== 'undefined') {
      const handleRouteComplete = () => {
        // 리뷰가 방금 완료된 경우에만 리로드 (성능 최적화)
        if (localStorage.getItem('reviewJustCompleted') === 'true' && user) {
          fetchConfirmedPurchases()
        }
      }
      
      // 라우트가 변경되고 완료된 후에 이벤트를 발생시킵니다
      window.addEventListener('popstate', handleRouteComplete)
      
      return () => {
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('popstate', handleRouteComplete)
      }
    }
    
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [router, user, authLoading])

  // 리뷰 작성 완료 후 로컬 상태 업데이트를 위한 함수
  const handleReviewSubmit = (orderId: string) => {
    setPurchases(prevPurchases => 
      prevPurchases.map(purchase => 
        purchase.order_number === orderId
          ? { ...purchase, reviewSubmitted: true }
          : purchase
      )
    )
  }

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
                        href={`/review/${purchase.order_number}`}
                        className="text-sm px-6 py-3 bg-[#FFD600] text-black font-semibold rounded-md hover:bg-[#FFE600] transition-colors shadow-md border border-[#FFD600]"
                        onClick={() => {
                          // 로컬 스토리지에 현재 URL 저장 (리뷰 작성 후 돌아올 위치)
                          localStorage.setItem('returnToConfirmedPurchases', 'true')
                        }}
                      >
                        리뷰 작성하기
                      </Link>
                    ) : (
                      <span className="text-sm px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-md border border-gray-300 shadow-sm cursor-not-allowed">
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