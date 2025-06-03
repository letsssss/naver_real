'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, CheckCircle } from "lucide-react";
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase'
import { Skeleton } from "@/components/ui/skeleton";

// 티켓 타입 정의
interface Ticket {
  id: number;
  post_id: number;
  section: string;
  row: string;
  seat_number: string;
  price: number;
  status: string;
  seller_id: string;
  seller_name: string;
  seller_rating?: number;
}

export default function TicketList() {
  const router = useRouter();
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchTickets = async () => {
    let supabaseClient;
    try {
      setLoading(true);
      supabaseClient = await getSupabaseClient();
      
      const { data: posts, error: postsError } = await supabaseClient
        .from("posts")
        .select("id, author_id")
        .eq("category", "콘서트")
        .eq("status", "판매중");
        
      if (postsError) {
        throw new Error("게시물을 불러오는 중 오류가 발생했습니다.");
      }
      
      if (!posts || posts.length === 0) {
        setTickets([]);
        return;
      }
      
      // 가져온 게시물에 해당하는 좌석 정보 가져오기
      const postIds = posts.map(post => post.id);
      const { data: seatsData, error: seatsError } = await supabaseClient
        .from("seats")
        .select("*, posts!inner(id, title, event_name, event_date)")
        .in("post_id", postIds)
        .order("price", { ascending: true });
        
      if (seatsError) {
        throw new Error("좌석 정보를 불러오는 중 오류가 발생했습니다.");
      }
      
      // 판매자 정보 가져오기
      const sellerIds = [...new Set(posts.map(post => post.author_id))];
      const { data: sellersData, error: sellersError } = await supabaseClient
        .from("users")
        .select("id, name")
        .in("id", sellerIds);
        
      if (sellersError) {
        throw new Error("판매자 정보를 불러오는 중 오류가 발생했습니다.");
      }
      
      // 판매자 평점 가져오기
      const { data: ratingsData, error: ratingsError } = await supabaseClient
        .from("seller_avg_rating")
        .select("seller_id, avg_rating")
        .in("seller_id", sellerIds);
        
      if (ratingsError) {
        throw new Error("판매자 평점을 불러오는 중 오류가 발생했습니다.");
      }
      
      // 판매자 ID를 키로, 이름과 평점을 값으로 하는 맵 생성
      const sellerMap = new Map();
      sellersData?.forEach(seller => {
        sellerMap.set(seller.id, { name: seller.name, rating: 0 });
      });
      
      // 평점 정보 추가
      ratingsData?.forEach(rating => {
        if (sellerMap.has(rating.seller_id)) {
          const sellerInfo = sellerMap.get(rating.seller_id);
          sellerMap.set(rating.seller_id, { 
            ...sellerInfo, 
            rating: rating.avg_rating || 0 
          });
        }
      });
      
      // 티켓 데이터 가공
      const formattedTickets = seatsData.map((seat: any) => ({
        id: seat.id,
        post_id: seat.post_id,
        section: seat.section || "",
        row: seat.row || "",
        seat_number: seat.seat_number || "",
        price: seat.price,
        status: seat.status || "판매중",
        seller_id: seat.posts.author_id,
        seller_name: sellerMap.get(seat.posts.author_id)?.name || "판매자",
        seller_rating: sellerMap.get(seat.posts.author_id)?.rating || 0
      }));
      
      setTickets(formattedTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchTickets();
  }, []);
  
  const handleSellerClick = (sellerId: string) => {
    router.push(`/seller/${sellerId}`);
  };
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(9)].map((_, index) => (
          <div key={index} className="border p-4 rounded-lg shadow">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-1" />
            <Skeleton className="h-4 w-1/3 mb-1" />
            <Skeleton className="h-4 w-2/3 mb-3" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }
  
  if (error) {
    return <div className="p-4 text-red-500">오류가 발생했습니다: {error}</div>;
  }
  
  if (tickets.length === 0) {
    return <div className="p-4 text-gray-500">현재 판매중인 티켓이 없습니다.</div>;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tickets.map((ticket) => (
        <div 
          key={ticket.id} 
          className={`border p-4 rounded-lg shadow hover:shadow-md transition-shadow
            ${ticket.status === "판매완료" ? "opacity-75 bg-gray-50" : ""}`}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg">좌석: {ticket.section} {ticket.row}열 {ticket.seat_number}번</h3>
            {ticket.status === "판매완료" && (
              <span className="inline-flex items-center bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3 mr-1" />
                판매완료
              </span>
            )}
          </div>
          <p className="text-gray-600 mb-1">가격: {ticket.price.toLocaleString()}원</p>
          <p className="text-gray-600 mb-1">
            상태:
            <span
              className={`ml-1 ${
                ticket.status === "판매중"
                  ? "text-green-500"
                  : ticket.status === "예약중"
                    ? "text-yellow-500"
                    : "text-red-500"
              }`}
            >
              {ticket.status}
            </span>
          </p>
          <div className="flex items-center mb-3">
            <p className="text-gray-600">판매자: </p>
            <button 
              onClick={() => handleSellerClick(ticket.seller_id)}
              className="ml-1 text-blue-600 hover:underline flex items-center"
            >
              {ticket.seller_name}
              <div className="flex items-center ml-2 text-yellow-500">
                <Star className="h-3 w-3 fill-current" />
                <span className="text-xs ml-0.5">{ticket.seller_rating.toFixed(1)}</span>
              </div>
            </button>
          </div>
          
          {ticket.status === "판매완료" ? (
            <Button disabled className="w-full bg-gray-400 hover:bg-gray-400 cursor-not-allowed">
              <CheckCircle className="w-4 h-4 mr-2" />
              판매 완료
            </Button>
          ) : (
            <Button 
              className="w-full"
              onClick={() => router.push(`/ticket/${ticket.post_id}`)}
            >
              <ShoppingCart className="w-4 h-4 mr-2" /> 
              구매하기
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

