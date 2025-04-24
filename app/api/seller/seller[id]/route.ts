import { NextResponse } from "next/server"

// 임시 판매자 데이터
const sellerData = {
  seller1: {
    id: "seller1",
    username: "티켓마스터",
    joinDate: "2022-05-15",
    profileImage: "/placeholder.svg?height=200&width=200",
    rating: 4.8,
    reviewCount: 56,
    responseRate: 98,
    responseTime: "평균 30분 이내",
    successfulSales: 124,
    verificationBadges: ["본인인증", "계좌인증", "휴대폰인증"],
    description: "안녕하세요! 항상 정확하고 빠른 거래를 약속드립니다. 궁금한 점이 있으시면 언제든지 문의해주세요.",
    proxyTicketingSuccessRate: 98.5,
    cancellationTicketingSuccessRate: 97.2,
    totalProxyTicketings: 87,
    totalCancellationTicketings: 63,
  },
  seller2: {
    id: "seller2",
    username: "콘서트프로",
    joinDate: "2023-01-10",
    profileImage: "/placeholder.svg?height=200&width=200",
    rating: 4.9,
    reviewCount: 42,
    responseRate: 95,
    responseTime: "평균 1시간 이내",
    successfulSales: 89,
    verificationBadges: ["본인인증", "계좌인증"],
    description: "신속하고 정확한 티켓팅으로 고객님의 만족을 최우선으로 생각합니다.",
    proxyTicketingSuccessRate: 96.8,
    cancellationTicketingSuccessRate: 95.5,
    totalProxyTicketings: 65,
    totalCancellationTicketings: 48,
  },
  seller3: {
    id: "seller3",
    username: "티켓헌터",
    joinDate: "2023-08-20",
    profileImage: "/placeholder.svg?height=200&width=200",
    rating: 4.7,
    reviewCount: 28,
    responseRate: 92,
    responseTime: "평균 2시간 이내",
    successfulSales: 52,
    verificationBadges: ["본인인증", "휴대폰인증"],
    description: "최선을 다해 원하시는 티켓을 구해드리겠습니다.",
    proxyTicketingSuccessRate: 94.2,
    cancellationTicketingSuccessRate: 93.8,
    totalProxyTicketings: 45,
    totalCancellationTicketings: 32,
  },
}

// 임시 리뷰 데이터
const reviewsData = {
  seller1: [
    {
      id: 1,
      reviewer: "콘서트러버",
      rating: 5,
      date: "2024-02-15",
      content: "정말 빠른 응답과 친절한 대응 감사합니다. 티켓도 약속한 시간에 정확히 전달해주셨어요!",
      ticketInfo: "세븐틴 콘서트 - VIP석",
      helpful: 12,
    },
    {
      id: 2,
      reviewer: "음악팬",
      rating: 5,
      date: "2024-01-20",
      content: "두 번째 거래인데 역시 믿을 수 있는 판매자입니다. 다음에도 또 거래하고 싶어요.",
      ticketInfo: "아이유 콘서트 - R석",
      helpful: 8,
    },
  ],
  seller2: [
    {
      id: 1,
      reviewer: "공연매니아",
      rating: 5,
      date: "2024-02-10",
      content: "매우 전문적이고 신속한 서비스였습니다. 강력 추천합니다!",
      ticketInfo: "르세라핌 콘서트 - VIP석",
      helpful: 15,
    },
  ],
  seller3: [
    {
      id: 1,
      reviewer: "티켓팬",
      rating: 4,
      date: "2024-02-01",
      content: "전반적으로 만족스러운 거래였습니다. 다만 응답이 조금 늦었어요.",
      ticketInfo: "뉴진스 콘서트 - R석",
      helpful: 6,
    },
  ],
}

// 임시 판매 중인 티켓 데이터
const activeListingsData = {
  seller1: [
    {
      id: 1,
      title: "세븐틴 'FOLLOW' TO SEOUL",
      date: "2024.03.20",
      time: "19:00",
      venue: "잠실종합운동장 주경기장",
      price: 110000,
      image: "/placeholder.svg?height=150&width=300",
    },
    {
      id: 2,
      title: "아이유 콘서트",
      date: "2024.05.01",
      time: "18:00",
      venue: "올림픽공원 체조경기장",
      price: 99000,
      image: "/placeholder.svg?height=150&width=300",
    },
  ],
  seller2: [
    {
      id: 1,
      title: "르세라핌 FEARLESS in SEOUL",
      date: "2024.04.15",
      time: "18:30",
      venue: "고척스카이돔",
      price: 121000,
      image: "/placeholder.svg?height=150&width=300",
    },
  ],
  seller3: [
    {
      id: 1,
      title: "뉴진스 BUNNY PAWS",
      date: "2024.03.25",
      time: "19:30",
      venue: "KSPO DOME",
      price: 132000,
      image: "/placeholder.svg?height=150&width=300",
    },
  ],
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const sellerId = params.id
    const seller = sellerData[sellerId as keyof typeof sellerData]
    
    if (!seller) {
      return NextResponse.json(
        { error: "판매자를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    const reviews = reviewsData[sellerId as keyof typeof reviewsData] || []
    const activeListings = activeListingsData[sellerId as keyof typeof activeListingsData] || []

    return NextResponse.json({
      seller,
      reviews,
      activeListings,
    })
  } catch (error) {
    console.error("판매자 정보 조회 중 오류 발생:", error)
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    )
  }
} 