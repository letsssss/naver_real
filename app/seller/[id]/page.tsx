"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams } from "next/navigation"
import {
  ArrowLeft, Star, ThumbsUp, Calendar, MapPin, Clock
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface SellerData {
  id: string
  name: string
  joinDate: string
  profileImage: string
  rating: number
  reviewCount: number
  responseRate: number
  responseTime: string
  successfulSales: number
  verificationBadges: string[]
  description: string
  proxyTicketingSuccessRate: number
  cancellationTicketingSuccessRate: number
  totalProxyTicketings: number
  totalCancellationTicketings: number
}

interface Review {
  id: number
  reviewer: string
  rating: number
  date: string
  content: string
  ticketInfo: string
  helpful: number
}

interface Ticket {
  id: number
  title: string
  date: string
  time: string
  venue: string
  price: number
  image: string
}

export default function SellerProfile() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState("reviews")
  const [seller, setSeller] = useState<SellerData | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [activeListings, setActiveListings] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSellerData = async () => {
      try {
        setIsLoading(true)
        console.log("판매자 정보 요청 시작:", params.id)
        const res = await fetch(`/api/seller/seller${params.id}`)
        
        if (!res.ok) {
          throw new Error(`판매자 정보를 불러오는데 실패했습니다. 상태 코드: ${res.status}`)
        }
        
        const result = await res.json()
        console.log("판매자 API 응답:", result)

        if (result.seller) {
          const s = result.seller
          setSeller({
            id: s.id,
            name: s.username || s.name || "판매자",
            joinDate: s.joinDate || (s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
            profileImage: s.profileImage || s.avatar_url || "/placeholder.svg",
            rating: s.rating ?? 0,
            reviewCount: result.reviews?.length ?? 0,
            responseRate: s.responseRate ?? s.response_rate ?? 0,
            responseTime: "응답 시간 비공개",
            successfulSales: s.successfulSales ?? 0,
            verificationBadges: s.verificationBadges || [
              (s.verifications?.identity_verified || s.seller_verifications?.[0]?.identity_verified) && "본인인증",
              (s.verifications?.account_verified || s.seller_verifications?.[0]?.account_verified) && "계좌인증",
              (s.verifications?.phone_verified || s.seller_verifications?.[0]?.phone_verified) && "휴대폰인증"
            ].filter(Boolean) as string[],
            description: s.description ?? "",
            proxyTicketingSuccessRate: s.proxyTicketingSuccessRate ?? 0,
            cancellationTicketingSuccessRate: s.cancellationTicketingSuccessRate ?? 0,
            totalProxyTicketings: s.totalProxyTicketings ?? 0,
            totalCancellationTicketings: s.totalCancellationTicketings ?? 0
          })
        } else {
          setError("판매자 정보를 찾을 수 없습니다.")
        }

        if (result.reviews) setReviews(result.reviews)
        if (result.activeListings) setActiveListings(result.activeListings)
      } catch (err) {
        console.error("❌ 판매자 정보 불러오기 실패:", err)
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.")
      } finally {
        setIsLoading(false)
      }
    }

    if (params?.id) {
      fetchSellerData()
    }
  }, [params.id])

  const handleHelpfulClick = (reviewId: number) => {
    setReviews(reviews.map((review) =>
      review.id === reviewId ? { ...review, helpful: review.helpful + 1 } : review
    ))
  }

  if (isLoading) return <div className="p-10 text-center text-gray-500">판매자 정보를 불러오는 중입니다...</div>
  
  if (error) return (
    <div className="p-10 text-center">
      <p className="text-red-500 mb-4">{error}</p>
      <Link href="/" className="text-blue-500 hover:underline">
        홈으로 돌아가기
      </Link>
    </div>
  )

  if (!seller) return <div className="p-10 text-center text-gray-500">판매자 정보를 찾을 수 없습니다.</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>홈으로 돌아가기</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 판매자 프로필 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
            <div className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  <Image
                    src={seller.profileImage || "/placeholder.svg"}
                    alt={seller.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold">{seller.name}</h1>
                    <div className="flex items-center text-yellow-500">
                      <Star className="h-5 w-5 fill-current" />
                      <span className="ml-1 font-medium">{seller.rating}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {seller.verificationBadges.map((badge: string) => (
                      <Badge key={badge} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        ✓ {badge}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">가입일</p>
                      <p className="font-medium">{seller.joinDate}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">응답률</p>
                      <p className="font-medium">{seller.responseRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">거래 성사</p>
                      <p className="font-medium">{seller.successfulSales}건</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 티켓팅 성공률 */}
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl">
                <h2 className="text-lg font-medium mb-4">티켓팅 성공 확률</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-blue-800">대리티켓팅</h3>
                      <span className="text-xl font-bold text-blue-600">
                        {seller.proxyTicketingSuccessRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${seller.proxyTicketingSuccessRate}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      총 {seller.totalProxyTicketings}건 진행
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-green-800">취켓팅</h3>
                      <span className="text-xl font-bold text-green-600">
                        {seller.cancellationTicketingSuccessRate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full"
                        style={{ width: `${seller.cancellationTicketingSuccessRate}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      총 {seller.totalCancellationTicketings}건 진행
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div>
                <h2 className="text-lg font-medium mb-2">판매자 소개</h2>
                <p className="text-gray-700">{seller.description || "소개글이 없습니다."}</p>
              </div>
            </div>
          </div>

          {/* 탭 (리뷰/판매티켓) */}
          <Tabs
            defaultValue="reviews"
            onValueChange={setActiveTab}
            className="bg-white rounded-xl shadow-md overflow-hidden"
          >
            <TabsList className="w-full justify-start p-0 bg-transparent border-b rounded-none h-auto">
              <TabsTrigger
                value="reviews"
                className={`px-6 py-4 rounded-none border-b-2 ${activeTab === "reviews" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
              >
                리뷰 ({reviews.length})
              </TabsTrigger>
              <TabsTrigger
                value="listings"
                className={`px-6 py-4 rounded-none border-b-2 ${activeTab === "listings" ? "border-blue-600 text-blue-600" : "border-transparent"}`}
              >
                판매 중인 티켓 ({activeListings.length})
              </TabsTrigger>
            </TabsList>

            {/* 리뷰 탭 */}
            <TabsContent value="reviews" className="p-6">
              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b pb-6 last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{review.reviewer}</span>
                            <div className="flex text-yellow-500">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${i < review.rating ? "fill-current" : "text-gray-300"}`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">{review.ticketInfo}</p>
                        </div>
                        <span className="text-sm text-gray-500">{review.date}</span>
                      </div>
                      <p className="text-gray-700 mb-3">{review.content}</p>
                      <button
                        className="flex items-center text-sm text-gray-500 hover:text-gray-700"
                        onClick={() => handleHelpfulClick(review.id)}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        도움이 됐어요 ({review.helpful})
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">아직 리뷰가 없습니다.</p>
                </div>
              )}
            </TabsContent>

            {/* 티켓 탭 */}
            <TabsContent value="listings" className="p-6">
              {activeListings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeListings.map((ticket) => (
                    <Link href={`/ticket/${ticket.id}`} key={ticket.id}>
                      <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="relative h-40">
                          <Image
                            src={ticket.image || "/placeholder.svg"}
                            alt={ticket.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="p-4">
                          <h3 className="font-medium mb-2">{ticket.title}</h3>
                          <div className="space-y-1 text-sm text-gray-500 mb-2">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>{ticket.date}</span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>{ticket.time}</span>
                            </div>
                            <div className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              <span>{ticket.venue}</span>
                            </div>
                          </div>
                          <p className="font-medium text-blue-600">{ticket.price.toLocaleString()}원</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">현재 판매 중인 티켓이 없습니다.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
} 