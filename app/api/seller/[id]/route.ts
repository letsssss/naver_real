import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase"

// 타입 정의
interface SellerVerification {
  identity_verified: boolean;
  account_verified: boolean;
  phone_verified: boolean;
}

interface SellerProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  rating: number | null;
  response_rate: number | null;
  description: string | null;
  verifications: SellerVerification | null;
}

interface SellerStats {
  successful_sales: number;
  proxy_ticketing_success: number;
  proxy_ticketing_total: number;
  cancellation_ticketing_success: number;
  cancellation_ticketing_total: number;
}

interface Review {
  id: number;
  rating: number;
  content: string;
  created_at: string;
  reviewer: { name: string } | null;
  ticket_info: string;
  helpful_count: number;
}

interface Listing {
  id: number;
  title: string;
  event_date: string;
  event_time: string;
  event_venue: string;
  ticket_price: number;
  image_url: string | null;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const sellerId = params.id
    console.log("판매자 정보 API 호출됨 - ID:", sellerId)
    const supabase = createAdminClient()

    // 판매자 기본 정보 조회
    const { data: rawSellerData, error: sellerError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        avatar_url,
        created_at,
        rating,
        response_rate,
        description,
        seller_verifications(*)
      `)
      .eq('id', sellerId)
      .single()

    if (sellerError || !rawSellerData) {
      console.error("판매자 조회 오류:", sellerError)
      return NextResponse.json(
        { error: "판매자를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    // 판매자 데이터 변환
    const seller: SellerProfile = {
      id: rawSellerData.id,
      name: rawSellerData.name,
      email: rawSellerData.email,
      avatar_url: rawSellerData.avatar_url,
      created_at: rawSellerData.created_at,
      rating: rawSellerData.rating,
      response_rate: rawSellerData.response_rate,
      description: rawSellerData.description,
      verifications: rawSellerData.seller_verifications?.[0] || null
    }

    // 판매자의 거래 성공 통계 조회
    const { data: statsData } = await supabase
      .from('seller_stats')
      .select(`
        successful_sales,
        proxy_ticketing_success,
        proxy_ticketing_total,
        cancellation_ticketing_success,
        cancellation_ticketing_total
      `)
      .eq('seller_id', sellerId)
      .single()

    const stats = statsData as SellerStats | null

    // 판매자의 리뷰 조회
    const { data: rawReviewsData } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        content,
        created_at,
        reviewer:profiles!inner(name),
        ticket_info,
        helpful_count
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(10)

    // 리뷰 데이터 변환
    const reviews: Review[] = (rawReviewsData || []).map(review => ({
      id: review.id,
      rating: review.rating,
      content: review.content,
      created_at: review.created_at,
      reviewer: review.reviewer?.[0] || null,
      ticket_info: review.ticket_info,
      helpful_count: review.helpful_count
    }))

    // 판매자의 활성 리스팅 조회
    const { data: listingsData } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        event_date,
        event_time,
        event_venue,
        ticket_price,
        image_url
      `)
      .eq('author_id', sellerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    const listings = listingsData as Listing[] | null

    // 응답 데이터 구성
    const formattedSeller = {
      id: seller.id,
      username: seller.name,
      joinDate: new Date(seller.created_at).toISOString().split('T')[0],
      profileImage: seller.avatar_url || "/placeholder.svg?height=200&width=200",
      rating: seller.rating || 0,
      responseRate: seller.response_rate || 0,
      description: seller.description || "",
      verificationBadges: [
        seller.verifications?.identity_verified && "본인인증",
        seller.verifications?.account_verified && "계좌인증",
        seller.verifications?.phone_verified && "휴대폰인증",
      ].filter(Boolean),
      ...stats,
    }

    const formattedReviews = reviews.map(review => ({
      id: review.id,
      reviewer: review.reviewer?.name || "익명",
      rating: review.rating,
      date: new Date(review.created_at).toISOString().split('T')[0],
      content: review.content,
      ticketInfo: review.ticket_info,
      helpful: review.helpful_count,
    }))

    const formattedListings = listings?.map(listing => ({
      id: listing.id,
      title: listing.title,
      date: new Date(listing.event_date).toISOString().split('T')[0],
      time: listing.event_time,
      venue: listing.event_venue,
      price: listing.ticket_price,
      image: listing.image_url || "/placeholder.svg?height=150&width=300",
    })) || []

    return NextResponse.json({
      seller: formattedSeller,
      reviews: formattedReviews,
      activeListings: formattedListings,
    })
  } catch (error) {
    console.error("판매자 정보 조회 중 오류 발생:", error)
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    )
  }
} 