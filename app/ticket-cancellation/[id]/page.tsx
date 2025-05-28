"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
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
import { createBrowserClient } from "@/lib/supabase"
import SuccessRateBadge from "@/components/SuccessRateBadge"
import ReportHistory from "@/components/ReportHistory"

// 티켓 시트 타입 정의
interface SeatOption {
  id: string;
  label: string;
  price: number;
  available: boolean;
}

// 티켓 데이터 타입 정의
interface TicketData {
  id: number;
  title: string;
  artist: string;
  date: string;
  time: string;
  venue: string;
  price: number;
  originalPrice: number;
  image: string;
  status: string;
  successRate: number;
  description?: string;
  seller: {
    id?: string;
    name: string;
    rating: number;
    reviewCount: number;
    profileImage: string;
    successfulSales?: number;
    responseRate?: number;
    totalCancellationTicketings?: number;
  };
  seatOptions: SeatOption[];
  reports?: {
    hasReports: boolean;
    count: number;
    severity: "low" | "medium" | "high";
    lastReportDate: string;
    reasons: string[];
    status: "검토중" | "해결됨" | "무효처리";
  };
}

export default function TicketCancellationDetail() {
  const params = useParams();
  const id = params?.id as string;
  
  const router = useRouter()
  const { user } = useAuth()
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [accountId, setAccountId] = useState("")
  const [accountPassword, setAccountPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isAuthor, setIsAuthor] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [manualAuthorId, setManualAuthorId] = useState<string | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("kakaopay")
  const [paymentCancelled, setPaymentCancelled] = useState(false)
  const [termsAgreed, setTermsAgreed] = useState(false)

  // 마운트 상태 관리 및 사용자 ID 저장
  useEffect(() => {
    setMounted(true)
    if (user?.id) {
      setCurrentUserId(user.id.toString())
      console.log("사용자 ID 저장됨:", user.id.toString())
    }
  }, [user])

  // 디버깅용 로그 추가
  useEffect(() => {
    if (mounted) {
      console.log("현재 로그인한 사용자 ID:", currentUserId || user?.id);
      console.log("수동 설정된 작성자 ID:", manualAuthorId);
      console.log("isAuthor 상태:", isAuthor);
    }
  }, [mounted, user, currentUserId, manualAuthorId, isAuthor]);

  // 작성자 여부 확인 로직
  useEffect(() => {
    if (!mounted || !currentUserId) return;
    
    // 이미 작성자로 확인된 경우 중복 체크 방지
    if (isAuthor) return;
    
    const checkAuthor = async () => {
      try {
        // 게시글 정보 조회를 통해 작성자 확인 (더 효율적인 방식)
        const response = await fetch(`/api/posts/${id}`);
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.post) {
            const post = data.post;
            
            // 다양한 방식으로 저장된 작성자 ID 추출
            const authorId = post.author?.id || post.authorId || post.user_id || post.userId;
            
            if (authorId) {
              // 문자열로 변환하여 비교 (타입 통일)
              const isCreator = String(authorId) === String(currentUserId);
              
              console.log(`게시글 작성자 ID: ${authorId}, 현재 사용자 ID: ${currentUserId}, 일치여부: ${isCreator}`);
              
              if (isCreator !== isAuthor) {
                setIsAuthor(isCreator);
                if (isCreator) {
                  toast.warning("자신의 게시물은 구매할 수 없습니다.");
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("작성자 확인 중 오류:", error);
      }
    };
    
    // 사용자 ID와 게시글 ID가 있으면 작성자 확인 수행
    if (currentUserId && id) {
      checkAuthor();
    }
  }, [currentUserId, id, mounted, isAuthor]);

  // 게시글 데이터 불러오기
  useEffect(() => {
    async function fetchPostData() {
      if (!id) {
        setLoading(false)
        toast.error("유효하지 않은 게시글 ID입니다.")
        return
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/posts/${id}`);
        
        if (!response.ok) {
          throw new Error('게시글을 불러오는데 실패했습니다');
        }
        
        const data = await response.json();
        console.log("불러온 게시글 데이터:", data);
        
        if (!data || !data.post) {
          throw new Error('데이터 형식이 올바르지 않습니다');
        }
        
        const postData = data.post;
        // 게시물 데이터 전체 구조 확인
        console.log("게시물 상세 데이터:", JSON.stringify(postData, null, 2));
        
        // author 객체 디버깅 출력 추가
        console.log("작성자(author) 객체 확인:", JSON.stringify(postData.author, null, 2));
        if (postData.author) {
          console.log("author.id:", postData.author.id);
          console.log("author.name:", postData.author.name);
          console.log("author.profileImage:", postData.author.profileImage);
        } else {
          console.log("작성자(author) 객체가 없습니다.");
        }
        
        // 작성자 식별 로직 개선
        // 1. 게시물 ID를 작성자 ID로 사용 (기존 방식)
        const postId = postData.id.toString();
        setManualAuthorId(postId);
        console.log("게시물 ID를 작성자 ID로 사용:", postId);
        
        // 2. 작성자 판별을 위한 다양한 필드 확인
        console.log("사용자 ID 확인:", currentUserId || user?.id?.toString());
        console.log("게시글 작성자 ID 확인:", postData.author?.id?.toString());
        
        // 추가 확인을 위한 데이터 로깅
        console.log("게시글 user_id 확인:", postData.user_id);
        console.log("게시글 userId 확인:", postData.userId);
        console.log("게시글 authorId 확인:", postData.authorId);
        
        // 직접 작성자 ID와 현재 로그인한 사용자 ID 비교
        const authorId = postData.author?.id || postData.authorId || postData.user_id || postData.userId;
        const userId = currentUserId || user?.id;
        
        if (authorId && userId) {
          // 문자열로 변환하여 비교 (타입 통일)
          const isPostCreator = String(authorId) === String(userId);
          console.log("작성자 ID와 사용자 ID 직접 비교:", { authorId, userId, isPostCreator });
          
          if (isPostCreator) {
            setIsAuthor(true);
            console.log("사용자는 이 게시글의 작성자입니다!");
            toast.warning("자신의 게시물은 구매할 수 없습니다.");
          }
        }
        
        // 날짜 및 가격 정보 파싱
        let eventDate = '', eventTime = '', eventVenue = '', seatOptions = [];
        let eventPrice = postData.price || 0;
        
        try {
          // 게시글 내용에서 정보 파싱 (JSON 구조)
          let contentObj;
          
          if (typeof postData.content === 'string') {
            try {
              contentObj = JSON.parse(postData.content);
              console.log("JSON 파싱 완료:", contentObj);
            } catch (e) {
              console.error('JSON 파싱 실패, 텍스트로 처리합니다:', e);
              // 텍스트 모드 폴백 처리
              const textContent = postData.content;
              contentObj = { description: textContent };
            }
          } else {
            contentObj = postData.content;
          }
          
          // 구조화된 데이터 추출
          eventDate = contentObj.date || '';
          eventTime = contentObj.time || '';
          eventVenue = contentObj.venue || '';
          eventPrice = contentObj.price || eventPrice;
          
          // 중요: 구역 정보 처리
          if (contentObj.sections && Array.isArray(contentObj.sections)) {
            console.log("구역 정보 발견:", contentObj.sections);
            seatOptions = contentObj.sections;
          } else {
            console.log("구역 정보가 없거나 유효하지 않습니다");
            // 텍스트 기반 섹션 추출 시도 (이전 형식 지원)
            const sectionPattern = /([^:]+): (\d+)원/g;
            let match;
            const extractedSections = [];
            
            while ((match = sectionPattern.exec(postData.content)) !== null) {
              extractedSections.push({
                id: extractedSections.length.toString(),
                label: match[1].trim(),
                price: parseInt(match[2].replace(/,/g, '')),
                available: true
              });
            }
            
            if (extractedSections.length > 0) {
              seatOptions = extractedSections;
            }
          }
        } catch (e) {
          console.error('게시글 내용 파싱 오류:', e);
          // 파싱 실패시 원본 데이터 사용
        }
        
        console.log("최종 좌석 정보:", seatOptions);
        
        // 좌석 정보가 없을 경우 기본값 설정
        if (!seatOptions || seatOptions.length === 0) {
          seatOptions = [
            { id: 'A', label: 'A구역', price: eventPrice, available: true },
            { id: 'B', label: 'B구역', price: eventPrice, available: true },
            { id: 'C', label: 'C구역', price: eventPrice, available: true }
          ];
        }
        
        // 판매자 ID 정보 확인 및 로깅
        console.log("판매자 정보 상세:", {
          originalAuthorId: postData.author?.id,
          authorIdType: typeof postData.author?.id,
          fallbackId: postData.authorId || postData.userId
        });

        // 판매자 ID 처리 개선 - 다양한 소스에서 ID 확보
        // sellerId가 undefined 또는 null인 경우, 하드코딩된 기본값 사용
        const sellerId = (postData.author?.id && String(postData.author.id).trim() !== '') 
          ? postData.author.id 
          : (postData.authorId || postData.userId || '1d187f43-ac94-47c0-b40b-df1dabda820d'); // 기본 판매자 ID 사용
        
        console.log("최종 선택된 판매자 ID:", sellerId);
        
        // 판매자 상세 정보를 API에서 가져오기
        let sellerDetail = {
          successfulSales: 0,
          responseRate: 0
        };
        
        // Supabase 클라이언트 생성 (모든 요청에서 공통으로 사용)
        const supabase = createBrowserClient();
        
        try {
          if (sellerId) {
            // 새로운 seller-stats API 사용
            const sellerResponse = await fetch(`/api/seller-stats?sellerId=${sellerId}`);
            if (sellerResponse.ok) {
              const sellerData = await sellerResponse.json();
              console.log("판매자 통계 정보:", sellerData);
              
              if (sellerData.seller) {
                sellerDetail = {
                  successfulSales: sellerData.seller.successfulSales || 0,
                  responseRate: sellerData.seller.responseRate || 0
                };
              }
            } else {
              console.error("판매자 통계 정보를 불러오는데 실패했습니다:", sellerId);
            }
            
            // cancellation_ticketing_stats_view에서 데이터 가져오기
            const { data: cancelStats } = await supabase
              .from("cancellation_ticketing_stats_view")
              .select("confirmed_count, cancelled_count")
              .eq("seller_id", sellerId)
              .maybeSingle();
              
            // 총 건수 계산
            const confirmed = cancelStats?.confirmed_count || 0;
            const cancelled = cancelStats?.cancelled_count || 0;
            const total = confirmed + cancelled;
            
            console.log("취켓팅 통계:", { confirmed, cancelled, total });
          }
        } catch (error) {
          console.error("판매자 통계 API 호출 오류:", error);
          // 에러가 발생해도 게시물 데이터는 계속 표시
        }
        
        // ✅ 1. Supabase에서 별점과 리뷰 수 가져오기
        const { data: avgRatingData, error: ratingError } = await supabase
          .from("seller_avg_rating")
          .select("avg_rating, review_count")
          .eq("seller_id", sellerId)
          .maybeSingle()

        const avgRating = avgRatingData?.avg_rating || 0
        const reviewCount = avgRatingData?.review_count || 0
        
        // 취켓팅 통계 기본값 (API에서 가져오지 못한 경우)
        let totalCancellationTicketings = 0;
        
        try {
          // cancellation_ticketing_stats_view에서 데이터 가져오기
          const { data: cancelStats } = await supabase
            .from("cancellation_ticketing_stats_view")
            .select("confirmed_count, cancelled_count")
            .eq("seller_id", sellerId)
            .maybeSingle();
            
          // 총 건수 계산
          const confirmed = cancelStats?.confirmed_count || 0;
          const cancelled = cancelStats?.cancelled_count || 0;
          totalCancellationTicketings = confirmed + cancelled;
          
          console.log("취켓팅 통계 (개별 호출):", { confirmed, cancelled, total: totalCancellationTicketings });
        } catch (error) {
          console.error("취켓팅 통계 조회 오류:", error);
          // 오류 발생 시 기본값 유지
        }
        
        // ✅ 2. 기존 setTicketData에 값 반영
        // 신고 정보 가져오기 (예시 데이터 - 실제로는 API에서 가져와야 함)
        let reportData = null;
        
        try {
          // 판매자 신고 이력 조회 (실제 API 호출로 대체 필요)
          // 예시: 특정 판매자 ID에 대해서만 신고 이력 표시
          if (sellerId === "1d187f43-ac94-47c0-b40b-df1dabda820d" || sellerId === "problem_seller_id") {
            reportData = {
              hasReports: true,
              count: 2,
              severity: "medium" as const,
              lastReportDate: "2024.05.15",
              reasons: ["가격 불일치", "응답 지연"],
              status: "검토중" as const
            };
          }
        } catch (error) {
          console.error("신고 정보 조회 오류:", error);
        }
        
        setTicketData({
          id: postData.id,
          title: postData.title || '티켓 제목',
          artist: postData.artist || '아티스트 정보',
          date: eventDate || '날짜 정보 없음',
          time: eventTime || '시간 정보 없음',
          venue: eventVenue || '장소 정보 없음',
          price: eventPrice,
          originalPrice: eventPrice,
          image: postData.image || '/placeholder-image.png',
          status: 'FOR_SALE',
          successRate: 80,
          seller: {
            id: sellerId,
            name: postData.author?.name || '판매자 정보 없음',
            rating: avgRating,
            reviewCount: reviewCount,
            profileImage: postData.author?.profileImage || '',
            successfulSales: sellerDetail.successfulSales,
            responseRate: sellerDetail.responseRate,
            totalCancellationTicketings: totalCancellationTicketings || 0
          },
          seatOptions: seatOptions,
          reports: reportData
        });
        
        setError(null);
      } catch (error) {
        console.error('게시글 조회 에러:', error);
        setError(error instanceof Error ? error.message : '게시글을 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    }
    
    fetchPostData();
  }, [id]);

  // Trigger confetti effect when success page is shown
  useEffect(() => {
    if (isSuccess) {
      console.log("성공 화면 표시 및 폭죽 효과 활성화");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      })
    }
  }, [isSuccess])

  const toggleSeatSelection = (seatId: string) => {
    setSelectedSeats((prev) => (prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!id) {
      toast.error("유효하지 않은 게시글 ID입니다.")
      return
    }

    if (!currentUserId) {
      toast.error("로그인이 필요한 서비스입니다.")
      router.push("/login")
      return
    }

    // 자신의 게시글인지 확인 - 추가 안전장치
    console.log("폼 제출 시 작성자 확인:", isAuthor);
    if (isAuthor) {
      toast.error("자신의 게시글은 구매할 수 없습니다.")
      return
    }
    
    if (selectedSeats.length === 0) {
      toast.error("좌석을 하나 이상 선택해주세요.")
      return
    }

    if (!phoneNumber) {
      toast.error("연락처를 입력해주세요.")
      return
    }

    if (!termsAgreed) {
      toast.error("이용약관에 동의해주세요.")
      return
    }

    // 선택한 좌석 정보 구성
    const selectedSeatLabels = selectedSeats
      .map((seatId) => {
        const seat = ticketData?.seatOptions.find((s) => s.id === seatId)
        return seat ? seat.label : ""
      })
      .filter(Boolean)
      .join(", ")

    // 카카오페이가 아닌 경우에만 API 호출 진행
    if (selectedPaymentMethod !== "kakaopay") {
      setIsSubmitting(true)
      purchaseTicket(selectedSeatLabels)
    }
  }

  // 카카오페이 결제 실패 핸들러 (완전히 재작성)
  const handlePaymentFail = (error: any) => {
    console.error("카카오페이 결제 중단:", error);
    
    // 취소 상태 변수 먼저 설정
    setIsSubmitting(false);
    setIsSuccess(false);
    
    // 사용자가 결제를 취소한 경우 명확히 표시
    if (error.code === 'PO_SDK_CLOSE_WINDOW' || error.code === 'USER_CANCEL' || error.isCancelled) {
      console.log("🛑 사용자가 결제를 취소했습니다. 코드:", error.code);
      toast.info("결제가 취소되었습니다. 신청 완료되지 않았습니다.");
      
      // 취소 상태 플래그 설정 - 이후 모든 결제 관련 처리를 차단하는데 사용
      setPaymentCancelled(true);
      
      // 취소 후 UI 초기화를 위한 지연 실행
      setTimeout(() => {
        // 취소 후 명시적 상태 리셋
        setIsSubmitting(false);
        setIsSuccess(false);
      }, 100);
      
      return; // 함수 실행 중단
    }
    
    // 실제 오류가 발생한 경우
    toast.error("결제에 실패했습니다. 다시 시도해주세요.");
  }

  // 카카오페이 결제 성공 핸들러 (개선)
  const handlePaymentSuccess = (paymentId: string) => {
    console.log("카카오페이 결제 성공:", paymentId);
    
    // 이미 취소된 경우 모든 후속 처리 중단
    if (paymentCancelled) {
      console.log("이전에 결제가 취소되었으므로 성공 처리를 진행하지 않습니다.");
      return;
    }
    
    // paymentId가 없거나 비어있으면 처리하지 않음
    if (!paymentId || paymentId.trim() === '') {
      console.error("유효하지 않은 결제 ID:", paymentId);
      toast.error("유효하지 않은 결제 정보입니다. 다시 시도해주세요.");
      setIsSubmitting(false);
      setIsSuccess(false);
      return;
    }
    
    // 좌석 라벨 정보 생성
    const seatLabels = selectedSeats
      .map((seatId) => {
        const seat = ticketData?.seatOptions.find((s) => s.id === seatId)
        return seat ? seat.label : ""
      })
      .filter(Boolean)
      .join(", ");
    
    // 취소되지 않았고 유효한 paymentId가 있을 때만 구매 처리 진행
    if (!paymentCancelled) {
      console.log("결제가 성공적으로 완료되어 구매 처리를 진행합니다.");
      purchaseTicket(paymentId, seatLabels);
    }
  }

  // 티켓 구매 API 호출 함수 (개선)
  const purchaseTicket = async (paymentId?: string, seatLabels?: string) => {
    // 이미 취소된 경우 API 호출 자체를 차단
    if (paymentCancelled) {
      console.log("⛔ 결제가 취소되어 API 호출을 진행하지 않습니다.");
      setIsSubmitting(false);
      setIsSuccess(false);
      return;
    }
    
    // 카카오페이 결제의 경우 paymentId 필수 확인
    if (selectedPaymentMethod === "kakaopay" && (!paymentId || paymentId.trim() === '')) {
      console.log("⚠️ 결제 ID가 없어 구매 처리를 중단합니다.");
      setIsSubmitting(false);
      setIsSuccess(false);
      return;
    }
    
    try {
      console.log("💵 구매 처리 시작:", { paymentId, selectedPaymentMethod });
      
      if (!id) {
        throw new Error("게시글 ID가 없습니다")
      }

      // 선택한 좌석 정보 구성 (여기서 필요한 경우 다시 계산)
      const selectedSeatLabels = seatLabels || selectedSeats
        .map((seatId) => {
          const seat = ticketData?.seatOptions.find((s) => s.id === seatId)
          return seat ? seat.label : ""
        })
        .filter(Boolean)
        .join(", ")

      // 개발 환경에서 인증을 위한 userId 쿼리 파라미터 추가
      const userId = currentUserId || user?.id;
      const apiUrl = process.env.NODE_ENV === 'development' && userId
        ? `/api/ticket-purchase?userId=${userId}`
        : '/api/ticket-purchase';

      // 인증 토큰을 가져오기 (로컬 스토리지에서)
      let token = null;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || 
                localStorage.getItem('sb-jdubrjczdyqqtsppojgu-auth-token');
      }

      // 헤더 설정 (인증 토큰 포함)
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // 토큰이 있으면 Authorization 헤더 추가
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log("인증 토큰 헤더 추가됨");
      } else {
        console.log("인증 토큰을 찾을 수 없음");
      }

      // 선택한 좌석 가격 계산
      const totalAmount = selectedSeats.reduce((sum, seatId) => {
        const seat = ticketData?.seatOptions.find(s => s.id === seatId);
        return sum + (seat?.price || 0);
      }, 0);

      // 마지막 안전장치: API 호출 직전에도 취소 상태 확인
      if (paymentCancelled) {
        console.log("⛔ 마지막 순간에 취소 상태가 감지되어 API 호출을 중단합니다.");
        setIsSubmitting(false);
        setIsSuccess(false);
        return;
      }

      // 티켓 구매 API 호출
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          postId: parseInt(id),
          quantity: selectedSeats.length,
          selectedSeats: selectedSeatLabels,
          phoneNumber: phoneNumber,
          paymentMethod: selectedPaymentMethod,
          paymentId: paymentId || undefined,
          amount: totalAmount
        }),
        credentials: 'include', // 쿠키 포함 (인증 정보)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("구매 요청 실패:", errorData);
        throw new Error(errorData.message || '구매 요청 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      console.log("✅ 구매 응답:", data);
      
      // API 응답이 성공적인 경우에만 success 상태 설정
      if (!paymentCancelled) {
        console.log("🎉 신청 완료 상태로 설정합니다!");
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/mypage?tab=purchases");
        }, 5000);
      } else {
        console.log("⚠️ API는 성공했지만 이미 취소되었으므로 성공 상태를 설정하지 않습니다.");
      }
    } catch (error) {
      console.error('구매 처리 오류:', error);
      toast.error(error instanceof Error ? error.message : '구매 요청 중 오류가 발생했습니다.');
      // 오류 발생 시 성공 상태를 false로 유지
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // 데이터가 없는 경우
  if (!ticketData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">게시글을 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-4">요청하신 게시글이 존재하지 않거나 삭제되었습니다.</p>
          <Link href="/ticket-cancellation">
            <Button>목록으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 성공 화면 조건부 렌더링 - 결제 취소 후에도 성공 화면이 표시되는 문제 해결
  if (isSuccess && !paymentCancelled) {
    console.log("✅ 신청 완료 화면 렌더링: 결제가 성공적으로 완료되었습니다.");
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            </motion.div>
            <h1 className="text-2xl font-bold mb-4">취켓팅 신청 완료!</h1>
            <p className="text-gray-600 mb-6">
              취소표 발생 시 {phoneNumber}로 알림을 보내드립니다.
              <br />
              취소표 발생 시 빠르게 예매를 진행해 드립니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 mb-2">신청 정보</p>
              <p className="font-semibold text-gray-800 mb-1">{ticketData.title}</p>
              <p className="text-gray-600 text-sm mb-2">
                {ticketData.date} {ticketData.time}
              </p>
              <p className="text-gray-600 text-sm">
                {selectedSeats
                  .map((seatId) => {
                    const seat = ticketData.seatOptions.find((s) => s.id === seatId)
                    return seat ? `${seat.label} - ${seat.price.toLocaleString()}원` : ""
                  })
                  .join(", ")}
              </p>
            </div>
            <div className="flex flex-col space-y-4">
              <Link href="/mypage">
                <Button className="w-full">마이페이지에서 확인하기</Button>
              </Link>
              <Link href="/ticket-cancellation">
                <Button variant="outline" className="w-full">
                  다른 공연 취켓팅 신청하기
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/ticket-cancellation" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>취켓팅 목록으로 돌아가기</span>
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
                    <SuccessRateBadge staticRate={ticketData.successRate} />
                  </div>
                </div>
              </div>
              <div className="p-6 md:w-1/2">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">{ticketData.title}</h1>
                    <p className="text-gray-600 mb-4">{ticketData.artist}</p>
                  </div>
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-black/50 text-white backdrop-blur-sm">
                    남은시간: 2일 13시간
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
                  <span className="font-medium text-black text-xl">{ticketData.price.toLocaleString()}원</span>
                  <span className="text-gray-400 text-sm line-through ml-2">
                    {ticketData.originalPrice.toLocaleString()}원
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4">{ticketData.description}</p>

                {/* 판매자 정보 섹션 추가 */}
                <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold mb-3">판매자 정보</h3>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                      <Image
                        src={ticketData.seller.profileImage || "/placeholder.svg"}
                        alt={ticketData.seller.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-500">판매자:</p>
                        {ticketData.seller.id ? (
                          <span className="font-medium text-blue-600">{ticketData.seller.name}</span>
                        ) : (
                          <span className="text-gray-500">{ticketData.seller.name}</span>
                        )}
                        <div className="flex items-center text-yellow-500">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="ml-1 font-medium">{ticketData.seller.rating}</span>
                          <span className="ml-1 text-gray-500 text-sm">({ticketData.seller.reviewCount})</span>
                        </div>
                      </div>
                      
                      {ticketData.seller.id ? (
                        <p className="text-sm text-gray-600 mt-1">
                          계약 성사 {ticketData.seller.totalCancellationTicketings}건 | 응답률 {ticketData.seller.responseRate || 98}%
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">
                          판매자 상세 정보를 확인할 수 없습니다
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {ticketData.seller.id ? (
                    <Link 
                      href={`/seller/${ticketData.seller.id}`} 
                      className="block text-center mt-3 py-2 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50 transition"
                    >
                      프로필 보기
                    </Link>
                  ) : (
                    <div className="block text-center mt-3 py-2 bg-gray-100 border border-gray-200 rounded text-sm text-gray-400 cursor-not-allowed">
                      프로필 없음
                    </div>
                  )}
                </div>

                {/* 신고 이력 섹션 - 신고가 있는 경우에만 표시 */}
                {ticketData.reports && (
                  <ReportHistory 
                    reports={ticketData.reports} 
                    className="mt-4" 
                  />
                )}
              </div>
            </div>

            <Separator />

            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">취켓팅 신청하기</h2>
              {/* 로그인 필요시 안내 */}
              {mounted && !currentUserId && (
                <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                    <div>
                      <p className="text-yellow-700 font-medium">로그인이 필요합니다</p>
                      <p className="text-sm text-yellow-600">취켓팅 서비스를 이용하시려면 먼저 로그인해주세요.</p>
                      <Link href="/login">
                        <Button className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white">로그인 하러가기</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 작성자인 경우 경고 메시지 (이 부분만 남기고 다른 중복 경고는 제거) */}
              {mounted && currentUserId && isAuthor && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <AlertTitle>자신의 게시물은 구매할 수 없습니다</AlertTitle>
                  <AlertDescription>
                    본인이 등록한 게시물은 구매 신청이 불가능합니다. 다른 게시물을 선택해주세요.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* 서비스 안내 - 모든 사용자에게 표시 */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                  <div>
                    <p className="text-blue-700 font-medium">취켓팅 서비스 안내</p>
                    <p className="text-sm text-blue-600 mb-2">
                      취소표를 대신 잡아드리는 서비스입니다.
                    </p>
                    <p className="text-sm text-blue-600 mb-2">
                      이지티켓은 판매자와 구매자가 직접 거래하는 C2C 중개 플랫폼입니다. 
                      운영자는 티켓 예매에 개입하지 않으며, ID/PW 등 개인정보를 요구하거나 수집하지 않습니다.
                      결제는 에스크로 방식으로 안전하게 보호됩니다.
                    </p>
                    <p className="text-sm text-blue-600">
                      입금 완료 후 1 영업일 이내로 예약 확정 됩니다. 예약 확정 이후, 3일 이내 티켓을 확보하지 못할경우 전액 환불 신청이 가능합니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 폼 표시 조건 수정 - 로그인한 사용자이고 작성자가 아닐 때만 */}
              {mounted && currentUserId && !isAuthor ? (
                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="seatSelection" className="block text-sm font-medium text-gray-700 mb-2">
                        좌석 선택
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3" id="seatSelection">
                        {ticketData.seatOptions.map((seat) => (
                          <div
                            key={seat.id}
                            className={`border rounded-md p-3 ${
                              selectedSeats.includes(seat.id)
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            } ${
                              isAuthor 
                                ? "opacity-50 cursor-not-allowed" 
                                : "cursor-pointer transition"
                            }`}
                            onClick={() => !isAuthor && toggleSeatSelection(seat.id)}
                          >
                            <p className="font-medium">{seat.label}</p>
                            <p className="text-sm text-gray-600">
                              {seat.price.toLocaleString()}원
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">결제 방법</label>
                      <div className="space-y-2">
                        {/* 카카오페이 옵션 */}
                        <div className={`p-3 border rounded-lg ${selectedPaymentMethod === "kakaopay" ? "bg-yellow-50 border-yellow-200" : "border-gray-200 hover:border-gray-300"}`}>
                          <div className="flex items-center">
                            <input
                              type="radio"
                              id="kakaopay"
                              name="paymentMethod"
                              value="kakaopay"
                              checked={selectedPaymentMethod === "kakaopay"}
                              onChange={() => setSelectedPaymentMethod("kakaopay")}
                              className="h-4 w-4 text-yellow-500 focus:ring-yellow-500 border-gray-300"
                            />
                            <label htmlFor="kakaopay" className="ml-2 block text-sm text-gray-700 font-medium">
                              카카오페이
                            </label>
                          </div>
                        </div>
                        
                        {/* 토스페이 옵션 */}
                        <div className={`p-3 border rounded-lg ${selectedPaymentMethod === "toss" ? "bg-blue-50 border-blue-200" : "border-gray-200 hover:border-gray-300"}`}>
                          <div className="flex items-center">
                            <input
                              type="radio"
                              id="toss"
                              name="paymentMethod"
                              value="toss"
                              checked={selectedPaymentMethod === "toss"}
                              onChange={() => setSelectedPaymentMethod("toss")}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <label htmlFor="toss" className="ml-2 block text-sm text-gray-700 font-medium">
                              토스페이
                            </label>
                          </div>
                        </div>
                        
                        {/* 신용카드 옵션 */}
                        <div className={`p-3 border rounded-lg ${selectedPaymentMethod === "card" ? "bg-green-50 border-green-200" : "border-gray-200 hover:border-gray-300"}`}>
                          <div className="flex items-center">
                            <input
                              type="radio"
                              id="card"
                              name="paymentMethod"
                              value="card"
                              checked={selectedPaymentMethod === "card"}
                              onChange={() => setSelectedPaymentMethod("card")}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                            />
                            <label htmlFor="card" className="ml-2 block text-sm text-gray-700 font-medium">
                              신용카드
                            </label>
                          </div>
                        </div>
                        
                        {/* 판매자 직접 결제 옵션 */}
                        <div className={`p-3 border rounded-lg ${selectedPaymentMethod === "direct" ? "bg-gray-50 border-gray-300" : "border-gray-200 hover:border-gray-300"}`}>
                          <div className="flex items-center">
                            <input
                              type="radio"
                              id="direct"
                              name="paymentMethod"
                              value="direct"
                              checked={selectedPaymentMethod === "direct"}
                              onChange={() => setSelectedPaymentMethod("direct")}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <label htmlFor="direct" className="ml-2 block text-sm text-gray-700 font-medium">
                              판매자에게 직접 결제
                            </label>
                          </div>
                          <p className="text-xs text-gray-500 ml-6 mt-1">
                            판매자와 채팅으로 결제 방법을 협의하실 수 있습니다.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        연락처
                      </label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="010-0000-0000"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">취소표 발생 시 알림을 받을 연락처를 입력해주세요.</p>
                    </div>
                  </div>

                  {selectedPaymentMethod === "kakaopay" ? (
                    <div className="mt-6">
                      {/* 선택한 좌석 가격 합계 계산 */}
                      {(() => {
                        const totalAmount = selectedSeats.reduce((sum, seatId) => {
                          const seat = ticketData?.seatOptions.find(s => s.id === seatId);
                          return sum + (seat?.price || 0);
                        }, 0);
                        
                        // 선택한 좌석 라벨 계산
                        const seatLabels = selectedSeats
                          .map((seatId) => {
                            const seat = ticketData?.seatOptions.find((s) => s.id === seatId)
                            return seat ? seat.label : ""
                          })
                          .filter(Boolean)
                          .join(", ");
                        
                        return (
                          <>
                            <div className="p-3 text-gray-700 mb-4">
                              <p className="text-sm">입금 완료 후 1 영업일 이내로 예약 확정 됩니다</p>
                              <p className="text-sm">예약 확정 이후, 3일 이내 티켓을 확보하지 못할경우 전액 환불 신청이 가능합니다.</p>
                            </div>
                            <div className="flex items-start space-x-2 mb-4">
                              <input
                                type="checkbox"
                                id="terms-kakao"
                                checked={termsAgreed}
                                onChange={(e) => setTermsAgreed(e.target.checked)}
                                className="mt-1"
                                required
                              />
                              <label htmlFor="terms-kakao" className="text-sm text-gray-700">
                                <span className="text-red-500 font-bold mr-1">[필수]</span>
                                상품 결제 후 변심에 의한 취소가 불가하며, 재판매가 가능함을 확인하고 동의합니다.
                              </label>
                            </div>
                            <KakaoPay 
                              amount={totalAmount}
                              orderName={`[취켓팅] ${ticketData.title} - ${ticketData.date}`}
                              customerName={user?.name || "고객"}
                              ticketInfo={`${ticketData.title} (${seatLabels})`}
                              phoneNumber={phoneNumber}
                              selectedSeats={selectedSeats}
                              userId={String(currentUserId || user?.id || "")}
                              postId={String(id)}
                              onSuccess={handlePaymentSuccess}
                              onFail={handlePaymentFail}
                              disabled={!termsAgreed}
                            />
                          </>
                        );
                      })()}
                    </div>
                  ) : selectedPaymentMethod === "card" ? (
                    <div className="mt-6">
                      {/* 선택한 좌석 가격 합계 계산 */}
                      {(() => {
                        const totalAmount = selectedSeats.reduce((sum, seatId) => {
                          const seat = ticketData?.seatOptions.find(s => s.id === seatId);
                          return sum + (seat?.price || 0);
                        }, 0);
                        
                        // 선택한 좌석 라벨 계산
                        const seatLabels = selectedSeats
                          .map((seatId) => {
                            const seat = ticketData?.seatOptions.find((s) => s.id === seatId)
                            return seat ? seat.label : ""
                          })
                          .filter(Boolean)
                          .join(", ");
                        
                        return (
                          <>
                            <div className="p-3 text-gray-700 mb-4">
                              <p className="text-sm">입금 완료 후 1 영업일 이내로 예약 확정 됩니다</p>
                              <p className="text-sm">예약 확정 이후, 3일 이내 티켓을 확보하지 못할경우 전액 환불 신청이 가능합니다.</p>
                            </div>
                            <div className="flex items-start space-x-2 mb-4">
                              <input
                                type="checkbox"
                                id="terms-card"
                                checked={termsAgreed}
                                onChange={(e) => setTermsAgreed(e.target.checked)}
                                className="mt-1"
                                required
                              />
                              <label htmlFor="terms-card" className="text-sm text-gray-700">
                                <span className="text-red-500 font-bold mr-1">[필수]</span>
                                상품 결제 후 변심에 의한 취소가 불가하며, 재판매가 가능함을 확인하고 동의합니다.
                              </label>
                            </div>
                            <KGInicis 
                              amount={totalAmount}
                              orderName={`[취켓팅] ${ticketData.title} - ${ticketData.date}`}
                              customerName={user?.name || "고객"}
                              customerEmail={user?.email || "guest@easyticket82.com"}
                              ticketInfo={`${ticketData.title} (${seatLabels})`}
                              phoneNumber={phoneNumber}
                              selectedSeats={selectedSeats}
                              userId={String(currentUserId || user?.id || "")}
                              postId={String(id)}
                              onSuccess={handlePaymentSuccess}
                              onFail={handlePaymentFail}
                              disabled={!termsAgreed}
                            />
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <>
                      <div className="p-3 text-gray-700 mt-6 mb-4">
                        <p className="text-sm">입금 완료 후 1 영업일 이내로 예약 확정 됩니다</p>
                        <p className="text-sm">예약 확정 이후, 3일 이내 티켓을 확보하지 못할경우 전액 환불 신청이 가능합니다.</p>
                      </div>
                      <div className="flex items-start space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="terms-general"
                          checked={termsAgreed}
                          onChange={(e) => setTermsAgreed(e.target.checked)}
                          className="mt-1"
                          required
                        />
                        <label htmlFor="terms-general" className="text-sm text-gray-700">
                          <span className="text-red-500 font-bold mr-1">[필수]</span>
                          상품 결제 후 변심에 의한 취소가 불가하며, 재판매가 가능함을 확인하고 동의합니다.
                        </label>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-[#0061FF] hover:bg-[#0052D6]" 
                        disabled={isSubmitting || !termsAgreed}
                      >
                        {isSubmitting ? "처리 중..." : "취켓팅 신청하기"}
                      </Button>
                    </>
                  )}
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <div className="mt-8">
        <Button 
          variant="outline"
          onClick={() => router.push("/ticket-cancellation")}
        >
          목록으로 돌아가기
        </Button>
      </div>
    </div>
  )
}