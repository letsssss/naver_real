"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Calendar, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseClient } from "@/lib/supabase"

export default function TicketDetail({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 티켓 데이터 상태
  const [ticketData, setTicketData] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  
  // 판매자 정보 상태
  const [seller, setSeller] = useState({
    id: "",
    username: "",
    profileImage: "",
    responseRate: 0,
    successfulSales: 0,
    rating: 0, // 평균 별점
    reviewCount: 0, // 리뷰 수 추가
  })

  // 티켓 데이터 가져오기
  useEffect(() => {
    const fetchTicketData = async () => {
      setLoading(true)
      try {
        // Supabase 클라이언트 가져오기
        const supabase = await getSupabaseClient()
        
        // 티켓 기본 정보 가져오기
        const { data: post, error: postError } = await supabase
          .from("posts")
          .select(`
            id, 
            title, 
            content, 
            event_name,
            event_date,
            event_venue,
            image_url,
            author_id,
            created_at,
            users:author_id (
              id,
              name,
              profile_image
            )
          `)
          .eq("id", params.id)
          .single();
        
        if (postError) {
          throw new Error('티켓 정보를 찾을 수 없습니다.');
        }
        
        // 티켓 좌석 정보 가져오기
        const { data: seatData, error: seatError } = await supabase
          .from("seats")
          .select("*")
          .eq("post_id", params.id)
          .order('price', { ascending: true });
        
        if (seatError) {
          // 좌석 정보 로딩 오류 처리
        }
        
        // 데이터 설정
        setTicketData({
          id: post.id,
          title: post.title || post.event_name || "티켓 제목 없음",
          artist: post.event_name || "아티스트 정보 없음",
          venue: post.event_venue || "장소 정보 없음",
          description: post.content || "상세 설명 없음",
          image: post.image_url || "/placeholder.svg",
          sellerId: post.author_id,
          date: post.event_date,
        });
        
        setTickets(seatData || []);
        
        // 판매자 정보 가져오기
        if (post.author_id) {
          await fetchSellerSummary(post.author_id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '티켓 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTicketData();
  }, [params.id]);

  const fetchSellerSummary = async (sellerId: string) => {
    try {
      const supabase = await getSupabaseClient()
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, name, profile_image, response_rate")
        .eq("id", sellerId)
        .maybeSingle()

      const { data: statsData } = await supabase
        .from("seller_stats")
        .select("successful_sales")
        .eq("seller_id", sellerId)
        .maybeSingle()

      // 기존 ratings 직접 조회 및 계산 코드 대신 seller_rating_stats_view 사용
      const { data: ratingStats } = await supabase
        .from("seller_rating_stats_view")
        .select("avg_rating, review_count")
        .eq("seller_id", sellerId)
        .maybeSingle();

      setSeller({
        id: profileData?.id || "",
        username: profileData?.name || "익명 사용자",
        profileImage: profileData?.profile_image || "/placeholder.svg",
        responseRate: profileData?.response_rate || 0,
        successfulSales: statsData?.successful_sales || 0,
        rating: ratingStats?.avg_rating || 0,
        reviewCount: ratingStats?.review_count || 0,
      })
    } catch (error) {
      // 판매자 정보 조회 오류 처리
    }
  }

  // 로딩 중일 때
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-blue-200 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">티켓 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }
  
  // 오류 발생 시
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-6">
            <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span>홈으로 돌아가기</span>
            </Link>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">오류 발생</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600"
            >
              다시 시도하기
            </Button>
          </div>
        </main>
      </div>
    );
  }
  
  // 티켓 데이터가 없을 때
  if (!ticketData) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-6">
            <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span>홈으로 돌아가기</span>
            </Link>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-700 mb-4">티켓을 찾을 수 없습니다</h1>
            <p className="text-gray-600 mb-6">요청하신 티켓 정보가 존재하지 않거나 삭제되었습니다.</p>
            <Link href="/">
              <Button className="bg-blue-500 hover:bg-blue-600">
                홈으로 돌아가기
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>홈으로 돌아가기</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-8">
            <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">{ticketData.artist}</div>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{ticketData.title}</h1>
            <p className="mt-4 text-gray-500">{ticketData.description}</p>
            <div className="mt-8 border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">판매자 정보</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">판매자 정보</h3>
                
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                    <Image
                      src={seller.profileImage}
                      alt={seller.username}
                      fill
                      className="object-cover"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-gray-500">판매자:</p>
                      <span className="font-medium text-blue-600">{seller.username}</span>
                      <div className="flex items-center text-yellow-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="ml-1 font-medium">{seller.rating}</span>
                        <span className="text-gray-500 text-xs ml-1">({seller.reviewCount})</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-1">
                      계약 성사 {seller.successfulSales}건 | 응답률 {seller.responseRate}%
                    </p>
                  </div>
                </div>
                
                <Link 
                  href={`/seller/${seller.id}`} 
                  className="block text-center mt-3 py-2 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50 transition"
                >
                  프로필 보기
                </Link>
              </div>
            </div>
            
            {tickets.length > 0 ? (
              <div className="mt-6 space-y-6">
                {tickets.map((ticket) => (
                  <Link
                    href={`/order?ticketId=${params.id}&seat=${ticket.id}`}
                    key={ticket.id}
                    className="block mb-4 last:mb-0"
                  >
                    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="flex">
                        <div className="w-48 relative">
                          <Image
                            src={ticketData.image || "/placeholder.svg"}
                            alt={`${ticketData.title} - ${ticket.section || ''} ${ticket.row || ''}열`}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 p-4 flex items-center">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Calendar className="h-5 w-5 text-gray-500" />
                              <span className="font-medium">
                                {ticket.date || ticketData.date || '날짜 정보 없음'} {ticket.time || ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                              {ticket.section && <span>{ticket.section}</span>}
                              {ticket.row && (
                                <>
                                  <span>•</span>
                                  <span>{ticket.row}열</span>
                                </>
                              )}
                              {ticket.grade && (
                                <>
                                  <span>•</span>
                                  <span>{ticket.grade}석</span>
                                </>
                              )}
                              {ticket.floor && (
                                <>
                                  <span>•</span>
                                  <span>{ticket.floor}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {ticket.tags && ticket.tags.length > 0 && ticket.tags.map((tag: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  {tag}
                                </span>
                              ))}
                              {ticket.delivery_method && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  {ticket.delivery_method}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end justify-between ml-4 min-w-[120px]">
                            <div className="text-right">
                              <div className="text-sm text-gray-500 mb-1">{ticket.quantity || 1}장</div>
                              <div className="text-lg font-bold text-orange-500">₩{ticket.price?.toLocaleString() || '가격 정보 없음'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-8 text-center py-12 border rounded-lg">
                <p className="text-gray-500">현재 판매 중인 티켓이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

