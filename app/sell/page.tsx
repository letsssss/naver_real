"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import supabase from "@/lib/supabase"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

// 이용약관 내용
const termsOfService = `🎟️ [이용약관] - 이지티켓
최종 수정일: 2025년 5월 5일

===================================================

제1조 (목적)
이 약관은 "이지티켓"(이하 "회사"라 함)가 운영하는 웹사이트 및 서비스를 이용함에 있어 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.


제2조 (정의)
"회사"란 공연 티켓 거래 중개 서비스를 제공하는 "이지티켓" 플랫폼을 의미합니다.

"이용자"란 회사의 웹사이트에 접속하여 이 약관에 동의하고, 회사가 제공하는 서비스를 이용하는 회원 또는 비회원을 말합니다.

"판매자" 및 "구매자"는 플랫폼을 통해 공연 티켓을 양도하거나 양수하려는 자를 의미합니다.

"예매대행"이란 이용자가 특정 공연에 대한 티켓 예매를 제3자에게 위임하는 기능을 의미합니다.


제3조 (약관의 효력 및 변경)
본 약관은 회사가 웹사이트에 게시하거나, 기타의 방법으로 이용자에게 고지함으로써 효력을 발생합니다.

회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여 현행 약관과 함께 공지합니다.


제4조 (서비스의 제공 및 변경)
회사는 아래와 같은 서비스를 제공합니다:
• 티켓 취소표 알림 서비스
• 예매 대행 요청/수락 중개
• 티켓 양도 거래 게시판 및 연결
• 에스크로 결제 시스템 제공

회사는 운영상 또는 기술상 필요에 따라 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다.


제5조 (서비스의 성격과 면책)
회사는 통신판매중개업자로서, 공연 티켓의 거래 당사자가 아니며, 예매 또는 거래에 직접 관여하지 않습니다.

티켓의 진위 여부, 유효성, 관람 가능 여부, 환불 불가 사유 등은 판매자 및 구매자 간의 책임입니다.

회사는 이용자 간 분쟁, 매크로 또는 자동화 프로그램 사용에 따른 문제, 공연장 입장 거부, 법적 분쟁 발생에 대해 일체의 책임을 지지 않습니다.


제6조 (매크로·자동화 도구 사용 금지)
이용자는 회사가 제공하는 서비스 이용 시 매크로, 봇, 스크립트 등 자동화 도구를 사용해서는 안 됩니다.

위반 시 회사는 서비스 이용 제한, 회원 자격 박탈 등의 조치를 할 수 있으며, 법적 책임은 사용자 본인에게 있습니다.

회사는 매크로 사용 여부를 탐지할 의무가 없으며, 매크로 사용으로 인한 피해에 대해 책임을 지지 않습니다.


제7조 (회원의 의무)
이용자는 관계 법령, 약관, 이용안내 등 회사가 정한 사항을 준수하여야 합니다.

이용자는 다음 행위를 하여서는 안 됩니다:
• 타인의 명의 도용
• 공연 티켓의 허위/중복 등록
• 서비스 내 외부에서의 무단 거래 유도
• 정가보다 높은 가격의 지속적 재판매 행위(암표상 행위)
• 시스템 해킹, 크롤링, 무단 정보수집 등 비정상 접근 행위


제8조 (에스크로 및 거래 보호)
회사는 안전한 거래를 위하여 에스크로 결제 시스템을 운영할 수 있습니다.

구매자는 티켓을 수령한 후 이상이 없을 경우 거래 확정을 해야 하며, 이 절차 후 판매자에게 대금이 지급됩니다.

회사는 결제 대금을 일정 기간 보관할 수 있으며, 분쟁 발생 시 중립적 입장에서 처리합니다.


제9조 (지적재산권)
플랫폼의 디자인, 서비스 구성, 콘텐츠 등에 대한 저작권은 회사에 있으며, 무단 도용 시 법적 조치가 취해질 수 있습니다.


제10조 (관할 및 준거법)
이 약관은 대한민국 법령에 따릅니다.

서비스 이용과 관련된 분쟁 발생 시 회사 소재지를 관할하는 법원을 전속 관할로 합니다.

===================================================

📌 본인은 상기 약관을 숙지하였으며, 서비스 이용에 동의합니다.`

