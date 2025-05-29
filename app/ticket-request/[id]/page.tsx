"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Calendar, MapPin, Clock, CheckCircle, AlertCircle, Star } from "lucide-react"
import { motion } from "framer-motion"
import confetti from "canvas-confetti"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "sonner"
import KakaoPay from "@/components/payment/KakaoPay"
import KGInicis from "@/components/payment/KGInicis"

// 구역 옵션 타입 정의
interface SeatOption {
  id: string;
  label: string;
  price: number;
  available: boolean;
}

// 티켓 요청 데이터 타입 정의 (구해요 전용)
interface TicketRequestData {
  id: number;
  title: string;
  requester: string;
  date: string;
  time: string;
  venue: string;
  maxPrice: number;
  image: string;
  status: string;
  description?: string;
  requestedBy: {
    id?: string;
    name: string;
    rating: number;
    reviewCount: number;
    profileImage: string;
    verificationRate?: number;
    responseRate?: number;
    totalRequests?: number;
  };
  seatOptions: SeatOption[];
  urgency: "높음" | "보통" | "낮음";
  quantity: number;
}

export default function TicketRequestDetail() {
  const router = useRouter()
  const params = useParams()
  const { user, isLoading } = useAuth()
  const [mounted, setMounted] = useState(false)
  
  // URL에서 id 추출
  const id = params?.id as string
  
  // 데이터 상태
  const [ticketData, setTicketData] = useState<TicketRequestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 폼 상태
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [phoneNumber, setPhoneNumber] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("kakaopay")
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [paymentCancelled, setPaymentCancelled] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAuthor, setIsAuthor] = useState(false)

  // 컴포넌트 마운트 확인
  useEffect(() => {
    setMounted(true)
  }, [])

  // 사용자 ID 설정
  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id)
    }
  }, [user])

  // 데이터 로딩
  useEffect(() => {
    async function fetchRequestData() {
      if (!id) {
        setLoading(false)
        toast.error("유효하지 않은 요청 ID입니다.")
        return
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/posts/${id}`);
        
        if (!response.ok) {
          throw new Error('티켓 요청을 불러오는데 실패했습니다');
        }
        
        const data = await response.json();
        console.log("불러온 티켓 요청 데이터:", data);
        
        if (!data || !data.post) {
          throw new Error('데이터 형식이 올바르지 않습니다');
        }
        
        const postData = data.post;
        
        // TICKET_REQUEST 카테고리가 아닌 경우 일반 취켓팅 페이지로 리다이렉트
        if (postData.category !== 'TICKET_REQUEST') {
          router.push(`/ticket-cancellation/${id}`);
          return;
        }
        
        // 콘텐츠 파싱
        let contentObj = null;
        try {
          if (typeof postData.content === 'string') {
            contentObj = JSON.parse(postData.content);
          } else {
            contentObj = postData.content;
          }
        } catch (e) {
          console.error('콘텐츠 파싱 실패:', e);
          contentObj = { description: postData.content };
        }
        
        // 구역 정보 파싱
        let seatOptions: SeatOption[] = [];
        if (contentObj.sections && Array.isArray(contentObj.sections)) {
          seatOptions = contentObj.sections.map((section, index) => ({
            id: section.id || index.toString(),
            label: section.label || section.name || `구역 ${index + 1}`,
            price: parseInt(section.price) || 0,
            available: section.available !== false
          })).filter(section => section.price > 0);
        }

        // 기본 구역 생성 (구역 정보가 없는 경우)
        if (seatOptions.length === 0) {
          seatOptions = [
            { id: '1', label: '요청 구역', price: postData.ticketPrice || 0, available: true }
          ];
        }

        setTicketData({
          id: postData.id,
          title: postData.title || '티켓 요청',
          requester: postData.author?.name || '요청자 정보 없음',
          date: contentObj?.date || postData.eventDate || '날짜 정보 없음',
          time: contentObj?.time || '시간 정보 없음',
          venue: contentObj?.venue || postData.eventVenue || '장소 정보 없음',
          maxPrice: postData.ticketPrice || 0,
          image: postData.image || '/placeholder-image.png',
          status: 'REQUESTING',
          description: contentObj?.description || postData.content || '상세 설명이 없습니다.',
          requestedBy: {
            id: postData.author?.id,
            name: postData.author?.name || '요청자 정보 없음',
            rating: postData.author?.rating || 0,
            reviewCount: 0,
            profileImage: postData.author?.profileImage || '',
            verificationRate: 95,
            responseRate: 98,
            totalRequests: 0
          },
          seatOptions: seatOptions,
          urgency: "보통",
          quantity: contentObj?.quantity || 1
        });
        
        setError(null);
      } catch (error) {
        console.error('티켓 요청 조회 에러:', error);
        setError(error instanceof Error ? error.message : '티켓 요청을 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    }
    
    fetchRequestData();
  }, [id, router]);

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-6">
            <Link href="/ticket-request" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span>취켓팅 구해요 목록으로 돌아가기</span>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
                <p className="ml-4 text-gray-600">티켓 요청 정보를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-6">
            <Link href="/ticket-request" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span>취켓팅 구해요 목록으로 돌아가기</span>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 데이터 없음
  if (!ticketData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="container mx-auto px-4 py-6">
            <Link href="/ticket-request" className="flex items-center text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5 mr-2" />
              <span>취켓팅 구해요 목록으로 돌아가기</span>
            </Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-md overflow-hidden p-6">
              <div className="text-center py-12 text-gray-500">
                티켓 요청 정보를 찾을 수 없습니다.
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/ticket-request" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>취켓팅 구해요 목록으로 돌아가기</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="md:flex">
              <div className="md:w-1/2">
                <div className="relative h-64 md:h-full">
                  <Image
                    src={ticketData.image || "/placeholder.svg"}
                    alt={ticketData.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-4 right-4">
                    <div 
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-[#ec4899] text-white hover:bg-[#db2777] backdrop-blur-sm"
                      style={{ 
                        backgroundColor: '#ec4899',
                        border: '1px solid #ec4899',
                        color: 'white'
                      }}
                    >
                      구해요
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 md:w-1/2">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">{ticketData.title}</h1>
                    <p className="text-gray-600 mb-4">요청자: {ticketData.requester}</p>
                  </div>
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-orange-500 text-white backdrop-blur-sm">
                    긴급도: {ticketData.urgency}
                  </div>
                </div>

                <div className="space-y-3 text-sm text-gray-500 mb-4">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{ticketData.date}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{ticketData.time}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{ticketData.venue}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-sm text-gray-500">희망 최대 가격</span>
                  <div>
                    <span className="font-medium text-pink-600 text-xl">{ticketData.maxPrice.toLocaleString()}원</span>
                    <span className="text-gray-400 text-sm ml-2">최대</span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4">{ticketData.description}</p>

                {/* 요청자 정보 섹션 */}
                <div className="mt-6 bg-pink-50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold mb-3">요청자 정보</h3>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                      <Image
                        src={ticketData.requestedBy.profileImage || "/placeholder.svg"}
                        alt={ticketData.requestedBy.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-500">요청자:</p>
                        <span className="font-medium text-pink-600">{ticketData.requestedBy.name}</span>
                        <div className="flex items-center text-yellow-500">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="ml-1 font-medium">{ticketData.requestedBy.rating}</span>
                          <span className="ml-1 text-gray-500 text-sm">({ticketData.requestedBy.reviewCount})</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">
                        총 요청 {ticketData.requestedBy.totalRequests}건 | 응답률 {ticketData.requestedBy.responseRate}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">이 티켓 요청에 응답하기</h2>
              
              {/* 서비스 안내 */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-blue-700 font-medium">티켓 요청 응답 서비스 안내</p>
                    <p className="text-sm text-blue-600 mb-2">
                      해당 구매자가 원하는 티켓을 대신 예매해드리는 서비스입니다.
                    </p>
                    <p className="text-sm text-blue-600 mb-2">
                      이지티켓은 판매자와 구매자가 직접 거래하는 C2C 중개 플랫폼입니다. 
                      운영자는 티켓 예매에 개입하지 않으며, ID/PW 등 개인정보를 요구하거나 수집하지 않습니다.
                      결제는 에스크로 방식으로 안전하게 보호됩니다.
                    </p>
                    <p className="text-sm text-blue-600">
                      계약 체결 후 3일 이내로 티켓 예매를 완료해야 하며, 실패 시 전액 환불 처리됩니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center py-12 text-gray-500">
                구해요 전용 응답 폼 구현 중입니다...
                <br />
                <Button className="mt-4 bg-pink-500 hover:bg-pink-600 text-white">
                  응답하기
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 