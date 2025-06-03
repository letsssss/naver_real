"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X, Calendar, MapPin, Trash2 } from 'lucide-react'
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

// 구역 정보 타입 정의
interface SeatSection {
  id: string
  name: string
  price: string
}

// 콘서트 데이터 타입 정의
interface Concert {
  id: number
  title: string
  date: string
  venue: string
}

// 에러 타입 정의
interface FormErrors {
  concertTitle?: string
  concertDate?: string
  concertVenue?: string
  description?: string
  maxPrice?: string
  quantity?: string
  terms?: string
  sections?: string
  [key: string]: string | undefined
}

// 임시 공연 데이터
const concertData: Concert[] = [
  { id: 1, title: "세븐틴 콘서트", date: "2024-03-20", venue: "잠실종합운동장 주경기장" },
  { id: 2, title: "방탄소년단 월드투어", date: "2024-04-15", venue: "부산 아시아드 주경기장" },
  { id: 3, title: "아이유 콘서트", date: "2024-05-01", venue: "올림픽공원 체조경기장" },
  { id: 4, title: "블랙핑크 인 유어 에어리어", date: "2024-06-10", venue: "고척스카이돔" },
]

export default function TicketRequestPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  const [concertTitle, setConcertTitle] = useState("")
  const today = new Date().toISOString().split("T")[0]
  const [concertDate, setConcertDate] = useState(today)
  const [concertVenue, setConcertVenue] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [description, setDescription] = useState("")
  const [preferredSeats, setPreferredSeats] = useState("")
  const [urgency, setUrgency] = useState("보통")
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isTermsAgreed, setIsTermsAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sections, setSections] = useState<SeatSection[]>([])
  const supabase = getSupabaseClient()

  // 구역 추가 함수
  const addSection = () => {
    const newSection: SeatSection = {
      id: Date.now().toString(),
      name: '',
      price: ''
    }
    setSections([...sections, newSection])
  }

  // 구역 삭제 함수
  const removeSection = (id: string) => {
    setSections(sections.filter(section => section.id !== id))
  }

  // 구역 정보 업데이트 함수
  const updateSection = (id: string, field: keyof SeatSection, value: string) => {
    setSections(sections.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    ))
  }

  // 천단위 구분 함수
  const formatPrice = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');
    // 천단위 콤마 추가
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 가격 입력 처리 (구역별)
  const handleSectionPriceChange = (id: string, value: string) => {
    const numbersOnly = value.replace(/[^\d]/g, '');
    updateSection(id, 'price', numbersOnly);
  };

  // 인증 확인
  useEffect(() => {
    if (!isLoading && !user) {
      alert("로그인이 필요합니다.")
      router.push("/login")
    }
  }, [user, isLoading, router])

  // 기본 구역 추가 (페이지 로드 시)
  useEffect(() => {
    if (sections.length === 0) {
      addSection()
    }
  }, [])

  // 폼 검증
  const validateForm = () => {
    const errors: FormErrors = {}

    if (!concertTitle.trim()) {
      errors.concertTitle = "공연명을 입력해주세요"
    }

    if (!concertDate) {
      errors.concertDate = "공연 날짜를 선택해주세요"
    }

    if (!quantity || parseInt(quantity) < 1) {
      errors.quantity = "수량을 올바르게 입력해주세요"
    }

    // 구역별 가격 검증
    if (sections.length === 0) {
      errors.sections = "최소 하나의 구역을 추가해주세요"
    } else {
      const hasInvalidSection = sections.some(section => 
        !section.name.trim() || !section.price || parseInt(section.price) < 1000
      )
      if (hasInvalidSection) {
        errors.sections = "모든 구역의 이름과 가격을 올바르게 입력해주세요 (최소 1,000원)"
      }
    }

    if (!description.trim() || description.length < 10) {
      errors.description = "상세 요청사항을 10자 이상 입력해주세요"
    }

    if (!isTermsAgreed) {
      errors.terms = "이용약관에 동의해주세요"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const requestData = {
        concertTitle,
        concertDate,
        concertVenue,
        quantity: parseInt(quantity),
        sections: sections,
        maxPrice: Math.max(...sections.map(s => parseInt(s.price) || 0)),
        description,
        userId: user?.id
      }

      console.log("취켓팅 구해요 요청:", requestData)
      
      // ✅ Supabase 세션에서 직접 토큰 가져오기 (sell 페이지와 동일한 방식)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        console.error('세션에서 토큰을 찾을 수 없습니다.')
        throw new Error('로그인이 필요합니다.')
      }

      console.log('Supabase 세션 토큰 존재 여부:', !!token)
      
      // 실제 API 호출 (Authorization 헤더 추가)
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`  // 👈 sell 페이지와 동일하게 추가
        },
        credentials: 'include', // 쿠키 포함하여 인증 정보 전달
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(result.message || "취켓팅 구해요 요청이 등록되었습니다!")
        router.push("/")
      } else {
        throw new Error(result.error || "요청 등록에 실패했습니다.")
      }
      
    } catch (error) {
      console.error("요청 등록 실패:", error)
      alert(error instanceof Error ? error.message : "요청 등록에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div>로딩 중...</div>
  }

  if (!user) {
    return <div>로그인이 필요합니다.</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="w-full bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => router.back()}
                className="p-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-[#0061FF]">취켓팅 구해요</h1>
            </div>
            <Link href="/" className="text-gray-700 hover:text-[#0061FF]">
              홈으로
            </Link>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">원하는 티켓을 요청하세요</h2>
              <p className="text-gray-600">구체적인 정보를 입력해주시면 더 빠르게 매칭해드릴 수 있어요!</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 공연 정보 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-[#0061FF]" />
                  공연 정보
                </h3>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    공연명 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={concertTitle}
                    onChange={(e) => setConcertTitle(e.target.value)}
                    placeholder="공연 제목을 입력하세요"
                    className={formErrors.concertTitle ? "border-red-500" : ""}
                  />
                  {formErrors.concertTitle && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.concertTitle}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      공연 날짜 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={concertDate}
                      onChange={(e) => setConcertDate(e.target.value)}
                      min={today}
                      className={formErrors.concertDate ? "border-red-500" : ""}
                    />
                    {formErrors.concertDate && (
                      <p className="text-red-500 text-sm mt-1">{formErrors.concertDate}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      수량 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      max="4"
                      placeholder="1"
                      className={formErrors.quantity ? "border-red-500" : ""}
                    />
                    {formErrors.quantity && (
                      <p className="text-red-500 text-sm mt-1">{formErrors.quantity}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    공연 장소
                  </label>
                  <Input
                    type="text"
                    value={concertVenue}
                    onChange={(e) => setConcertVenue(e.target.value)}
                    placeholder="예: 잠실종합운동장 주경기장"
                    className={formErrors.concertVenue ? "border-red-500" : ""}
                  />
                  {formErrors.concertVenue && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.concertVenue}</p>
                  )}
                </div>
              </div>

              {/* 희망 조건 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-[#0061FF]" />
                  희망 조건
                </h3>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      구역별 가격 설정 <span className="text-red-500">*</span>
                  </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addSection}
                      className="text-xs h-8 px-3"
                    >
                      구역 추가 +
                    </Button>
                  </div>
                  
                  {sections.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <p className="text-gray-500 mb-4">아직 구역이 없습니다.</p>
                      <Button
                        type="button"
                        onClick={addSection}
                        className="bg-pink-500 hover:bg-pink-600 text-white"
                        style={{ backgroundColor: '#ec4899' }}
                      >
                        첫 번째 구역 추가하기
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {sections.map((section, index) => (
                        <div key={section.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-600">구역 {index + 1}</span>
                            {sections.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSection(section.id)}
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Input
                              type="text"
                              value={section.name}
                              onChange={(e) => updateSection(section.id, 'name', e.target.value)}
                              placeholder="구역명 (예: R석, S석)"
                              className="text-sm"
                            />
                            
                            <div className="flex items-center gap-2">
                  <Input
                    type="text"
                                value={formatPrice(section.price)}
                                onChange={(e) => handleSectionPriceChange(section.id, e.target.value)}
                                placeholder="가격 (최소 1,000원)"
                                className="text-sm"
                              />
                              <span className="text-gray-500 whitespace-nowrap text-sm">원</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {formErrors.sections && (
                    <p className="text-red-500 text-sm mt-1">{formErrors.sections}</p>
                  )}
                </div>
              </div>

              {/* 상세 요청사항 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  상세 요청사항 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="구체적인 요청사항을 입력해주세요. 예를 들어 선호하는 좌석 위치, 특별한 요구사항 등을 적어주시면 더 정확한 매칭이 가능합니다."
                  rows={4}
                  className={formErrors.description ? "border-red-500" : ""}
                />
                <p className="text-gray-500 text-sm mt-1">최소 10자 이상 입력해주세요</p>
                {formErrors.description && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>
                )}
              </div>

              {/* 약관 동의 */}
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={isTermsAgreed}
                    onCheckedChange={(checked) => setIsTermsAgreed(checked as boolean)}
                  />
                  <label htmlFor="terms" className="text-sm">
                    <span className="text-red-500">*</span> 이용약관 및 개인정보처리방침에 동의합니다
                  </label>
                </div>
                {formErrors.terms && (
                  <p className="text-red-500 text-sm">{formErrors.terms}</p>
                )}
              </div>

              {/* 제출 버튼 */}
              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 text-lg font-medium"
                  style={{ backgroundColor: '#ec4899' }}
                >
                  {isSubmitting ? "요청 등록 중..." : "취켓팅 구해요 요청하기"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
} 