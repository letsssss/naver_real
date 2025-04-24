"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Star, ThumbsUp, Calendar, MapPin, Clock } from "lucide-react"
import { useParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Ticket } from "lucide-react"

interface Review {
  id: number
  reviewer: string
  rating: number
  date: string
  content: string
  ticketInfo: string
  helpful: number
}

interface Listing {
  id: number
  title: string
  date: string
  time: string
  venue: string
  price: number
  image: string
}

interface SellerData {
  id: string
  username: string
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

interface SellerProfileData {
  seller: SellerData
  reviews: Review[]
  activeListings: Listing[]
}

export default function SellerProfile() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState("reviews")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SellerProfileData | null>(null)

  useEffect(() => {
    const fetchSellerData = async () => {
      try {
        const response = await fetch(`/api/seller/seller${params.id}`)
        if (!response.ok) {
          throw new Error("판매자 정보를 불러오는데 실패했습니다.")
        }
        const data = await response.json()
        setData(data)
      } catch (error) {
        setError(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.")
      } finally {
        setLoading(false)
      }
    }

    fetchSellerData()
  }, [params.id])

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>
  }

  if (error || !data) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <p className="text-red-500">{error || "판매자 정보를 불러올 수 없습니다."}</p>
        <Link href="/" className="mt-4 text-blue-500 hover:underline">
          홈으로 돌아가기
        </Link>
      </div>
    )
  }

  const { seller, reviews, activeListings } = data

  const handleHelpfulClick = (reviewId: number) => {
    setData((prevData) => ({
      ...prevData,
      reviews: prevData?.reviews.map((review) =>
        review.id === reviewId ? { ...review, helpful: review.helpful + 1 } : review
      ) || [],
    }))
  }

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
          {/* 판매자 프로필 카드 */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
            <div className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  <Image
                    src={seller.profileImage || "/placeholder.svg"}
                    alt={seller.username}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold">{seller.username}</h1>
                    <div className="flex items-center text-yellow-500">
                      <Star className="h-5 w-5 fill-current" />
                      <span className="ml-1 font-medium">{seller.rating}</span>
                      <span className="text-gray-500 text-sm ml-1">({seller.reviewCount})</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {seller.verificationBadges.map((badge) => (
                      <Badge key={badge} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        ✓ {badge}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">가입일</p>
                      <p className="font-medium">{new Date(seller.joinDate).toLocaleDateString()}</p>
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

              <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl">
                <h2 className="text-lg font-medium mb-4">티켓팅 성공 확률</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-blue-800">대리티켓팅</h3>
                      <span className="text-xl font-bold text-blue-600">{seller.proxyTicketingSuccessRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${seller.proxyTicketingSuccessRate}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">총 {seller.totalProxyTicketings}건 진행</p>
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
                    <p className="text-sm text-gray-500 mt-2">총 {seller.totalCancellationTicketings}건 진행</p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div>
                <h2 className="text-lg font-medium mb-2">판매자 소개</h2>
                <p className="text-gray-700">{seller.description}</p>
              </div>
            </div>
          </div>

          {/* 탭 섹션 */}
          <Tabs
            defaultValue="reviews"
            onValueChange={setActiveTab}
            className="bg-white rounded-xl shadow-md overflow-hidden"
          >
            <TabsList className="w-full justify-start p-0 bg-transparent border-b rounded-none h-auto">
              <TabsTrigger
                value="reviews"
                className={`px-6 py-4 rounded-none border-b-2 ${
                  activeTab === "reviews" ? "border-blue-600 text-blue-600" : "border-transparent"
                }`}
              >
                리뷰 ({reviews.length})
              </TabsTrigger>
              <TabsTrigger
                value="listings"
                className={`px-6 py-4 rounded-none border-b-2 ${
                  activeTab === "listings" ? "border-blue-600 text-blue-600" : "border-transparent"
                }`}
              >
                판매 중인 티켓 ({activeListings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="p-6">
              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <Card key={review.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{review.reviewer}</CardTitle>
                            <CardDescription>{review.ticketInfo}</CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span>{review.rating}</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-2">{review.content}</p>
                        <div className="flex justify-between items-center text-sm text-gray-500">
                          <span>{new Date(review.date).toLocaleDateString()}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleHelpfulClick(review.id)}>
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            도움됨 {review.helpful}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">아직 리뷰가 없습니다.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="listings" className="p-6">
              {activeListings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeListings.map((ticket) => (
                    <Card key={ticket.id}>
                      <div className="relative h-40">
                        <Image
                          src={ticket.image || "/placeholder.svg"}
                          alt={ticket.title}
                          fill
                          className="object-cover rounded-t-lg"
                        />
                      </div>
                      <CardHeader>
                        <CardTitle className="text-lg">{ticket.title}</CardTitle>
                        <CardDescription>
                          {ticket.date} {ticket.time}
                          <br />
                          {ticket.venue}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">
                            {ticket.price.toLocaleString()}원
                          </span>
                          <Button>
                            <Ticket className="w-4 h-4 mr-2" />
                            상세보기
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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