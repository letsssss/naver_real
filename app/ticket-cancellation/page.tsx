"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Calendar, MapPin, Clock, ArrowRight, Star, AlertCircle, RefreshCw, TicketX } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from '@/lib/supabase'
import { fetchTicketingSuccessRate } from "@/services/statistics-service"
import SuccessRateBadge from "@/components/SuccessRateBadge"
import RequestBadge from "@/components/RequestBadge"
import { useIsMobile } from "@/hooks/useMediaQuery"
import MobileHeader from "@/components/mobile/MobileHeader"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { NotificationDropdown } from "@/components/notification-dropdown"

const categories = [
  { name: "콘서트", href: "/category/콘서트" },
  { name: "뮤지컬/연극", href: "/category/뮤지컬-연극" },
  { name: "스포츠", href: "/category/스포츠" },
  { name: "전시/행사", href: "/category/전시-행사" },
]

// API에서 가져온 데이터의 타입 정의
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

// 인기 티켓 데이터 타입 정의
interface PopularTicket {
  id: number;
  rank: number;
  artist: string;
  date: string;
  venue: string;
}

export default function TicketCancellationPage() {
  const { user, signOut } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState("all")
  const [mounted, setMounted] = useState(false)
  const [tickets, setTickets] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [popularTickets, setPopularTickets] = useState<PopularTicket[]>([])
  const [successRate, setSuccessRate] = useState<number | string>(90)
  
  // 페이지네이션 상태 추가
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 12 // 한 페이지에 표시할 티켓 수

  const isMobile = useIsMobile()

  // URL 파라미터에서 검색어 가져오기
  const urlSearchQuery = searchParams?.get("query") || ""

  useEffect(() => {
    setMounted(true)
    
    // URL에서 검색어가 있으면 검색 입력창에 설정
    if (urlSearchQuery) {
      setSearchQuery(urlSearchQuery)
    }
    
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
  }, [urlSearchQuery])

  // 페이지 변경 시 데이터 다시 가져오기
  useEffect(() => {
    if (mounted) {
      fetchCancellationTickets()
    }
  }, [currentPage, mounted, urlSearchQuery])

  // 취켓팅 가능 티켓 가져오기 (페이지네이션 및 검색 적용)
  const fetchCancellationTickets = async () => {
    try {
      setLoading(true);
      setError("");

      // 검색어가 있으면 검색 API 사용, 없으면 페이지네이션 API 사용
      let apiUrl = urlSearchQuery 
        ? `/api/available-posts?search=${encodeURIComponent(urlSearchQuery)}&limit=1000`
        : `/api/available-posts?page=${currentPage}&limit=${itemsPerPage}`;
      
      const timestamp = Date.now();
      apiUrl = `${apiUrl}&t=${timestamp}`;

      console.log(`API 호출: ${apiUrl}`);

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
      console.log('API 응답 데이터:', data);
      
      const posts = data.posts || [];
      
      // 검색 모드가 아닐 때만 페이지네이션 정보 설정
      if (!urlSearchQuery) {
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.totalCount || 0);
        } else {
          setTotalPages(Math.ceil(posts.length / itemsPerPage));
          setTotalCount(posts.length);
        }
      }

      if (posts.length === 0) {
        setTickets([]);
        return;
      }

      // 1. 작성자 ID 추출
      const sellerIds = [...new Set(posts.map((post: any) => post.author?.id).filter(Boolean))];

      // 2. 평균 별점 뷰에서 조회
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

      // 3. 게시물에 작성자 정보 연결
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

  // 취켓팅 성공률 가져오기
  const fetchSuccessRate = async () => {
    try {
      const rate = await fetchTicketingSuccessRate();
      setSuccessRate(rate);
    } catch (error) {
      console.error("성공률 조회 실패:", error);
      // 기본값 유지
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
    
    // 현재 페이지에서 검색 파라미터 추가
    router.push(`/ticket-cancellation?query=${encodeURIComponent(searchQuery)}`)
  }

  // 검색 초기화 함수
  const handleClearSearch = () => {
    setSearchQuery("")
    router.push("/ticket-cancellation")
  }

  const handleLogin = () => {
    router.push("/login")
  }

  // 초기 렌더링을 위한 더미 UI 컴포넌트
  const AuthButtons = () => {
    // mounted 상태가 아닐 때는 아무것도 표시하지 않음
    if (!mounted) {
      return null;
    }

    if (user) {
      return (
        <>
          <button
            onClick={signOut}
            className="text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap"
          >
            로그아웃
          </button>
          <button
            onClick={() => router.push('/mypage')}
            className="text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap"
          >
            마이페이지
          </button>
        </>
      );
    }

    return (
      <button
        onClick={handleLogin}
        className="text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap"
      >
        로그인
      </button>
    );
  };

  // 티켓 가격 추출 helper 함수
  const getTicketPrice = (ticket: Post): number => {
    // 1. ticket_price 필드 확인 (데이터베이스 필드명)
    if ((ticket as any).ticket_price && !isNaN(Number((ticket as any).ticket_price))) {
      return Number((ticket as any).ticket_price);
    }
    
    // 2. ticketPrice 필드 확인 (프론트엔드 필드명)
    if (ticket.ticketPrice && !isNaN(Number(ticket.ticketPrice))) {
      return Number(ticket.ticketPrice);
    }
    
    // 3. 콘텐츠에서 가격 추출 시도
    try {
      if (typeof ticket.content === 'string' && ticket.content.startsWith('{')) {
        const contentObj = JSON.parse(ticket.content);
        
        // 3.1 콘텐츠 객체의 price 필드 확인
        if (contentObj.price && !isNaN(Number(contentObj.price))) {
          return Number(contentObj.price);
        }
        
        // 3.2 sections 배열에서 첫 번째 항목 확인
        if (contentObj.sections && contentObj.sections.length > 0 && contentObj.sections[0].price) {
          return Number(contentObj.sections[0].price);
        }
      }
    } catch (e) {
      // JSON 파싱 오류는 무시
      console.log('콘텐츠 파싱 오류:', e);
    }
    
    // 가격 정보가 없는 경우 기본값 0 반환
    return 0;
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 모바일 헤더 */}
      <div className="block md:hidden">
        <MobileHeader mounted={mounted} />
      </div>

      {/* 데스크톱 헤더 */}
      <div className="hidden md:block">
        <header className="w-full bg-white shadow-sm">
          <div className="container mx-auto px-4 overflow-x-auto">
            <div className="flex h-16 items-center justify-between min-w-[768px]">
              <div className="flex items-center space-x-6">
                <Link href="/" className="text-2xl font-bold text-[#0061FF] whitespace-nowrap">
                  이지티켓
                </Link>
                <Link
                  href="/proxy-ticketing"
                  className="text-gray-700 hover:text-[#0061FF] transition-colors border-r pr-6 whitespace-nowrap"
                >
                  대리티켓팅
                </Link>
                <Link
                  href="/ticket-cancellation"
                  className="text-[#0061FF] transition-colors border-r pr-6 whitespace-nowrap font-medium"
                >
                  취켓팅
                </Link>
                <Link href="/tickets" className="text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap">
                  티켓 구매/판매
                </Link>
              </div>
              <div className="flex items-center space-x-6">
                {mounted && user ? (
                  <>
                    <div className="text-gray-700">
                      <span className="font-medium text-[#0061FF]">{user.name}</span>님 환영합니다
                    </div>
                    <NotificationDropdown />
                    <AuthButtons />
                    <Link href="/cart" className="text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap">
                      장바구니
                    </Link>
                  </>
                ) : mounted ? (
                  <AuthButtons />
                ) : (
                  // 마운트되기 전에는 아무것도 렌더링하지 않음
                  <div className="invisible">로딩 중...</div>
                )}
                <button
                  onClick={() => router.push("/ticket-request")}
                  className="px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors whitespace-nowrap"
                  style={{ backgroundColor: '#ec4899' }}
                >
                  취켓팅 구해요
                </button>
                <button
                  onClick={() => router.push("/sell")}
                  className="px-4 py-2 bg-[#0061FF] text-white rounded-xl hover:bg-[#0052D6] transition-colors whitespace-nowrap"
                >
                  취켓팅 등록
                </button>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#0061FF] to-[#60A5FA] relative overflow-visible">
        <section className="container mx-auto flex flex-col items-center justify-center py-16 px-4 relative z-10 max-[640px]:py-8 max-[640px]:px-3">
          <div className="mb-4 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm max-[640px]:mb-3 max-[640px]:px-2 max-[640px]:py-0.5 max-[640px]:text-xs">
            취소표 예매 성공률 {typeof successRate === 'number' ? `${successRate}%` : successRate}
          </div>
          <h1 className="text-5xl font-bold text-white text-center mb-4 leading-tight max-[640px]:text-2xl max-[640px]:mb-3">
            놓친 티켓, 취소표로 다시 잡자!
          </h1>
          <p className="text-lg text-white/90 text-center mb-8 max-w-xl max-[640px]:text-sm max-[640px]:mb-6 max-[640px]:max-w-sm">
            안전하고 빠르게 예매 완료!  
            <br />
            안전한 입장까지 도와드립니다.
          </p>
          <form onSubmit={handleSearch} className="w-full max-w-md flex flex-col sm:flex-row gap-2 max-[640px]:max-w-sm max-[640px]:gap-2">
            <Input
              type="search"
              placeholder="이벤트, 아티스트, 팀 검색"
              className="flex-1 h-12 rounded-lg sm:rounded-r-none border-0 bg-white text-black placeholder:text-gray-500 max-[640px]:h-10 max-[640px]:text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="검색어 입력"
            />
            <Button
              type="submit"
              className="h-12 px-8 rounded-none sm:rounded-l-none bg-[#FFD600] hover:bg-[#FFE600] text-black font-medium transition-colors max-[640px]:h-10 max-[640px]:px-6 max-[640px]:text-sm"
              style={{ borderTopRightRadius: '0.5rem', borderBottomRightRadius: '0.5rem', borderTopLeftRadius: '0', borderBottomLeftRadius: '0' }}
            >
              <Search className="w-5 h-5 mr-2 max-[640px]:w-4 max-[640px]:h-4 max-[640px]:mr-1" />
              검색
            </Button>
          </form>
        </section>
      </div>

      {/* 카테고리 섹션 */}
      <section className="bg-white py-6 border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-center space-x-4 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Link
                key={category.name}
                href={category.href}
                className="px-4 py-2 text-gray-700 hover:text-[#0061FF] transition-colors whitespace-nowrap"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 취켓팅 가능 공연 섹션 */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            {urlSearchQuery ? (
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">
                    &quot;{urlSearchQuery}&quot; 검색 결과
                  </h2>
                  <p className="text-gray-600 mt-2">
                    {tickets.length}개의 검색 결과를 찾았습니다
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleClearSearch}
                  className="flex items-center gap-2"
                >
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
                  >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                  검색 초기화
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl md:text-3xl font-bold">
                  취켓팅 <span className="text-[#FF2F6E]">가능</span> 공연
                </h2>
                <p className="text-gray-600 mt-2">취소표 예매 서비스로 놓친 티켓을 다시 잡으세요!</p>
              </>
            )}
          </div>

          {!urlSearchQuery && (
            <Tabs defaultValue="all" className="mb-8">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="all" onClick={() => setActiveTab("all")}>
                  전체
                </TabsTrigger>
                <TabsTrigger value="concert" onClick={() => setActiveTab("concert")}>
                  콘서트
                </TabsTrigger>
                <TabsTrigger value="musical" onClick={() => setActiveTab("musical")}>
                  뮤지컬/연극
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              // 로딩 상태 표시
              Array(itemsPerPage).fill(0).map((_, index) => (
                <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden p-4 animate-pulse">
                  <div className="w-full h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="col-span-full text-center py-8">
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
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500 mb-4">
                  <TicketX className="w-16 h-16 mx-auto mb-4" />
                  {urlSearchQuery ? (
                    <>
                      <p className="text-xl font-medium">검색 결과가 없습니다</p>
                      <p className="text-gray-400 mt-2">다른 검색어로 다시 시도해보세요</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xl font-medium">현재 판매 중인 티켓이 없습니다</p>
                      <p className="text-gray-400 mt-2">나중에 다시 확인해주세요</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              // 검색 모드일 때는 클라이언트 사이드 페이지네이션 적용
              (() => {
                const displayTickets = urlSearchQuery 
                  ? tickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  : tickets;
                
                // 검색 모드일 때 총 페이지 수 계산
                if (urlSearchQuery) {
                  const searchTotalPages = Math.ceil(tickets.length / itemsPerPage);
                  if (searchTotalPages !== totalPages) {
                    setTotalPages(searchTotalPages);
                  }
                }

                return displayTickets.map((ticket) => {
                  return (
                    <div
                      key={ticket.id}
                      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all transform hover:-translate-y-1"
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
                            className="w-full h-48 object-cover"
                          />
                        </Link>
                        <div className="absolute top-3 right-3">
                          {(() => {
                            return ticket.category === 'TICKET_REQUEST' ? (
                              <RequestBadge />
                            ) : (
                              <SuccessRateBadge sellerId={ticket.author?.id} />
                            );
                          })()}
                        </div>
                        <div className="absolute bottom-3 left-3">
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-black/50 text-white backdrop-blur-sm">
                            {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '날짜 정보 없음'}
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <Link href={
                          ticket.category === 'TICKET_REQUEST' 
                            ? `/ticket-request/${ticket.id}` 
                            : `/ticket-cancellation/${ticket.id}`
                        }>
                          <h3 className="text-lg font-semibold mb-2 line-clamp-1">{ticket.title}</h3>
                        </Link>
                        <p className="text-gray-600 mb-2">{ticket.eventName || ticket.title}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{ticket.category === 'TICKET_REQUEST' ? '구매자' : '판매자'}:</span>
                          {ticket.author?.name ? (
                            <Link
                              href={`/seller/${ticket.author.id || 'unknown'}`}
                              className="text-blue-600 hover:underline flex items-center"
                            >
                              {ticket.author.name}
                              <div className="flex items-center ml-2 text-yellow-500">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs ml-0.5">{ticket.author.rating?.toFixed(1) || '4.5'}</span>
                              </div>
                            </Link>
                          ) : (
                            <span className="text-gray-500">정보 없음</span>
                          )}
                        </div>
                        <div className="space-y-2 text-sm text-gray-500 mb-3">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            <span>{ticket.eventDate || '날짜 정보 없음'}</span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                            <span className="line-clamp-1">{ticket.eventVenue || '장소 정보 없음'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium text-[#FF2F6E] text-lg">{Number(getTicketPrice(ticket)).toLocaleString()}원</span>
                          </div>
                          <Button
                            className="bg-[#FFD600] hover:bg-[#FFE600] text-black rounded-xl px-3 py-1.5 text-sm font-medium flex items-center justify-center transition-all"
                            onClick={() => router.push(
                              ticket.category === 'TICKET_REQUEST' 
                                ? `/ticket-request/${ticket.id}` 
                                : `/ticket-cancellation/${ticket.id}`
                            )}
                          >
                            {ticket.category === 'TICKET_REQUEST' ? '상세보기' : '신청하기'}
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                });
              })()
            )}
          </div>

          {/* 페이지네이션 UI - 검색 모드와 일반 모드 모두 지원 */}
          {!loading && totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-8">
              {/* 이전 페이지 버튼 */}
              {currentPage > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  이전
                </Button>
              )}
              
              {/* 페이지 번호 버튼들 */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2);
                const pageNum = startPage + i;
                
                if (pageNum > totalPages) return null;
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className={currentPage === pageNum ? 'bg-blue-500 text-white' : ''}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              
              {/* 다음 페이지 버튼 */}
              {currentPage < totalPages && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  다음
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 취켓팅 서비스 설명 섹션 */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-8 max-[640px]:p-4">
            <h2 className="text-2xl font-bold mb-6 max-[640px]:text-xl max-[640px]:mb-4">취켓팅 서비스란?</h2>
            <div className="grid grid-cols-3 gap-8 max-[640px]:gap-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 max-[640px]:w-12 max-[640px]:h-12 max-[640px]:mb-2">
                  <Calendar className="h-8 w-8 text-[#0061FF] max-[640px]:h-5 max-[640px]:w-5" />
                </div>
                <h3 className="text-lg font-semibold mb-2 max-[640px]:text-sm max-[640px]:mb-1">안전한 입장</h3>
                <p className="text-gray-600 max-[640px]:text-xs">본인 인증으로부터 안전하게 입장할 수 있습니다.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 max-[640px]:w-12 max-[640px]:h-12 max-[640px]:mb-2">
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
                    className="h-8 w-8 text-[#0061FF] max-[640px]:h-5 max-[640px]:w-5"
                  >
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 max-[640px]:text-sm max-[640px]:mb-1">안전한 예매 대행</h3>
                <p className="text-gray-600 max-[640px]:text-xs">100% 후입금 제도로 안심하고 진행하실 수 있습니다.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 max-[640px]:w-12 max-[640px]:h-12 max-[640px]:mb-2">
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
                    className="h-8 w-8 text-[#0061FF] max-[640px]:h-5 max-[640px]:w-5"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 max-[640px]:text-sm max-[640px]:mb-1">높은 성공률</h3>
                <p className="text-gray-600 max-[640px]:text-xs">
                  {typeof successRate === 'number' 
                    ? `${successRate}% 이상의 높은 예매 성공률을 자랑합니다.`
                    : '높은 예매 성공률을 자랑합니다.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 인기 티켓 섹션 */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-6">
            오늘의 <span className="text-[#FF2F6E]">인기</span> 티켓
          </h2>
          <div className="space-y-4">
            {popularTickets.map((ticket, index) => (
              <div key={ticket.id}>
                <div className="flex items-center py-4 px-4 hover:bg-gray-50 transition-colors cursor-pointer rounded-lg">
                  <span className="text-[#FF2F6E] font-bold text-xl md:text-2xl w-12 md:w-16">{ticket.rank}</span>
                  <div className="flex-1">
                    <Link href={`/ticket/${ticket.id}`}>
                      <h3 className="font-medium text-base md:text-lg mb-1">{ticket.artist}</h3>
                    </Link>
                    <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500">
                      <span>{ticket.date}</span>
                      <span>•</span>
                      <span>{ticket.venue}</span>
                    </div>
                  </div>
                </div>
                {index < popularTickets.length - 1 && <div className="border-b border-gray-200 my-2"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
