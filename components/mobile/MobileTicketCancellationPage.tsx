'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Search, Calendar, MapPin, Star, AlertCircle, RefreshCw, TicketX, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { getSupabaseClient } from '@/lib/supabase'
import { fetchTicketingSuccessRate } from '@/services/statistics-service'
import SuccessRateBadge from '@/components/SuccessRateBadge'
import RequestBadge from '@/components/RequestBadge'
import MobileHeader from './MobileHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

// 기존과 동일한 타입 정의
interface Post {
  id: number;
  title: string;
  content: string;
  category?: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  ticketPrice: number;
  createdAt: string;
  image?: string;
  author: {
    id: string;
    name: string;
    email: string;
    rating?: number;
    profileImage?: string;
  } | null;
}

interface PopularTicket {
  id: number;
  rank: number;
  artist: string;
  date: string;
  venue: string;
}

interface MobileTicketCancellationPageProps {
  mounted: boolean;
}

export default function MobileTicketCancellationPage({ mounted }: MobileTicketCancellationPageProps) {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("all")
  const [tickets, setTickets] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [popularTickets, setPopularTickets] = useState<PopularTicket[]>([])
  const [successRate, setSuccessRate] = useState<number | string>(90)
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 12

  useEffect(() => {
    fetchCancellationTickets()
    fetchSuccessRate()
    
    // 인기 티켓 데이터 설정
    setPopularTickets([
      {
        id: 1,
        rank: 1,
        artist: "세븐틴",
        date: "25.03.20 ~ 25.03.21",
        venue: "잠실종합운동장 주경기장",
      },
      {
        id: 2,
        rank: 2,
        artist: "데이식스 (DAY6)",
        date: "25.02.01 ~ 25.03.30",
        venue: "전국투어",
      },
      {
        id: 3,
        rank: 3,
        artist: "아이브",
        date: "25.04.05 ~ 25.04.06",
        venue: "KSPO DOME",
      },
      {
        id: 4,
        rank: 4,
        artist: "웃는 남자",
        date: "25.01.09 ~ 25.03.09",
        venue: "예술의전당 오페라극장",
      },
    ])
  }, [])

  // 페이지 변경 시 데이터 다시 가져오기
  useEffect(() => {
    if (mounted) {
      fetchCancellationTickets()
    }
  }, [currentPage, mounted])

  // 기존과 동일한 fetchCancellationTickets 함수
  const fetchCancellationTickets = async () => {
    try {
      setLoading(true);
      setError("");

      let apiUrl = `/api/available-posts?page=${currentPage}&limit=${itemsPerPage}`;
      const timestamp = Date.now();
      apiUrl = `${apiUrl}&t=${timestamp}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store',
        next: { revalidate: 0 }
      });

      const data = await response.json();
      const posts = data.posts || [];
      
      // 페이지네이션 정보 설정
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.totalCount || 0);
      } else {
        setTotalPages(Math.ceil(posts.length / itemsPerPage));
        setTotalCount(posts.length);
      }

      if (posts.length === 0) {
        setTickets([]);
        return;
      }

      // 작성자 정보 처리 (기존과 동일)
      const sellerIds = [...new Set(posts.map((post: any) => post.author?.id).filter(Boolean))];
      const supabaseClient = await getSupabaseClient();
      const { data: avgRatings, error: ratingsError } = await supabaseClient
        .from("seller_avg_rating")
        .select("seller_id, avg_rating")
        .in("seller_id", sellerIds);

      if (ratingsError) {
        console.error("판매자 평점 조회 실패:", ratingsError);
        throw new Error("판매자 평점 정보를 불러오는데 실패했습니다.");
      }

      const avgRatingMap = new Map(avgRatings?.map(r => [r.seller_id, r.avg_rating]));

      const enrichedPosts = posts.map((post: any) => {
        const authorId = post.author?.id || post.author_id || post.userId;
        const avgRating = avgRatingMap.get(authorId) ?? 0;

        const author = {
          id: authorId || "",
          name: post.author?.name || post.author_name || post.name || "판매자 정보 없음",
          email: post.author?.email || post.author_email || post.email || "",
          rating: avgRating,
          profileImage: post.author?.profileImage || post.profile_image || post.avatar_url || ""
        };

        return { ...post, author };
      });

      setTickets(enrichedPosts);
    } catch (err) {
      console.error("취켓팅 티켓 불러오기 오류:", err);
      setError(err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // 기존과 동일한 fetchSuccessRate 함수
  const fetchSuccessRate = async () => {
    try {
      const rate = await fetchTicketingSuccessRate();
      setSuccessRate(rate);
    } catch (error) {
      console.error("성공률 조회 실패:", error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      toast("검색어를 입력해주세요", {
        description: "검색어를 입력하고 다시 시도해주세요.",
      })
      return
    }
    router.push(`/search?query=${encodeURIComponent(searchQuery)}&category=ticket-cancellation`)
  }

  // 기존과 동일한 getTicketPrice 함수
  const getTicketPrice = (ticket: Post): number => {
    if ((ticket as any).ticket_price && !isNaN(Number((ticket as any).ticket_price))) {
      return Number((ticket as any).ticket_price);
    }
    
    if (ticket.ticketPrice && !isNaN(Number(ticket.ticketPrice))) {
      return Number(ticket.ticketPrice);
    }
    
    try {
      if (typeof ticket.content === 'string' && ticket.content.startsWith('{')) {
        const contentObj = JSON.parse(ticket.content);
        
        if (contentObj.price && !isNaN(Number(contentObj.price))) {
          return Number(contentObj.price);
        }
        
        if (contentObj.sections && contentObj.sections.length > 0 && contentObj.sections[0].price) {
          return Number(contentObj.sections[0].price);
        }
      }
    } catch (e) {
      console.log('콘텐츠 파싱 오류:', e);
    }
    
    return 0;
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 모바일 헤더 */}
      <MobileHeader mounted={mounted} />

      {/* 모바일 최적화된 Hero 섹션 */}
      <div className="bg-gradient-to-r from-[#0061FF] to-[#60A5FA] relative overflow-visible">
        <section className="container mx-auto flex flex-col items-center justify-center py-8 px-4 relative z-10">
          <div className="mb-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm">
            취소표 예매 성공률 {typeof successRate === 'number' ? `${successRate}%` : successRate}
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-3 leading-tight px-2">
            놓친 티켓, 취소표로 다시 잡자!
          </h1>
          <p className="text-sm text-white/90 text-center mb-6 max-w-xl px-4">
            안전하고 빠르게 예매 완료!  
            <br />
            안전한 입장까지 도와드립니다.
          </p>
          <form onSubmit={handleSearch} className="w-full max-w-md px-4">
            <div className="flex flex-col space-y-3">
              <Input
                type="search"
                placeholder="이벤트, 아티스트, 팀 검색"
                className="flex-1 h-12 rounded-lg border-0 bg-white text-black placeholder:text-gray-500 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="검색어 입력"
              />
              <Button
                type="submit"
                className="h-12 px-6 rounded-lg bg-[#FFD600] hover:bg-[#FFE600] text-black font-medium transition-colors text-base w-full"
              >
                <Search className="w-5 h-5 mr-2" />
                검색
              </Button>
            </div>
          </form>
        </section>
      </div>

      {/* 모바일 최적화된 카테고리 섹션 */}
      <section className="bg-white py-4 border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-start space-x-4 overflow-x-auto pb-2">
            <Link href="/category/콘서트" className="px-3 py-2 text-sm text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap">
              콘서트
            </Link>
            <Link href="/category/뮤지컬-연극" className="px-3 py-2 text-sm text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap">
              뮤지컬/연극
            </Link>
            <Link href="/category/스포츠" className="px-3 py-2 text-sm text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap">
              스포츠
            </Link>
            <Link href="/category/전시-행사" className="px-3 py-2 text-sm text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap">
              전시/행사
            </Link>
          </div>
        </div>
      </section>

      {/* 모바일 최적화된 취켓팅 가능 공연 섹션 */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h2 className="text-xl font-bold">
              취켓팅 <span className="text-[#FF2F6E]">가능</span> 공연
            </h2>
            <p className="text-gray-600 mt-1 text-sm">취소표 예매 서비스로 놓친 티켓을 다시 잡으세요!</p>
          </div>

          <Tabs defaultValue="all" className="mb-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" onClick={() => setActiveTab("all")} className="text-sm">
                전체
              </TabsTrigger>
              <TabsTrigger value="concert" onClick={() => setActiveTab("concert")} className="text-sm">
                콘서트
              </TabsTrigger>
              <TabsTrigger value="musical" onClick={() => setActiveTab("musical")} className="text-sm">
                뮤지컬/연극
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 모바일 최적화된 티켓 그리드 (1열) */}
          <div className="grid gap-4 grid-cols-1">
            {loading ? (
              // 모바일 로딩 상태
              Array(itemsPerPage).fill(0).map((_, index) => (
                <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden p-3 animate-pulse">
                  <div className="w-full h-32 bg-gray-200 rounded mb-3"></div>
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-3"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-2">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-lg font-medium">{error}</p>
                </div>
                <Button onClick={fetchCancellationTickets} className="mt-4">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  다시 시도
                </Button>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  <TicketX className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-xl font-medium">현재 판매 중인 티켓이 없습니다</p>
                  <p className="text-gray-400 mt-2">나중에 다시 확인해주세요</p>
                </div>
              </div>
            ) : (
              // 모바일 최적화된 티켓 카드
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="relative">
                    <Link href={
                      ticket.category === 'TICKET_REQUEST' 
                        ? `/ticket-request/${ticket.id}` 
                        : `/ticket-cancellation/${ticket.id}`
                    }>
                      <Image
                        src={"/placeholder.svg"}
                        alt={ticket.title}
                        width={400}
                        height={200}
                        className="w-full h-32 object-cover"
                      />
                    </Link>
                    <div className="absolute top-2 right-2">
                      {ticket.category === 'TICKET_REQUEST' ? (
                        <RequestBadge />
                      ) : (
                        <SuccessRateBadge sellerId={ticket.author?.id} />
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <div className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors border-transparent bg-black/50 text-white backdrop-blur-sm">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '날짜 정보 없음'}
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <Link href={
                      ticket.category === 'TICKET_REQUEST' 
                        ? `/ticket-request/${ticket.id}` 
                        : `/ticket-cancellation/${ticket.id}`
                    }>
                      <h3 className="text-base font-semibold mb-2 line-clamp-1">{ticket.title}</h3>
                    </Link>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-1">{ticket.eventName || ticket.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span>판매자:</span>
                      {ticket.author?.name ? (
                        <Link
                          href={`/seller/${ticket.author.id || 'unknown'}`}
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          <span className="truncate max-w-20">{ticket.author.name}</span>
                          <div className="flex items-center ml-1 text-yellow-500">
                            <Star className="h-3 w-3 fill-current" />
                            <span className="text-xs ml-0.5">{ticket.author.rating?.toFixed(1) || '4.5'}</span>
                          </div>
                        </Link>
                      ) : (
                        <span className="text-gray-500">판매자 정보 없음</span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-500 mb-3">
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{ticket.eventDate || '날짜 정보 없음'}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                        <span className="line-clamp-1">{ticket.eventVenue || '장소 정보 없음'}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-[#FF2F6E] text-base">{Number(getTicketPrice(ticket)).toLocaleString()}원</span>
                      </div>
                      <Button
                        className="bg-[#FFD600] hover:bg-[#FFE600] text-black rounded-xl px-3 py-1.5 text-xs font-medium w-20 flex items-center justify-center transition-all"
                        onClick={() => router.push(
                          ticket.category === 'TICKET_REQUEST' 
                            ? `/ticket-request/${ticket.id}` 
                            : `/ticket-cancellation/${ticket.id}`
                        )}
                      >
                        신청하기
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 모바일 최적화된 페이지네이션 */}
          {!loading && totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-6">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`${currentPage === pageNum ? 'bg-blue-500 text-white' : ''} min-w-[40px] h-10`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 모바일 최적화된 서비스 설명 섹션 */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">취켓팅 서비스란?</h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-6 w-6 text-[#0061FF]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-1">안전한 입장</h3>
                  <p className="text-sm text-gray-600">본인 인증으로부터 안전하게 입장할 수 있습니다.</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-[#0061FF]"
                  >
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-1">안전한 예매 대행</h3>
                  <p className="text-sm text-gray-600">100% 후입금 제도로 안심하고 진행하실 수 있습니다.</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-[#0061FF]"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-1">높은 성공률</h3>
                  <p className="text-sm text-gray-600">
                    {typeof successRate === 'number' 
                      ? `${successRate}% 이상의 높은 예매 성공률을 자랑합니다.`
                      : '높은 예매 성공률을 자랑합니다.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 모바일 최적화된 인기 티켓 섹션 */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-xl font-bold mb-4">
            오늘의 <span className="text-[#FF2F6E]">인기</span> 티켓
          </h2>
          <div className="space-y-3">
            {popularTickets.map((ticket, index) => (
              <div key={ticket.id}>
                <div className="flex items-center py-3 px-3 hover:bg-gray-50 transition-colors cursor-pointer rounded-lg">
                  <span className="text-[#FF2F6E] font-bold text-lg w-8">{ticket.rank}</span>
                  <div className="flex-1 ml-3">
                    <Link href={`/ticket/${ticket.id}`}>
                      <h3 className="font-medium text-base mb-1">{ticket.artist}</h3>
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{ticket.date}</span>
                      <span>•</span>
                      <span className="truncate">{ticket.venue}</span>
                    </div>
                  </div>
                </div>
                {index < popularTickets.length - 1 && <div className="border-b border-gray-200 my-1"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
} 