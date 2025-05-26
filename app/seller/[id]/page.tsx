<<<<<<< HEAD
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Star, ThumbsUp, Calendar, MapPin, Clock } from "lucide-react"
import { useParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createBrowserClient } from "@/lib/supabase"

// 임시 기본값 데이터 (데이터 로드 전에 사용)
const defaultSellerData = {
  id: "",
  username: "로딩 중...",
  joinDate: "",
  profileImage: "/placeholder.svg?height=200&width=200",
  rating: 0,
  reviewCount: 0,
  responseRate: 0,
  successfulSales: 0,
  verificationBadges: [],
  description: "",
  proxyTicketingSuccessRate: 0,
  cancellationTicketingSuccessRate: 0,
  totalProxyTicketings: 0,
  totalCancellationTicketings: 0,
}

export default function SellerProfile() {
  const params = useParams()
  const sellerId = params.id as string
  const [activeTab, setActiveTab] = useState("reviews")
  
  // 상태 관리
  const [seller, setSeller] = useState(defaultSellerData)
  const [reviews, setReviews] = useState<any[]>([])
  const [activeListings, setActiveListings] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Supabase 클라이언트 생성
  const supabase = createBrowserClient()

  useEffect(() => {
    const fetchSellerData = async () => {
      if (!sellerId) return
      
      try {
        setIsLoading(true)
        console.log("판매자 정보 요청 시작:", sellerId)
        
        // 1. 프로필 정보 조회
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, name, email, profile_image, created_at, rating, response_rate, description")
          .eq("id", sellerId)
          .maybeSingle()

        if (profileError || !profileData) {
          console.error("프로필 조회 오류:", profileError)
          setError("판매자 정보를 찾을 수 없습니다.")
          setIsLoading(false)
          return
        }

        // 2. 인증 정보 조회
        const { data: verification, error: verificationError } = await supabase
          .from("seller_verifications")
          .select("is_identity_verified, is_account_verified, is_kakao_verified")
          .eq("seller_id", sellerId)
          .maybeSingle()

        if (verificationError) {
          console.error("인증 정보 조회 오류:", verificationError)
        }

        // 3. 판매자 통계 정보 조회 (있을 경우)
        const { data: statsData } = await supabase
          .from("seller_stats")
          .select("successful_sales, proxy_ticketing_success, proxy_ticketing_total, cancellation_ticketing_success, cancellation_ticketing_total")
          .eq("seller_id", sellerId)
          .maybeSingle()

        // 4. 리뷰 조회
        const { data: reviewsData, error: reviewsError } = await supabase
          .from("ratings")
          .select(`
            id,
            rating,
            comment,
            created_at,
            ticket_info,
            reviewer_id
          `)
          .eq("seller_id", sellerId)
          .order("created_at", { ascending: false })

        if (reviewsError) {
          console.error("리뷰 조회 오류:", reviewsError)
        }

        // 5. 판매 중인 티켓 조회
        const { data: listingsData, error: listingsError } = await supabase
          .from("posts")
          .select("id, title, event_date, event_venue, ticket_price, image_url")
          .eq("author_id", sellerId)
          .eq("status", "active")

        if (listingsError) {
          console.error("티켓 조회 오류:", listingsError)
        }

        // 판매자 정보 변환
        const verificationBadges = [
          verification?.is_identity_verified && "본인인증",
          verification?.is_account_verified && "계좌인증", 
          verification?.is_kakao_verified && "카카오인증"
        ].filter(Boolean) as string[]

        // 성공률 계산 (통계 데이터가 있는 경우)
        const proxySuccess = statsData?.proxy_ticketing_success || 0
        const proxyTotal = statsData?.proxy_ticketing_total || 0
        const proxyRate = proxyTotal > 0 ? (proxySuccess / proxyTotal) * 100 : 0

        const cancelSuccess = statsData?.cancellation_ticketing_success || 0
        const cancelTotal = statsData?.cancellation_ticketing_total || 0
        const cancelRate = cancelTotal > 0 ? (cancelSuccess / cancelTotal) * 100 : 0
        
        // seller_stats 말고 view를 직접 호출하려면 (선택사항)
        const { data: cancellationRateView } = await supabase
          .from("cancellation_ticketing_stats_view")
          .select("confirmed_count, cancelled_count, cancellation_ticketing_rate")
          .eq("seller_id", sellerId)
          .maybeSingle();
        
        const { data: proxyRateView } = await supabase
          .from("proxy_ticketing_stats_view")
          .select("confirmed_count, cancelled_count, proxy_ticketing_rate")
          .eq("seller_id", sellerId)
          .maybeSingle();
        
        // View에서 가져온 값이 있으면 우선 사용하고, 없으면 계산된 값 사용
        const finalCancelRate = cancellationRateView?.cancellation_ticketing_rate || cancelRate;
        const finalProxyRate = proxyRateView?.proxy_ticketing_rate || proxyRate;
        
        // 확정 건수 + 취소 건수 = 총 진행 건수 계산
        const cancelConfirmed = cancellationRateView?.confirmed_count || 0;
        const cancelCancelled = cancellationRateView?.cancelled_count || 0;
        const totalCancellationTicketings = cancelConfirmed + cancelCancelled;
        
        const proxyConfirmed = proxyRateView?.confirmed_count || 0;
        const proxyCancelled = proxyRateView?.cancelled_count || 0;
        const totalProxyTicketings = proxyConfirmed + proxyCancelled;

        // 6. 평균 별점 및 리뷰 수 조회 (뷰 기반)
        const { data: avgData, error: avgError } = await supabase
          .from("seller_avg_rating")
          .select("avg_rating, review_count")
          .eq("seller_id", sellerId)
          .maybeSingle()

        if (avgError) {
          console.error("별점 평균 조회 오류:", avgError)
        }

        const avgRating = avgData?.avg_rating || 0
        const reviewCount = avgData?.review_count || 0

        setSeller({
          id: profileData.id,
          username: profileData.name || "판매자",
          joinDate: profileData.created_at,
          profileImage: profileData.profile_image || "/placeholder.svg?height=200&width=200",
          rating: avgRating,
          reviewCount: reviewCount,
          responseRate: profileData.response_rate || 0,
          successfulSales: statsData?.successful_sales || 0,
          verificationBadges,
          description: profileData.description || "",
          proxyTicketingSuccessRate: parseFloat(finalProxyRate.toFixed(1)),
          cancellationTicketingSuccessRate: parseFloat(finalCancelRate.toFixed(1)),
          totalProxyTicketings: totalProxyTicketings > 0 ? totalProxyTicketings : proxyTotal,
          totalCancellationTicketings: totalCancellationTicketings > 0 ? totalCancellationTicketings : cancelTotal,
        })

        // 리뷰 데이터 변환
        if (reviewsData) {
          const formattedReviews = reviewsData.map(review => ({
            id: review.id,
            reviewer: review.reviewer_id,
            rating: review.rating,
            date: review.created_at,
            content: review.comment,
            ticketInfo: review.ticket_info || "티켓 정보 없음",
          }))
          setReviews(formattedReviews)
        }

        // 티켓 데이터 변환
        if (listingsData) {
          const formattedListings = listingsData.map(ticket => ({
            id: ticket.id,
            title: ticket.title,
            date: ticket.event_date,
            venue: ticket.event_venue,
            price: ticket.ticket_price,
            image: ticket.image_url || "/placeholder.svg?height=150&width=300",
          }))
          setActiveListings(formattedListings)
        }

        setIsLoading(false)
      } catch (err) {
        console.error("데이터 로딩 중 오류:", err)
        setError("판매자 정보를 불러오는데 실패했습니다.")
        setIsLoading(false)
      }
    }

    if (sellerId) {
      fetchSellerData()
    }
  }, [sellerId, supabase])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">판매자 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-4">오류가 발생했습니다</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/" className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md transition">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    )
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
                      <Badge key={badge} className="bg-blue-50 text-blue-700 border-blue-200">
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
                <p className="text-gray-700">{seller.description || "소개글이 없습니다."}</p>
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
                        <span className="text-sm text-gray-500">{new Date(review.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-700 mb-3">{review.content}</p>
                    </div>
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
=======
'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// 판매자 정보 타입 정의
interface Seller {
  id: string;
  name: string;
  profileImage?: string;
  email?: string;
  phoneNumber?: string;
  createdAt: string;
}

export default function SellerPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSellerData() {
      try {
        setLoading(true);
        
        // Supabase에서 판매자 정보 조회
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, profileImage, phoneNumber, created_at')
          .eq('id', id)
          .single();

        if (error) {
          console.error('판매자 정보 조회 오류:', error);
          throw new Error('판매자 정보를 불러오는 중 오류가 발생했습니다.');
        }

        if (!data) {
          throw new Error('판매자를 찾을 수 없습니다.');
        }

        // 데이터 형식 변환
        setSeller({
          id: data.id,
          name: data.name || '이름 없음',
          profileImage: data.profileImage,
          email: data.email,
          phoneNumber: data.phoneNumber,
          createdAt: data.created_at
        });
      } catch (err) {
        console.error('판매자 정보 로드 중 오류:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }

    fetchSellerData();
  }, [id]);

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">판매자 정보를 불러오는 중...</h2>
          <div className="animate-pulse w-16 h-16 rounded-full bg-gray-300 mx-auto"></div>
        </div>
      </div>
    );
  }

  // 오류 발생 시 표시
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">오류 발생</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // 판매자를 찾을 수 없는 경우
  if (!seller) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-center space-x-4 mb-6">
            {seller.profileImage ? (
              <img 
                src={seller.profileImage} 
                alt={`${seller.name}의 프로필`} 
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-2xl text-gray-500">{seller.name.charAt(0)}</span>
              </div>
            )}
            
            <div>
              <h1 className="text-2xl font-bold">{seller.name}</h1>
              <p className="text-gray-500">판매자 ID: {seller.id}</p>
              <p className="text-gray-500">가입일: {new Date(seller.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h2 className="text-xl font-semibold mb-4">판매자 정보</h2>
            <div className="space-y-2">
              <p><span className="font-medium">이메일:</span> {seller.email || '비공개'}</p>
              <p><span className="font-medium">연락처:</span> {seller.phoneNumber || '비공개'}</p>
            </div>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h2 className="text-xl font-semibold mb-4">판매 목록</h2>
            <p className="text-gray-500">판매 목록을 불러오는 중입니다...</p>
            {/* 여기에 판매 목록 표시 컴포넌트 추가 예정 */}
          </div>
        </div>
      </div>
    </div>
  );
}
>>>>>>> 02455941ea48b4852a803f920f801b393d47d7cb