// 콘서트 데이터 타입 정의
interface Concert {
  id: number
  title: string
  date: string
  venue: string
}

// 커스텀 공연 정보 타입 정의
interface CustomConcert {
  title: string
  date: string
  venue: string
}

// 섹션 타입 정의
interface Section {
  name: string
  price: string
}

// 에러 타입 정의
interface FormErrors {
  concert?: string
  concertTitle?: string
  concertDate?: string
  concertVenue?: string
  description?: string
  [key: string]: string | undefined
}

// 임시 공연 데이터 (실제로는 API에서 가져와야 합니다)
const concertData: Concert[] = [
  { id: 1, title: "세븐틴 콘서트", date: "2024-03-20", venue: "잠실종합운동장 주경기장" },
  { id: 2, title: "방탄소년단 월드투어", date: "2024-04-15", venue: "부산 아시아드 주경기장" },
  { id: 3, title: "아이유 콘서트", date: "2024-05-01", venue: "올림픽공원 체조경기장" },
  { id: 4, title: "블랙핑크 인 유어 에어리어", date: "2024-06-10", venue: "고척스카이돔" },
]

export default function SellPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [concertTitle, setConcertTitle] = useState("")
  // 날짜의 초기값을 오늘 날짜로 설정
  const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD 형식
  const [concertDates, setConcertDates] = useState<Array<{ date: string }>>([{ date: today }])
  const [concertVenue, setConcertVenue] = useState("")
  const [concertTime, setConcertTime] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [seatInfo, setSeatInfo] = useState("")
  const [price, setPrice] = useState("")
  const [ticketDescription, setTicketDescription] = useState("")
  const [isConsecutiveSeats, setIsConsecutiveSeats] = useState(false)
  const [sections, setSections] = useState<Array<{ id: number; name: string; price: string }>>([
    { id: 1, name: "", price: "" }
  ])
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const [selectedSeats, setSelectedSeats] = useState<number[]>([])
  const [isTermsAgreed, setIsTermsAgreed] = useState(false)
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login?callbackUrl=/sell")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) return null

  const addSection = () => {
    setSections([...sections, { id: sections.length + 1, name: "", price: "" }])
  }

  const removeSection = (index: number) => {
    const newSections = [...sections]
    newSections.splice(index, 1)
    setSections(newSections)
  }

  const updateSectionName = (index: number, name: string) => {
    const newSections = [...sections]
    newSections[index].name = name
    setSections(newSections)
  }

  const updateSectionPrice = (index: number, price: string) => {
    // 모든 숫자가 아닌 문자 제거
    const numericValue = price.replace(/[^\d]/g, '')
    
    // 천단위 구분 적용
    const formattedValue = numericValue === '' ? '' : Number(numericValue).toLocaleString()
    
    const newSections = [...sections]
    newSections[index].price = formattedValue
    setSections(newSections)
    
    // 가격이 1000원 미만인지 확인
    const priceValue = Number(numericValue)
    if (numericValue !== '' && priceValue < 1000) {
      setFormErrors(prev => ({
        ...prev,
        [`section_${index}_price`]: '가격은 최소 1000원 이상이어야 합니다'
      }))
    } else {
      // 오류가 있었다면 제거
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[`section_${index}_price`]
        return newErrors
      })
    }
  }

  // 날짜 관련 함수 추가
  const addDate = () => {
    setConcertDates([...concertDates, { date: today }])
  }

  const removeDate = (index: number) => {
    const newDates = [...concertDates]
    newDates.splice(index, 1)
    setConcertDates(newDates)
  }

  const updateDate = (index: number, date: string) => {
    const newDates = [...concertDates]
    newDates[index].date = date
    setConcertDates(newDates)
  }

  const toggleSeatSelection = (seatId: number) => {
    setSelectedSeats((prev) => (prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!concertTitle) {
      errors.concertTitle = "공연 제목을 입력해주세요"
    }

    concertDates.forEach((dateObj, index) => {
      if (!dateObj.date) {
        errors[`date_${index}`] = "공연 날짜를 입력해주세요"
      }
    })

    if (!ticketDescription) {
      errors.description = "티켓 상세설명을 입력해주세요"
    }

    sections.forEach((section, index) => {
      if (!section.name) {
        errors[`section_${index}_name`] = "구역명을 입력해주세요"
      }
      if (!section.price) {
        errors[`section_${index}_price`] = "가격을 입력해주세요"
      } else {
        // 가격이 1000원 미만인지 확인
        const priceValue = Number(section.price.replace(/[^\d]/g, ''))
        if (priceValue < 1000) {
          errors[`section_${index}_price`] = "가격은 최소 1000원 이상이어야 합니다"
        }
      }
    })

    // 이용약관 동의 여부 확인
    if (!isTermsAgreed) {
      errors.terms = "이용약관에 동의해주세요"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateForm()) {
      // 폼이 유효하지 않으면 오류 메시지를 표시하고 제출하지 않음
      if (!concertTitle) {
        toast({
          title: "Error",
          description: "공연 제목을 입력해주세요",
          variant: "destructive",
        })
      } else if (concertDates.some(dateObj => !dateObj.date)) {
        toast({
          title: "Error",
          description: "모든 공연 날짜를 입력해주세요",
          variant: "destructive",
        })
      } else if (!ticketDescription) {
        toast({
          title: "Error",
          description: "티켓 상세설명을 입력해주세요",
          variant: "destructive",
        })
      } else if (sections.some((section) => !section.name || !section.price)) {
        toast({
          title: "Error",
          description: "모든 구역의 이름과 가격을 입력해주세요",
          variant: "destructive",
        })
      } else if (sections.some((section) => Number(section.price.replace(/[^\d]/g, '')) < 1000)) {
        toast({
          title: "Error",
          description: "모든 구역의 가격은 최소 1,000원 이상이어야 합니다",
          variant: "destructive",
        })
      } else if (!isTermsAgreed) {
        toast({
          title: "Error",
          description: "이용약관에 동의해주세요",
          variant: "destructive",
        })
      }
      return
    }

    try {
      // 첫 번째 날짜를 주요 날짜로 사용
      const primaryDate = concertDates[0]?.date || ""
      
      // 모든 날짜를 텍스트로 포맷팅
      const formattedDates = concertDates.map(d => d.date).join(', ')
      
      // 모든 섹션을 텍스트로 포맷팅
      const formattedSections = sections.map(s => `${s.name}: ${s.price}원`).join('\n')
      
      // 판매 데이터 준비
      const saleData = {
        title: concertTitle,
        content: JSON.stringify({
          description: ticketDescription,
          date: formattedDates,
          venue: concertVenue || "미정",
          time: concertTime || "미정",
          price: Number(sections[0].price.replace(/[^0-9]/g, '')),
          sections: sections.map(section => ({
            id: section.id.toString(),
            label: section.name,
            price: Number(section.price.replace(/[^0-9]/g, '')),
            available: true
          }))
        }),
        category: "TICKET_CANCELLATION",
        type: "TICKET_SALE",
        concertDate: primaryDate,
        location: concertVenue || concertTitle,
        price: Number(sections[0].price.replace(/[^0-9]/g, '')),
        ticketPrice: Number(sections[0].price.replace(/[^0-9]/g, '')),
      }

      console.log("제출할 판매 데이터:", saleData)

      // ✅ Supabase 세션에서 직접 토큰 가져오기
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        console.error('세션에서 토큰을 찾을 수 없습니다.')
        throw new Error('로그인이 필요합니다.')
      }

      console.log('Supabase 세션 토큰 존재 여부:', !!token)

      // 서버에 판매 데이터 저장 (API 호출)
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(saleData),
      })

      const result = await response.json()
      console.log("서버 응답:", result)
      
      if (!response.ok) {
        // 서버에서 반환된 구체적인 오류 메시지 확인
        console.error("서버 응답 상태:", response.status, response.statusText)
        console.error("서버 응답 전체:", result)
        
        // 오류 메시지 구성
        let errorMessage = '판매 등록에 실패했습니다.'
        let errorDetails = ''
        
        if (result) {
          // 응답 객체에서 오류 정보 추출
          if (result.error) {
            errorMessage = result.error
          }
          
          // 오류 세부 정보가 있는 경우
          if (result.details) {
            if (typeof result.details === 'string') {
              errorDetails = result.details
            } else {
              errorDetails = JSON.stringify(result.details, null, 2)
            }
            console.error("오류 세부 정보:", result.details)
          }
          
          // 코드 정보가 있는 경우
          if (result.code) {
            errorDetails += `\n오류 코드: ${result.code}`
          }
          
          // 여러 유효성 검사 오류가 있는 경우
          if (result.errors && Array.isArray(result.errors)) {
            errorMessage = "유효성 검사 오류가 발생했습니다:"
            errorDetails = result.errors.map((err: any) => 
              `- ${err.path || '필드'}: ${err.message || '알 수 없는 오류'}`
            ).join('\n')
          }
        }
        
        // 모달 또는 알림으로 상세 오류 표시
        toast({
          title: "오류 발생",
          description: (
            <div className="space-y-2">
              <p>{errorMessage}</p>
              {errorDetails && (
                <details className="text-sm bg-red-50 p-2 rounded-md border border-red-200">
                  <summary className="cursor-pointer font-medium">상세 오류 정보</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">{errorDetails}</pre>
                </details>
              )}
            </div>
          ),
          variant: "destructive",
          duration: 10000, // 10초 동안 표시
        })
        
        throw new Error(errorMessage)
      }
      
      // 성공 메시지 표시
      toast({
        title: "성공",
        description: "티켓 판매가 성공적으로 등록되었습니다.",
      })

      // 마이페이지로 리다이렉트
      router.push("/mypage")
    } catch (error) {
      console.error("판매 등록 오류:", error)
      console.error("오류 스택:", error instanceof Error ? error.stack : '스택 정보 없음')
      
      // 이미 토스트가 표시되지 않은 경우에만 기본 오류 메시지 표시
      if (!(error instanceof Error && error.message !== '판매 등록에 실패했습니다.')) {
        toast({
          title: "오류 발생",
          description: error instanceof Error ? error.message : "판매 등록 중 오류가 발생했습니다.",
          variant: "destructive",
          duration: 5000,
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>홈으로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">티켓 판매하기</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  티켓 사진 <span className="text-gray-500">(선택)</span>
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>티켓 사진 업로드</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" />
                      </label>
                      <p className="pl-1">또는 드래그 앤 드롭</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  공연 제목 <span className="text-red-500">(필수)</span>
                </label>
                <Input
                  type="text"
                  placeholder="공연 제목을 입력하세요"
                  value={concertTitle}
                  onChange={(e) => setConcertTitle(e.target.value)}
                  className={formErrors.concertTitle ? "border-red-500" : ""}
                  required
                />
                {formErrors.concertTitle && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.concertTitle}</p>
                )}
              </div>

              <div className="space-y-2">
                {concertDates.map((dateObj, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center">
                        <label className="text-sm font-medium text-gray-700">{index === 0 ? "공연 날짜" : `추가 날짜 ${index}`}</label>
                        {formErrors[`date_${index}`] && <span className="text-xs text-red-500 ml-2">{formErrors[`date_${index}`]}</span>}
                      </div>
                      <Input
                        type="date"
                        value={dateObj.date}
                        onChange={(e) => updateDate(index, e.target.value)}
                        className={formErrors[`date_${index}`] ? "border-red-500" : ""}
                      />
                    </div>
                    {concertDates.length > 1 && (
                      <Button type="button" variant="ghost" className="mt-6" onClick={() => removeDate(index)}>
                        삭제
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addDate}>
                  + 날짜 추가
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  공연 장소 <span className="text-gray-500">(선택)</span>
                </label>
                <Input
                  placeholder="공연 장소를 입력하세요"
                  value={concertVenue}
                  onChange={(e) => setConcertVenue(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  공연 시간 <span className="text-gray-500">(선택)</span>
                </label>
                <Input
                  placeholder="예: 19:00"
                  value={concertTime}
                  onChange={(e) => setConcertTime(e.target.value)}
                />
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    구역별 가격 설정 <span className="text-red-500">(필수)</span>
                  </h3>
                  <Button type="button" variant="outline" onClick={addSection} className="text-xs">
                    구역 추가 +
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {sections.map((section, index) => (
                    <div key={index} className="border rounded-lg p-4 text-center">
                      <div className="flex-1 mb-2">
                        <Input
                          type="text"
                          placeholder="구역명 (예: R석, S석)"
                          value={section.name}
                          onChange={(e) => updateSectionName(index, e.target.value)}
                          className={formErrors[`section_${index}_name`] ? "border-red-500" : ""}
                          required
                        />
                        {formErrors[`section_${index}_name`] && (
                          <p className="mt-1 text-xs text-red-500">{formErrors[`section_${index}_name`]}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Input
                          type="text"
                          placeholder="가격 (최소 1,000원)"
                          value={section.price}
                          onChange={(e) => updateSectionPrice(index, e.target.value)}
                          className={formErrors[`section_${index}_price`] ? "border-red-500" : ""}
                          required
                        />
                        <span className="text-gray-500 whitespace-nowrap">원</span>
                        {formErrors[`section_${index}_price`] && (
                          <p className="mt-1 text-xs text-red-500">{formErrors[`section_${index}_price`]}</p>
                        )}
                      </div>
                      <div className="flex justify-end items-center">
                        {sections.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeSection(index)}
                            className="h-8 w-8 text-red-500"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  티켓 상세설명 <span className="text-red-500">(필수)</span>
                </label>
                <Textarea
                  placeholder="티켓에 대한 상세한 설명을 입력해주세요 (최소 10글자 이상)"
                  value={ticketDescription}
                  onChange={(e) => setTicketDescription(e.target.value)}
                  className={`min-h-[100px] ${formErrors.description ? "border-red-500" : ""}`}
                  required
                />
                {formErrors.description && <p className="mt-1 text-sm text-red-500">{formErrors.description}</p>}
                <p className="mt-1 text-xs text-gray-500">※ 티켓 상세설명은 최소 10글자 이상 입력해주세요. 상세한 정보를 제공할수록 구매자의 관심을 끌 수 있습니다.</p>
              </div>

              {/* 이용약관 동의 섹션 */}
              <div className="border-t pt-6">
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="terms" 
                    checked={isTermsAgreed}
                    onCheckedChange={(checked) => setIsTermsAgreed(checked as boolean)}
                    className={formErrors.terms ? "border-red-500" : ""}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <div className="flex items-center gap-1">
                      <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <span className="text-red-500">*</span> 이용약관 동의
                      </label>
                      <Dialog open={isTermsDialogOpen} onOpenChange={setIsTermsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" className="text-xs p-0 h-auto text-blue-600 underline">
                            (전문보기)
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-center mb-4">이용약관</DialogTitle>
                            <Button 
                              className="absolute right-4 top-4 rounded-full p-2" 
                              variant="ghost"
                              onClick={() => setIsTermsDialogOpen(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </DialogHeader>
                          <div className="text-sm whitespace-pre-line bg-gray-50 p-6 rounded-lg border border-gray-100">
                            {termsOfService}
                          </div>
                          <div className="mt-4 flex justify-center">
                            <Button onClick={() => {
                              setIsTermsAgreed(true);
                              setIsTermsDialogOpen(false);
                            }}
                            className="bg-[#0061FF] hover:bg-[#0052D6] text-white px-6">
                              동의하고 닫기
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {formErrors.terms && <p className="text-xs text-red-500">{formErrors.terms}</p>}
                    <p className="text-sm text-gray-500">
                      판매 등록을 위해서는 이용약관에 동의해야 합니다.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#0061FF] hover:bg-[#0052D6] text-white transition-colors">
                판매 등록하기
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

