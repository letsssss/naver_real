"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, User, ShoppingBag, Tag } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { FaTrash } from "react-icons/fa"
import ProfileSection from "@/components/ProfileSection"
import AccountBalance from "@/components/AccountBalance"
import WithdrawSection from "@/components/WithdrawSection"
import PurchasesSection from "@/components/PurchasesSection"
import SalesSection from "@/components/SalesSection"
import { Loader } from "@/components/ui/loader"

// types 가져오기
import { Sale, Notification, TransactionStatus, Purchase } from "@/types/mypage"

// 서비스 가져오기
import { 
  fetchOngoingSales, 
  fetchOngoingPurchases, 
  fetchNotifications,
  markNotificationAsRead,
  deletePost
} from "@/services/mypage-service"

export default function MyPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const [ongoingSales, setOngoingSales] = useState<Sale[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [ongoingPurchases, setOngoingPurchases] = useState<Purchase[]>([])
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showOnlyActive, setShowOnlyActive] = useState(false)
  const [originalSales, setOriginalSales] = useState<Sale[]>([])

  // 트랜잭션 상태 카운트
  const [purchaseStatus, setPurchaseStatus] = useState<TransactionStatus>({
    취켓팅진행중: 0,
    판매중인상품: 0,
    취켓팅완료: 0,
    거래완료: 0,
    거래취소: 0,
  })

  const [saleStatus, setSaleStatus] = useState<TransactionStatus>({
    취켓팅진행중: 0,
    판매중인상품: 0,
    취켓팅완료: 0,
    거래완료: 0,
    거래취소: 0,
  })

  // 마운트 확인
  useEffect(() => {
    setMounted(true)
  }, [])

  // 로그인 상태 확인
  useEffect(() => {
    if (mounted && !isLoading && !user) {
      toast.error("로그인이 필요한 페이지입니다")
      router.push("/login?callbackUrl=/mypage")
    }
  }, [user, isLoading, router, mounted])

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      // 알림은 페이지 로드 시 항상 가져옴 (알림 카운트 표시를 위해)
      fetchNotifications(user, setNotifications, setIsLoadingNotifications);
      
      // 페이지 로드 시 구매/판매 현황 데이터 가져오기
      fetchOngoingPurchases(user, setPurchaseStatus, setOngoingPurchases, setIsLoadingPurchases);
      fetchOngoingSales(user, setSaleStatus, setOngoingSales, setOriginalSales, setIsLoadingSales);
    }
  }, [user]);

  // user와 activeTab이 변경될 때 데이터 가져오기
  useEffect(() => {
    if (user) {
      if (activeTab === 'ongoing-sales') {
        fetchOngoingSales(user, setSaleStatus, setOngoingSales, setOriginalSales, setIsLoadingSales);
      } else if (activeTab === 'ongoing-purchases') {
        fetchOngoingPurchases(user, setPurchaseStatus, setOngoingPurchases, setIsLoadingPurchases);
      }
    }
  }, [user, activeTab]);

  // 읽지 않은 알림 카운트
  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Supabase 토큰 디버깅을 위한 useEffect 추가
  useEffect(() => {
    // 브라우저 환경인지 확인
    if (typeof window === 'undefined') return;
    
    // Supabase 관련 키 찾기
    const keys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
    console.log("🔑 Supabase 관련 키:", keys);

    if (keys.length > 0) {
      const tokenKey = keys[0];
      const session = localStorage.getItem(tokenKey);

      if (session) {
        try {
          // 먼저 JWT 토큰 형식인지 확인 (eyJ로 시작하는지)
          if (session.startsWith('eyJ')) {
            console.log("✅ JWT 토큰으로 인식됨, 직접 사용");
            
            // JWT 토큰 분해 시도
            const parts = session.split('.');
            if (parts.length === 3) {
              try {
                // 페이로드 부분만 디코딩
                const payload = JSON.parse(atob(parts[1]));
                console.log("✅ 토큰 페이로드:", payload);
                console.log("✅ 사용자 역할:", payload.role);
                console.log("✅ 만료 시간:", new Date(payload.exp * 1000).toLocaleString());
              } catch (e) {
                console.error("❌ 토큰 페이로드 파싱 실패:", e);
              }
            }
          } else {
            // JSON 형식으로 시도
            try {
              const parsed = JSON.parse(session);
              console.log("📦 Supabase 세션 정보:", parsed);
              
              if (parsed.access_token) {
                console.log("✅ access_token:", parsed.access_token.substring(0, 20) + "...");
                
                // JWT 토큰 분해 시도
                const parts = parsed.access_token.split('.');
                if (parts.length === 3) {
                  try {
                    // 페이로드 부분만 디코딩
                    const payload = JSON.parse(atob(parts[1]));
                    console.log("✅ 토큰 페이로드:", payload);
                    console.log("✅ 사용자 역할:", payload.role);
                    console.log("✅ 만료 시간:", new Date(payload.exp * 1000).toLocaleString());
                  } catch (e) {
                    console.error("❌ 토큰 페이로드 파싱 실패:", e);
                  }
                }
              }
            } catch (e) {
              console.error("❌ 세션 정보 파싱 실패:", e);
            }
          }
        } catch (e) {
          console.error("❌ 세션 처리 중 오류:", e);
        }
      } else {
        console.warn("❌ 토큰 키는 있지만 세션 정보가 없음:", tokenKey);
      }
    } else {
      console.warn("❌ Supabase 세션이 localStorage에 없음");
      
      // 추가 확인: 다른 형태의 키로 저장되어 있는지 확인
      const allStorageKeys = Object.keys(localStorage);
      console.log("📋 모든 localStorage 키:", allStorageKeys);
      
      const tokenValues = allStorageKeys
        .filter(key => localStorage.getItem(key) && localStorage.getItem(key)!.includes('eyJ'))
        .map(key => ({ key, value: localStorage.getItem(key) }));
      
      if (tokenValues.length > 0) {
        console.log("🔍 JWT 형식 토큰 발견:", tokenValues.map(t => t.key));
      }
    }
  }, []);

  // 필터링 함수 추가
  const filterActiveSales = () => {
    setShowOnlyActive(!showOnlyActive);
    
    if (!showOnlyActive) {
      // 활성화 상품만 필터링 - 상태가 명시적으로 "판매중"이고 isActive가 true인 경우만 표시
      const filtered = originalSales.filter(item => 
        item.isActive && item.status === "판매중"
      );
      console.log("필터링된 판매중 상품:", filtered.length);
      setOngoingSales(filtered);
    } else {
      // 필터 해제
      setOngoingSales(originalSales);
      console.log("전체 상품으로 복원:", originalSales.length);
    }
  };

  // 알림 읽음 상태 업데이트하는 핸들러
  const handleMarkAsRead = (notificationId: number) => {
    if (user) {
      markNotificationAsRead(user, notificationId, setNotifications);
    }
  };

  // 게시물 삭제 핸들러
  const handleDeletePost = async (postId: number) => {
    if (user) {
      await deletePost(user, postId, router, setOngoingSales, setOriginalSales, setSaleStatus);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("로그아웃 되었습니다");
    router.push("/");
  }

  // 판매자 통계 정보 업데이트 함수 추가
  useEffect(() => {
    // 로딩 중이 아니고, 판매 상태가 로드된 경우에만 실행
    if (!isLoadingSales && user && saleStatus && saleStatus.거래완료 !== undefined) {
      // 판매자 통계 정보 업데이트
      if (user.id) {
        updateSellerStats(String(user.id), saleStatus.거래완료);
      }
    }
  }, [isLoadingSales, user, saleStatus]);

  // 판매자 통계 정보 업데이트 함수
  const updateSellerStats = async (sellerId: string, completedSales: number) => {
    try {
      if (!sellerId) return;
      
      // 토큰 가져오기
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn("토큰이 없어 판매자 통계 업데이트를 건너뜁니다");
        return;
      }
      
      console.log("판매자 통계 업데이트 시도:", { sellerId, completedSales });
      
      // seller-stats API 호출
      const response = await fetch('/api/seller-stats/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sellerId,
          successfulSales: completedSales,
          // 응답률은 실제 계산 로직이 필요
          responseRate: 98 // 하드코딩된 값 (실제 구현시 계산 필요)
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("판매자 통계 업데이트 성공:", result);
      } else {
        console.error("판매자 통계 업데이트 실패:", response.status);
        const errorText = await response.text();
        console.error("오류 응답:", errorText);
      }
    } catch (error) {
      console.error("판매자 통계 업데이트 오류:", error);
    }
  };

  // 로딩 중이거나 마운트되지 않은 경우 로딩 표시
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="flex items-center justify-center h-screen">
          <p>로딩 중...</p>
        </div>
      </div>
    )
  }

  // 로그인되지 않은 경우
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="flex items-center justify-center h-screen">
          <p>로그인이 필요합니다. 로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>홈으로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">마이페이지</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <AccountBalance balance={120000} onWithdraw={() => setIsWithdrawModalOpen(true)} />

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-l-4 border-[#FF2F6E]">
              <h2 className="text-lg font-medium text-gray-700 mb-1">포인트</h2>
              <p className="text-2xl font-bold text-[#FF2F6E]">3,500P</p>
              <div className="flex justify-between items-center mt-4">
                <Link
                  href="/mypage/point-history"
                  className="text-sm text-gray-500 hover:text-[#FF2F6E] transition-colors"
                >
                  적립/사용 내역
                </Link>
                <p className="text-xs text-gray-500">30일 후 소멸 예정: 500P</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-l-4 border-[#FFD600]">
              <h2 className="text-lg font-medium text-gray-700 mb-1">쿠폰</h2>
              <p className="text-2xl font-bold text-[#FFD600]">2장</p>
              <div className="flex justify-between items-center mt-4">
                <Link href="/mypage/coupons" className="text-sm text-gray-500 hover:text-[#FFD600] transition-colors">
                  쿠폰함 보기
                </Link>
                <Button variant="outline" className="text-gray-700 border-gray-300">
                  쿠폰 등록
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
            <h2 className="text-lg font-semibold mb-4">
              최근 구매 현황 <span className="text-sm font-normal text-gray-500">(최근 1개월 기준)</span>
            </h2>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">취켓팅 진행중</span>
                <span className="text-2xl font-bold">{purchaseStatus.취켓팅진행중}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">취켓팅 완료</span>
                <span className="text-2xl font-bold">{purchaseStatus.취켓팅완료}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">거래완료</span>
                <Link href="/mypage/confirmed-purchases">
                  <span className="text-2xl font-bold text-[#02C39A] hover:underline cursor-pointer transition-colors">
                    {purchaseStatus.거래완료}
                  </span>
                </Link>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">거래취소</span>
                <span className="text-2xl font-bold">{purchaseStatus.거래취소}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
            <h2 className="text-lg font-semibold mb-4">
              최근 판매 현황 <span className="text-sm font-normal text-gray-500">(최근 1개월 기준)</span>
            </h2>
            <div className="grid grid-cols-5 gap-4 text-center relative">
              <div className="absolute left-[calc(20%-1px)] top-1 bottom-1 w-[2px] bg-gray-400"></div>
              
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">판매중인 상품</span>
                <span className="text-2xl font-bold">{saleStatus.판매중인상품}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">취켓팅 진행중</span>
                <span className="text-2xl font-bold">{saleStatus.취켓팅진행중}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">취켓팅 완료</span>
                <span className="text-2xl font-bold">{saleStatus.취켓팅완료}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">거래완료</span>
                <span className="text-2xl font-bold">{saleStatus.거래완료}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-600 mb-2">거래취소</span>
                <span className="text-2xl font-bold">{saleStatus.거래취소}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b">
            <button
              className={`flex-1 py-4 px-6 text-center ${activeTab === "profile" ? "bg-gray-100 font-semibold" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              <User className="inline-block mr-2" />
              프로필
            </button>
            <button
              className={`flex-1 py-4 px-6 text-center ${activeTab === "ongoing-purchases" ? "bg-gray-100 font-semibold" : ""}`}
              onClick={() => setActiveTab("ongoing-purchases")}
            >
              <ShoppingBag className="inline-block mr-2" />
              진행중인 구매
            </button>
            <button
              className={`flex-1 py-4 px-6 text-center ${activeTab === "ongoing-sales" ? "bg-gray-100 font-semibold" : ""}`}
              onClick={() => setActiveTab("ongoing-sales")}
            >
              <Tag className="inline-block mr-2" />
              판매중인 상품
            </button>
          </div>

          <div className="p-6">
            {/* 이 부분은 현재 로그인한 사용자만 볼 수 있는 개인 정보입니다 */}
            {activeTab === "profile" && (
              <ProfileSection user={user} />
            )}

            {activeTab === "ongoing-purchases" && (
              <PurchasesSection 
                purchases={ongoingPurchases} 
                isLoading={isLoadingPurchases} 
                router={router} 
                setPurchaseStatus={setPurchaseStatus}
                setOngoingPurchases={setOngoingPurchases}
              />
            )}

            {activeTab === "ongoing-sales" && (
              <SalesSection 
                sales={ongoingSales} 
                isLoading={isLoadingSales}
                saleStatus={saleStatus}
                showOnlyActive={showOnlyActive}
                setShowOnlyActive={setShowOnlyActive}
                router={router}
                deletePost={handleDeletePost}
              />
            )}
          </div>
        </div>
      </main>
      <WithdrawSection 
        balance={120000} 
        isOpen={isWithdrawModalOpen} 
        onOpenChange={setIsWithdrawModalOpen} 
      />
    </div>
  )
}

