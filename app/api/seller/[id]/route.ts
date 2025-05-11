import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createAdminClient()
  const sellerId = params.id
  
  console.log("[✅ API 진입] sellerId:", sellerId);
  console.log("[🔑 확인] SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 10) + "...");
  console.log("[🔑 확인] SERVICE_ROLE_KEY 존재여부:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "존재함" : "없음");

  try {
    // 판매자 정보 가져오기
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        id,
        name,
        email,
        profile_image,
        created_at,
        rating,
        response_rate,
        description,
        seller_verifications!inner(
          identity_verified,
          account_verified,
          phone_verified
        )
      `)
      .eq("id", sellerId)
      .single()
    
    console.log("📦 profile 조회 결과:", profile);
    console.log("❗ profileError:", profileError);

    if (profileError || !profile) {
      console.log("❌ 판매자 없음 - 404 반환");
      return NextResponse.json({ error: "판매자 없음" }, { status: 404 })
    }

    // 디버깅: seller_verifications 확인
    console.log("🔍 seller_verifications:", profile.seller_verifications);

    const verificationBadges = [
      profile.seller_verifications[0]?.identity_verified && "본인인증",
      profile.seller_verifications[0]?.account_verified && "계좌인증",
      profile.seller_verifications[0]?.phone_verified && "휴대폰인증",
    ].filter(Boolean)

    const seller = {
      id: profile.id,
      username: profile.name,
      joinDate: new Date(profile.created_at).toISOString().split("T")[0],
      profileImage: profile.profile_image,
      rating: profile.rating || 0,
      reviewCount: 0, // 나중에 아래에서 계산
      responseRate: profile.response_rate || 0,
      successfulSales: 0, // 나중에 계산
      verificationBadges,
      description: profile.description || "",
      proxyTicketingSuccessRate: 0,
      cancellationTicketingSuccessRate: 0,
      totalProxyTicketings: 0,
      totalCancellationTicketings: 0,
    }

    // 리뷰 조회
    const { data: reviews } = await supabase
      .from("ratings")
      .select(`
        id,
        rating,
        comment,
        created_at,
        ticket_info,
        helpful_count,
        profiles!inner(name)
      `)
      .eq("seller_id", sellerId)

    // 리뷰 변환
    const formattedReviews = (reviews || []).map((r) => ({
      id: r.id,
      reviewer: r.profiles[0]?.name || "익명",
      rating: r.rating,
      date: new Date(r.created_at).toISOString().split("T")[0],
      content: r.comment,
      ticketInfo: r.ticket_info,
      helpful: r.helpful_count,
    }))

    seller.reviewCount = formattedReviews.length

    // 판매 중 티켓 조회
    const { data: listings } = await supabase
      .from("posts")
      .select("id, title, event_date, event_time, event_venue, ticket_price, image_url")
      .eq("author_id", sellerId)
      .eq("status", "active")

    const formattedListings = (listings || []).map((post) => ({
      id: post.id,
      title: post.title,
      date: new Date(post.event_date).toISOString().split("T")[0],
      time: post.event_time,
      venue: post.event_venue,
      price: post.ticket_price,
      image: post.image_url || "/placeholder.svg",
    }))

    // 추가 디버깅: 반환되는 데이터 구조 확인
    console.log("✅ API 응답 성공");

    return NextResponse.json({
      seller,
      reviews: formattedReviews,
      activeListings: formattedListings,
    })
  } catch (err) {
    console.error("❌ 판매자 API 오류:", err)
    return NextResponse.json({ error: "서버 오류" }, { status: 500 })
  }
} 