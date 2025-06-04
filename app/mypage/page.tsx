"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, User, ShoppingBag, Tag, X } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getSupabaseClient } from '@/lib/supabase'

import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { FaTrash } from "react-icons/fa"
import ProfileSection from "@/components/ProfileSection"
import AccountBalance from "@/components/AccountBalance"
import WithdrawSection from "@/components/WithdrawSection"
import PurchasesSection from "@/components/PurchasesSection"
import SalesSection from "@/components/SalesSection"
import MessageButton from "@/components/MessageButton"
import { Loader } from "@/components/ui/loader"
import { Star } from "lucide-react"

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

// Supabase 세션 토큰 가져오기
const getSupabaseSession = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    // 1. Supabase 세션 키 찾기 (정확한 패턴 매칭)
    const supabaseKey = Object.keys(localStorage).find(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );
    
    if (supabaseKey) {
      const sessionStr = localStorage.getItem(supabaseKey);
      
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          
          // 세션 유효성 검사
          if (session && session.access_token && session.user) {
            return session;
          }
        } catch (parseError) {
          // 세션 파싱 오류 무시
        }
      }
    } else {
      // 2. 대체 키 확인
      const alternativeKeys = ['supabase.auth.token', 'auth-token'];
      for (const key of alternativeKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.access_token && parsed.user) {
              return parsed;
            }
          } catch (e) {
            // 대체 키 파싱 실패 무시
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

export default function MyPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const { user, loading, signOut } = useAuth()
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

  // 요청중인 취켓팅 관련 상태 추가
  const [requestedTickets, setRequestedTickets] = useState<any[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)

  // 제안 목록 모달 관련 상태 추가
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [proposals, setProposals] = useState<any[]>([])
  const [isLoadingProposals, setIsLoadingProposals] = useState(false)
  
  // NEW 배지 관련 상태 추가
  const [lastCheckedTimes, setLastCheckedTimes] = useState<Record<number, string>>({})

  // 마운트 확인
  useEffect(() => {
    setMounted(true)
    
    // localStorage에서 마지막 확인 시간 불러오기
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proposal-last-checked');
      if (saved) {
        try {
          setLastCheckedTimes(JSON.parse(saved));
        } catch (e) {
          // 마지막 확인 시간 파싱 오류 무시
        }
      }
    }
  }, [])

  // 로그인 상태 확인
  useEffect(() => {
    if (mounted && !loading && !user) {
      toast.error("로그인이 필요한 페이지입니다");
      router.push("/login?callbackUrl=/mypage");
    }
  }, [user, loading, router, mounted]);

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      // 알림은 페이지 로드 시 항상 가져옴 (알림 카운트 표시를 위해)
      fetchNotifications(user, setNotifications, setIsLoadingNotifications);
      
      // 페이지 로드 시 구매/판매 현황 데이터 가져오기
      fetchOngoingPurchases(user, setPurchaseStatus, setOngoingPurchases, setIsLoadingPurchases);
      fetchOngoingSales(user, setSaleStatus, setOngoingSales, setOriginalSales, setIsLoadingSales);
      
      // 요청중인 취켓팅 데이터 가져오기
      fetchRequestedTickets();
    }
  }, [user]);

  // NEW 배지 표시 여부 결정 함수
  const hasNewProposals = (ticketId: number, proposalCount: number) => {
    const lastChecked = lastCheckedTimes[ticketId];
    if (!lastChecked) {
      // 처음 보는 티켓이고 제안이 있으면 NEW 표시
      return proposalCount > 0;
    }
    
    // 마지막 확인 이후 새로운 제안이 있는지 체크
    // 임시로 localStorage에 저장된 이전 제안 수와 비교
    const savedCounts = localStorage.getItem('proposal-counts');
    if (savedCounts) {
      try {
        const counts = JSON.parse(savedCounts);
        const previousCount = counts[ticketId] || 0;
        
        // 제안 수가 증가했으면 NEW 표시
        if (proposalCount > previousCount) {
          return true;
        }
      } catch (e) {
        // 제안 수 파싱 오류 무시
      }
    }
    
    return false;
  };
  
  // 제안 수 localStorage에 저장하는 함수
  const updateProposalCounts = (tickets: any[]) => {
    if (typeof window !== 'undefined') {
      const counts: Record<number, number> = {};
      tickets.forEach(ticket => {
        counts[ticket.id] = ticket.proposalCount;
      });
      localStorage.setItem('proposal-counts', JSON.stringify(counts));
    }
  };

  // 요청중인 취켓팅 데이터 가져오는 함수
  const fetchRequestedTickets = async () => {
    if (!user) return;
    
    try {
      setIsLoadingRequests(true);
      
      const supabaseClient = await getSupabaseClient();
      
      // 먼저 posts 데이터를 가져옴
      const { data: postsData, error: postsError } = await supabaseClient
        .from('posts')
        .select(`
          id,
          title,
          content,
          status,
          created_at,
          category,
          ticket_price,
          event_date,
          event_venue
        `)
        .eq('author_id', user.id)
        .eq('category', 'TICKET_REQUEST');

      if (postsError) {
        throw postsError;
      }

      if (!postsData) {
        setRequestedTickets([]);
        return;
      }

      // 각 post에 대한 proposals 데이터를 별도로 가져옴
      const postsWithProposalsPromises = postsData.map(async (post) => {
        const { data: proposalsData, error: proposalsError } = await supabaseClient
          .from('proposals')
          .select(`
            id,
            status,
            price,
            message,
            created_at,
            user_id,
            users:user_id (
              id,
              name,
              email,
              profile_image,
              rating,
              successful_sales,
              response_rate
            )
          `)
          .eq('post_id', post.id);

        if (proposalsError) {
          return {
            ...post,
            proposals: [],
            proposalCount: 0
          };
        }

        return {
          ...post,
          proposals: proposalsData || [],
          proposalCount: proposalsData?.length || 0,
          acceptedProposal: proposalsData?.find(p => p.status === 'ACCEPTED')
        };
      });

      const postsWithProposals = await Promise.all(postsWithProposalsPromises);

      setRequestedTickets(postsWithProposals);
      
      // 제안 수 저장
      updateProposalCounts(postsWithProposals);
      
    } catch (error) {
      toast.error('요청 목록을 불러오는데 실패했습니다');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // 제안 목록 가져오기
  const fetchProposals = async (ticketId: number) => {
    try {
      setIsLoadingProposals(true);
      
      const supabaseClient = await getSupabaseClient();
      const { data, error } = await supabaseClient
        .from('proposals')
        .select(`
          id,
          status,
          price,
          message,
          created_at,
          user_id,
          users:user_id (
            id,
            name,
            email,
            profile_image,
            rating,
            successful_sales,
            response_rate
          )
        `)
        .eq('post_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setProposals(data || []);
      
    } catch (error) {
      toast.error('제안 목록을 불러오는데 실패했습니다');
    } finally {
      setIsLoadingProposals(false);
    }
  };

  // 제안 수락하기
  const handleAcceptProposal = async (proposalId: number) => {
    try {
      const supabaseClient = await getSupabaseClient();
      const { error } = await supabaseClient
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', proposalId);

      if (error) {
        throw error;
      }
      
      toast.success('제안이 수락되었습니다!');
      
      // 모달 닫기 및 데이터 새로고침
      setIsProposalModalOpen(false);
      fetchRequestedTickets();
      
    } catch (error) {
      toast.error('제안 수락에 실패했습니다');
    }
  };

  // 제안 목록 모달 열기
  const openProposalModal = (ticketId: number) => {
    setSelectedTicketId(ticketId);
    setIsProposalModalOpen(true);
    fetchProposals(ticketId);
    
    // 마지막 확인 시간 업데이트
    const now = new Date().toISOString();
    const updatedTimes = { ...lastCheckedTimes, [ticketId]: now };
    setLastCheckedTimes(updatedTimes);
    
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('proposal-last-checked', JSON.stringify(updatedTimes));
    }
  };

  // user와 activeTab이 변경될 때 데이터 가져오기
  useEffect(() => {
    if (user) {
      if (activeTab === 'ongoing-sales') {
        fetchOngoingSales(user, setSaleStatus, setOngoingSales, setOriginalSales, setIsLoadingSales);
      } else if (activeTab === 'ongoing-purchases') {
        fetchOngoingPurchases(user, setPurchaseStatus, setOngoingPurchases, setIsLoadingPurchases);
      } else if (activeTab === 'requested-tickets') {
        fetchRequestedTickets();
      }
    }
  }, [user, activeTab]);

  // 읽지 않은 알림 카운트
  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Supabase 토큰 디버깅을 위한 useEffect 수정
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const session = getSupabaseSession();
    if (session) {
      // JWT 토큰 분해 시도
      if (session.access_token) {
        try {
          const parts = session.access_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            // 토큰 정보 처리 (로그 없이)
          }
        } catch (e) {
          // 토큰 페이로드 파싱 실패 무시
        }
      }
    } else {
      // 모든 스토리지 키 검사
      const allStorageKeys = Object.keys(localStorage);
      
      // JWT 형식 토큰 검색
      const tokenValues = allStorageKeys
        .filter(key => {
          const value = localStorage.getItem(key);
          return value && (
            value.includes('eyJ') || 
            value.includes('"access_token"') ||
            value.includes('"user"')
          );
        })
        .map(key => ({
          key,
          value: localStorage.getItem(key)?.substring(0, 50) + '...'
        }));
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
      setOngoingSales(filtered);
    } else {
      // 필터 해제
      setOngoingSales(originalSales);
    }
  };

  // 알림 읽음 상태 업데이트하는 핸들러
  const handleMarkAsRead = (notificationId: number) => {
    if (user) {
      markNotificationAsRead(user, notificationId, setNotifications);
    }
  };

  // 요청중인 취켓팅 삭제 핸들러 추가
  const handleDeleteRequest = async (requestId: number) => {
    try {
      const supabaseClient = await getSupabaseClient();
      const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', requestId);

      if (error) {
        throw error;
      }
      
      toast.success('요청이 성공적으로 삭제되었습니다');
      
      // 요청 목록 새로고침
      fetchRequestedTickets();
      
    } catch (error) {
      toast.error('요청 삭제에 실패했습니다');
    }
  };

  // 게시물 삭제 핸들러
  const handleDeletePost = async (postId: number) => {
    try {
      const supabaseClient = await getSupabaseClient();
      const { error } = await supabaseClient
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) {
        throw error;
      }

      toast.success('게시글이 삭제되었습니다');
      
      // 목록 새로고침
      fetchRequestedTickets();
      
    } catch (error) {
      toast.error('게시글 삭제에 실패했습니다');
    }
  };

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      toast.error('로그아웃에 실패했습니다.');
    }
  };

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
      const token = localStorage.getItem("supabase.auth.token");
      if (!token) {
        return;
      }
      
      // seller-stats API 호출
      // const response = await fetch('/api/seller-stats/update', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify({
      //     sellerId,
      //     successfulSales: completedSales,
      //     // 응답률은 실제 계산 로직이 필요
      //     responseRate: 98 // 하드코딩된 값 (실제 구현시 계산 필요)
      //   })
      // });
      
      // if (response.ok) {
      //   const result = await response.json();
      // } else {
      //   const errorText = await response.text();
      // }
    } catch (error) {
      // 판매자 통계 업데이트 오류 무시
    }
  };

  // 로딩 중이거나 마운트되지 않은 경우 로딩 표시
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
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
            <span>홈으로 돌아가기.</span>
          </Link>
          <h1 className="text-3xl font-bold mt-4">마이페이지</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <AccountBalance balance={0} onWithdraw={() => setIsWithdrawModalOpen(true)} />

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-l-4 border-[#FF2F6E]">
              <h2 className="text-lg font-medium text-gray-700 mb-1">포인트</h2>
              <p className="text-2xl font-bold text-[#FF2F6E]">0P</p>
              <div className="flex justify-between items-center mt-4">
                <Link
                  href="/mypage/point-history"
                  className="text-sm text-gray-500 hover:text-[#FF2F6E] transition-colors"
                >
                  적립/사용 내역
                </Link>
                <p className="text-xs text-gray-500">30일 후 소멸 예정: 0P</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-l-4 border-[#FFD600]">
              <h2 className="text-lg font-medium text-gray-700 mb-1">쿠폰</h2>
              <p className="text-2xl font-bold text-[#FFD600]">0장</p>
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
              프로필_테스트
            </button>
            <button
              className={`flex-1 py-4 px-6 text-center ${activeTab === "requested-tickets" ? "bg-gray-100 font-semibold" : ""}`}
              onClick={() => setActiveTab("requested-tickets")}
            >
              <Tag className="inline-block mr-2" />
              요청중인 취켓팅
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

            {activeTab === "requested-tickets" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">요청중인 취켓팅</h2>
                  <Link href="/ticket-request">
                    <Button className="bg-pink-500 hover:bg-pink-600 text-white">
                      새 요청 등록
                    </Button>
                  </Link>
                </div>
                
                {isLoadingRequests ? (
                  <div className="flex justify-center py-8">
                    <Loader />
                  </div>
                ) : requestedTickets.length === 0 ? (
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-500 mb-4">요청중인 취켓팅이 없습니다.</p>
                    <Link href="/ticket-request">
                      <Button variant="outline">첫 요청 등록하기</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requestedTickets.map((ticket) => {
                      // 요청 상태에 따른 UI 결정
                      const isAccepted = ticket.requestStatus === 'ACCEPTED';
                      const hasProposals = ticket.requestStatus === 'HAS_PROPOSALS';
                      
                      return (
                        <div key={ticket.id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                          hasProposals ? 'border-yellow-200 bg-yellow-50' : ''
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-semibold">{ticket.title}</h3>
                                {/* 수락된 제안 배지 - 제목 옆으로 이동 */}
                                {isAccepted && (
                                  <span className="inline-block bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                                    ✅ 제안이 수락되었습니다
                                  </span>
                                )}
                              </div>
                              
                              <p className="text-gray-600 text-sm mb-2">
                                {ticket.event_date && `공연일: ${ticket.event_date}`}
                                {ticket.event_venue && ` | 장소: ${ticket.event_venue}`}
                              </p>
                              
                              <p className="text-gray-500 text-sm mb-2">
                                최대 예산: {ticket.ticket_price?.toLocaleString()}원
                              </p>
                              
                              {/* 거래 상세 보기와 메시지 버튼 */}
                              {isAccepted && ticket.acceptedProposal && (
                                <div className="flex gap-2 mt-3">
                                  {ticket.acceptedProposal.transaction ? (
                                    // transaction이 있으면 실제 링크로
                                    <Link href={`/transaction/${ticket.acceptedProposal.transaction.orderNumber}`}>
                                      <Button 
                                        className="text-sm bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 transition-colors flex items-center gap-1 font-medium" 
                                        variant="outline"
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                        </svg>
                                        거래 상세 보기
                                      </Button>
                                    </Link>
                                  ) : (
                                    // transaction이 없으면 준비중 메시지
                                    <Button 
                                      className="text-sm bg-gray-50 text-gray-500 border-gray-300 cursor-not-allowed flex items-center gap-1 font-medium" 
                                      variant="outline"
                                      disabled
                                      onClick={() => {
                                        toast.info('거래 상세 페이지 준비중입니다');
                                      }}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                      </svg>
                                      거래 상세 보기
                                    </Button>
                                  )}
                                  
                                  <MessageButton 
                                    orderNumber={ticket.acceptedProposal.transaction?.orderNumber || `PROPOSAL-${ticket.acceptedProposal.id}`}
                                    onClick={() => {
                                      // 메시지 버튼 클릭 처리
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-2">
                              {/* 상태별 배지 - 오른쪽으로 이동 */}
                              {isAccepted ? (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                                  거래 진행중
                                </span>
                              ) : hasProposals ? (
                                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium">
                                  제안 {ticket.pendingProposalCount}개
                                  {hasNewProposals(ticket.id, ticket.proposalCount) && (
                                    <span className="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-xs animate-pulse">
                                      NEW
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="bg-pink-100 text-pink-600 px-2 py-1 rounded-full text-xs">
                                  구해요
                                </span>
                              )}
                              
                              <div className="flex gap-2">
                                {isAccepted ? (
                                  // 수락된 제안: 간단한 정보 표시
                                  <div className="flex flex-col gap-1 text-right">
                                    <span className="text-xs text-gray-500">제안 수락됨</span>
                                    <span className="text-xs text-green-600 font-medium">
                                      {new Date(ticket.acceptedProposal.acceptedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                ) : (
                                  // 진행중인 제안: 기존 로직
                                  hasProposals ? (
                                    // 제안이 있으면 모달 열기
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className={hasNewProposals(ticket.id, ticket.proposalCount) ? 'border-red-300 text-red-600 hover:bg-red-50' : ''}
                                      onClick={() => openProposalModal(ticket.id)}
                                    >
                                      제안 확인
                                      {hasNewProposals(ticket.id, ticket.proposalCount) && (
                                        <span className="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                                          NEW
                                        </span>
                                      )}
                                    </Button>
                                  ) : (
                                    // 제안이 없으면 상세보기 페이지로
                                    <Link href={`/ticket-request/${ticket.id}`}>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                      >
                                        상세보기
                                      </Button>
                                    </Link>
                                  )
                                )}
                                
                                {/* 수락된 거래는 삭제 버튼 숨김 */}
                                {!isAccepted && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                                        <FaTrash className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>요청 삭제</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          "{ticket.title}" 요청을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={() => handleDeleteRequest(ticket.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          삭제
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
        balance={0} 
        isOpen={isWithdrawModalOpen} 
        onOpenChange={setIsWithdrawModalOpen} 
      />

      {/* 제안 목록 모달 */}
      {isProposalModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold">받은 제안 목록</h2>
              <button
                onClick={() => setIsProposalModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {isLoadingProposals ? (
                <div className="flex justify-center py-8">
                  <Loader />
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">받은 제안이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {/* 제안자 정보 */}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold text-lg">
                                {proposal.proposer?.name?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-lg text-gray-900">
                                  {proposal.proposer?.name || '사용자'}
                                </h3>
                              </div>
                              
                              <div className="flex items-center gap-4 text-sm">
                                {/* 평점 */}
                                <div className="flex items-center gap-1">
                                  <div className="flex text-yellow-400">
                                    {[...Array(5)].map((_, i) => (
                                      <Star 
                                        key={i} 
                                        className={`h-3 w-3 ${i < Math.floor(proposal.proposer?.rating || 0) ? 'fill-current' : ''}`} 
                                      />
                                    ))}
                                  </div>
                                  <span className="text-gray-600 font-medium">
                                    {proposal.proposer?.rating?.toFixed(1) || '0.0'}
                                  </span>
                                </div>
                                
                                {/* 거래 성사 횟수 - 기존 필드 활용 */}
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">계약 성사:</span>
                                  <span className="font-bold text-blue-600">
                                    {proposal.proposer?.successful_sales || 0}회
                                  </span>
                                </div>
                                
                                {/* 성공률 또는 신규 표시 */}
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">상태:</span>
                                  {proposal.proposer?.response_rate ? (
                                    <span className="font-bold text-green-600">
                                      성공률 {proposal.proposer.response_rate}%
                                    </span>
                                  ) : (
                                    <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium">
                                      신규
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* 제안 세부사항 - 간격 줄이고 더 명확하게 */}
                          <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="grid grid-cols-1 gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">구역:</span>
                                <span className="font-semibold text-gray-900">{proposal.section_name}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">제안 가격:</span>
                                <span className="font-bold text-green-600 text-lg">
                                  {proposal.proposed_price?.toLocaleString()}원
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">제안 일시:</span>
                                <span className="text-sm text-gray-600">
                                  {new Date(proposal.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* 메시지 */}
                          {proposal.message && (
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3">
                              <p className="text-sm text-gray-700">💬 {proposal.message}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* 수락 버튼 */}
                        <div className="ml-4 flex flex-col gap-2">
                          {proposal.status === 'PENDING' ? (
                            <Button
                              onClick={() => handleAcceptProposal(proposal.id)}
                              className="bg-green-500 hover:bg-green-600 text-white rounded-lg"
                              size="sm"
                            >
                              수락하기
                            </Button>
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs text-center">
                              {proposal.status === 'ACCEPTED' ? '수락됨' : '거절됨'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

