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
      // 다른 마이페이지 파일들과 동일하게 Supabase 클라이언트 직접 사용
      const supabaseClient = await getSupabaseClient();
      
      // 현재 사용자의 거래완료된 구매 내역 조회 (status 필드 제거)
      const { data, error } = await supabaseClient
        .from('rooms')
        .select(`
          id,
          created_at,
          updated_at,
          buyer_confirmed_at,
          post_id,
          seller_id
        `)
        .eq('buyer_id', user.id)
        .not('buyer_confirmed_at', 'is', null) // buyer_confirmed_at이 null이 아닌 거래 (완료된 거래)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        // 각 거래에 대해 별도로 posts와 seller 정보 가져오기
        const formattedPurchases = await Promise.all(
          data.map(async (room: any) => {
            // 포스트 정보 가져오기
            const { data: postData } = await supabaseClient
              .from('posts')
              .select('id, title, event_date, event_venue, ticket_price, category')
              .eq('id', room.post_id)
              .single();

            // 판매자 정보 가져오기
            const { data: sellerData } = await supabaseClient
              .from('profiles')
              .select('id, name, phone_number')
              .eq('id', room.seller_id)
              .single();
            
            return {
              id: room.id,
              title: postData?.title || '제목 없음',
              date: postData?.event_date ? new Date(postData.event_date).toLocaleDateString('ko-KR') : '날짜 미정',
              venue: postData?.event_venue || '장소 미정',
              price: postData?.ticket_price ? `${postData.ticket_price.toLocaleString()}원` : '가격 미정',
              status: '거래완료',
              seller: sellerData?.name || '판매자',
              completedAt: room.buyer_confirmed_at ? 
                new Date(room.buyer_confirmed_at).toLocaleDateString('ko-KR') : 
                new Date(room.updated_at).toLocaleDateString('ko-KR'),
              reviewSubmitted: false, // 일단 기본값으로 설정, 추후 리뷰 테이블과 조인하여 실제 값 가져올 수 있음
              order_number: room.id.toString() // room id를 주문번호로 사용
            };
          })
        );

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