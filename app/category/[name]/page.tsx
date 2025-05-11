"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import TicketList from "@/components/ticket-list"
import { createBrowserClient } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"

// 카테고리 이름 매핑 (URL에 사용되는 값 -> 화면에 표시할 값)
const categoryDisplayNames: Record<string, string> = {
  "concert": "콘서트",
  "콘서트": "콘서트",  // 한글 URL 호환성 유지
  "뮤지컬-연극": "뮤지컬/연극",
  "스포츠": "스포츠",
  "전시-행사": "전시/행사"
};

interface CategoryTicket {
  id: number;
  title: string;
  artist: string;
  date: string;
  time: string;
  venue: string;
  price: number;
  image: string;
  status: string;
  authorId: string;
  authorName: string;
  rating: number;
}

export default function CategoryPage({ params }: { params: { name: string } }) {
  // URL 디코딩 및 매핑 적용
  const displayName = categoryDisplayNames[params.name] || decodeURIComponent(params.name);
  const supabase = createBrowserClient();
  
  const [tickets, setTickets] = useState<CategoryTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("latest");
  
  // 콘서트 카테고리의 경우 TicketList 컴포넌트 사용
  const isConcertCategory = params.name.toLowerCase() === "콘서트" || params.name.toLowerCase() === "concert";
  
  useEffect(() => {
    if (isConcertCategory) {
      // 콘서트 카테고리는 TicketList 컴포넌트에서 처리
      setLoading(false);
      return;
    }
    
    async function fetchCategoryTickets() {
      try {
        setLoading(true);
        
        // 카테고리에 맞는 게시물 가져오기
        let query = supabase
          .from("posts")
          .select(`
            id, 
            title, 
            content, 
            event_name,
            event_date,
            event_venue,
            ticket_price,
            status,
            image_url,
            author_id,
            created_at
          `)
          .eq("category", displayName)
          .eq("status", "판매중");
          
        // 정렬 방식 적용
        switch (sortBy) {
          case "latest":
            query = query.order("created_at", { ascending: false });
            break;
          case "popular":
            query = query.order("view_count", { ascending: false });
            break;
          case "lowPrice":
            query = query.order("ticket_price", { ascending: true });
            break;
          case "highPrice":
            query = query.order("ticket_price", { ascending: false });
            break;
          default:
            query = query.order("created_at", { ascending: false });
        }
        
        const { data: posts, error: postsError } = await query;
        
        if (postsError) {
          throw new Error("게시물을 불러오는 중 오류가 발생했습니다.");
        }
        
        if (!posts || posts.length === 0) {
          setTickets([]);
          setLoading(false);
          return;
        }
        
        // 작성자 정보 가져오기
        const authorIds = [...new Set(posts.map(post => post.author_id))];
        const { data: authors, error: authorsError } = await supabase
          .from("users")
          .select("id, name")
          .in("id", authorIds);
          
        if (authorsError) {
          console.error("작성자 정보를 불러오는 중 오류가 발생했습니다:", authorsError);
        }
        
        // 평점 정보 가져오기
        const { data: ratings, error: ratingsError } = await supabase
          .from("seller_avg_rating")
          .select("seller_id, avg_rating")
          .in("seller_id", authorIds);
          
        if (ratingsError) {
          console.error("평점 정보를 불러오는 중 오류가 발생했습니다:", ratingsError);
        }
        
        // 작성자 ID를 키로 하는 맵 생성
        const authorMap = new Map();
        authors?.forEach(author => {
          authorMap.set(author.id, { name: author.name, rating: 0 });
        });
        
        // 평점 정보 추가
        ratings?.forEach(rating => {
          if (authorMap.has(rating.seller_id)) {
            const authorInfo = authorMap.get(rating.seller_id);
            authorMap.set(rating.seller_id, {
              ...authorInfo,
              rating: rating.avg_rating || 0
            });
          }
        });
        
        // 티켓 데이터 가공
        const formattedTickets = posts.map(post => {
          const eventDate = post.event_date ? new Date(post.event_date) : null;
          const formattedDate = eventDate ? 
            eventDate.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".") : 
            "";
          const formattedTime = eventDate ? 
            eventDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : 
            "";
            
          const authorInfo = authorMap.get(post.author_id) || { name: "판매자", rating: 0 };
          
          return {
            id: post.id,
            title: post.title || post.event_name || "제목 없음",
            artist: post.event_name || "",
            date: formattedDate,
            time: formattedTime,
            venue: post.event_venue || "",
            price: post.ticket_price || 0,
            image: post.image_url || "/placeholder.svg",
            status: post.status,
            authorId: post.author_id,
            authorName: authorInfo.name,
            rating: authorInfo.rating
          };
        });
        
        setTickets(formattedTickets);
      } catch (err) {
        console.error("카테고리 티켓 로딩 오류:", err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCategoryTickets();
  }, [supabase, displayName, sortBy, isConcertCategory]);
  
  const handleSortChange = (sortType: string) => {
    setSortBy(sortType);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>홈으로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4 capitalize">{displayName}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
          <Button 
            variant={sortBy === "latest" ? "default" : "outline"} 
            className="rounded-full whitespace-nowrap"
            onClick={() => handleSortChange("latest")}
          >
            최신순
          </Button>
          <Button 
            variant={sortBy === "popular" ? "default" : "outline"} 
            className="rounded-full whitespace-nowrap"
            onClick={() => handleSortChange("popular")}
          >
            인기순
          </Button>
          <Button 
            variant={sortBy === "lowPrice" ? "default" : "outline"} 
            className="rounded-full whitespace-nowrap"
            onClick={() => handleSortChange("lowPrice")}
          >
            낮은가격순
          </Button>
          <Button 
            variant={sortBy === "highPrice" ? "default" : "outline"} 
            className="rounded-full whitespace-nowrap"
            onClick={() => handleSortChange("highPrice")}
          >
            높은가격순
          </Button>
        </div>

        {isConcertCategory ? (
          <TicketList />
        ) : loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
                <Skeleton className="w-full h-48" />
                <div className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-1/4" />
                    <Skeleton className="h-6 w-1/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-red-500">오류가 발생했습니다: {error}</div>
        ) : tickets.length === 0 ? (
          <div className="p-4 text-gray-500">해당 카테고리에 판매중인 티켓이 없습니다.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <Link href={`/ticket/${ticket.id}`}>
                  <Image
                    src={ticket.image || "/placeholder.svg"}
                    alt={ticket.title}
                    width={400}
                    height={200}
                    className="w-full h-48 object-cover"
                  />
                </Link>
                <div className="p-4">
                  <Link href={`/ticket/${ticket.id}`}>
                    <h3 className="text-lg font-semibold mb-2">{ticket.title}</h3>
                  </Link>
                  <p className="text-gray-600 mb-2">{ticket.artist}</p>
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-2">
                    <span>
                      {ticket.date} {ticket.time}
                    </span>
                    <span>{ticket.venue}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500 mb-2">
                    <span>판매자:</span>
                    <Link
                      href={`/seller/${ticket.authorId}`}
                      className="ml-1 text-blue-600 hover:underline flex items-center"
                    >
                      {ticket.authorName}
                      <div className="flex items-center ml-2 text-yellow-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span className="text-xs">{ticket.rating.toFixed(1)}</span>
                      </div>
                    </Link>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-black">{ticket.price.toLocaleString()}원</span>
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        ticket.status === "매진임박" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

