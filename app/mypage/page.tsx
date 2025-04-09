"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, User, ShoppingBag, Tag, Loader as LoaderIcon } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { WithdrawModal } from "@/components/withdraw-modal"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { FaTrash } from "react-icons/fa"

// API 기본 URL 설정 (환경별로 다른 호스트 사용)
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

// 간단한 인라인 Loader 컴포넌트
const Loader = ({ size = 24 }: { size?: number }) => (
  <div className="animate-spin" style={{ width: size, height: size }}>
    <LoaderIcon size={size} />
  </div>
);

// 타입 정의
interface TransactionStatus {
  취켓팅진행중: number
  판매중인상품: number
  취켓팅완료: number
  거래완료: number
  거래취소: number
}

// 판매 중인 상품 타입 정의
interface Sale {
  id: number;
  orderNumber?: string;
  title: string;
  date: string;
  price: string;
  status: string;
  isActive: boolean;
  sortPriority: number;
}

// 알림 타입 정의
interface Notification {
  id: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  postId?: number;
}

export default function MyPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const [ongoingSales, setOngoingSales] = useState<Sale[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)
  const [ongoingPurchases, setOngoingPurchases] = useState<any[]>([])
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
      fetchNotifications();
      
      // 페이지 로드 시 구매/판매 현황 데이터 가져오기
      fetchOngoingPurchases();
      fetchOngoingSales();
    }
  }, [user]);

  // user와 activeTab이 변경될 때 데이터 가져오기
  useEffect(() => {
    if (user) {
      if (activeTab === 'ongoing-sales') {
        fetchOngoingSales();
      } else if (activeTab === 'ongoing-purchases') {
        fetchOngoingPurchases();
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
          const parsed = JSON.parse(session);
          console.log("📦 Supabase 세션 정보:", parsed);
          console.log("✅ access_token:", parsed.access_token);
          
          // 토큰이 올바른 형식인지 확인
          if (parsed.access_token) {
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

  // 내가 판매 중인 게시물 목록 가져오기
  const fetchOngoingSales = async () => {
    if (!user) return;
    
    setIsLoadingSales(true);
    try {
      // 클라이언트 사이드에서만 localStorage에 접근하도록 수정
      const authToken = typeof window !== 'undefined' 
        ? localStorage.getItem('token') || localStorage.getItem('supabase_token') || '' 
        : '';
      
      // 요청 URL에 userId 파라미터 추가
      console.log("판매 목록 불러오기 시도... 사용자 ID:", user.id);
      const response = await fetch(`${API_BASE_URL}/api/posts?userId=${user.id}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include', // 쿠키를 포함시킵니다
      });
      
      console.log("API 응답 상태:", response.status, response.statusText);
        
      if (!response.ok) {
        const errorData = await response.text();
        console.error("API 오류 응답:", errorData);
        throw new Error('판매 목록을 불러오는데 실패했습니다.');
      }
        
      const data = await response.json();
      console.log("받은 데이터:", data);
      
      if (!data.posts || !Array.isArray(data.posts)) {
        console.error("API 응답에 posts 배열이 없거나 유효하지 않습니다:", data);
        setOngoingSales([]);
        return;
      }
      
      // 상태 카운트 초기화
      const newSaleStatus = {
        취켓팅진행중: 0,
        판매중인상품: 0,
        취켓팅완료: 0,
        거래완료: 0,
        거래취소: 0,
      };
      
      // 판매자의 판매 상품에 대한 구매 정보도 함께 가져옵니다
      // 구매 확정(CONFIRMED) 상태 확인을 위해 추가 API 호출
      const timestamp = Date.now();
      const userId = user?.id || '';
      console.log(`판매자 구매 내역 요청: ${API_BASE_URL}/api/seller-purchases?t=${timestamp}&userId=${userId}`);
      
      const purchaseResponse = await fetch(`${API_BASE_URL}/api/seller-purchases?t=${timestamp}&userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include' // 쿠키 포함
      });
      
      console.log("판매자 구매 내역 API 응답 상태:", purchaseResponse.status, purchaseResponse.statusText);
      
      let purchasesByPostId: Record<number, any> = {};
      
      if (purchaseResponse.ok) {
        const purchaseData = await purchaseResponse.json();
        console.log("판매자 구매 내역 데이터:", purchaseData);
        if (purchaseData.purchases && Array.isArray(purchaseData.purchases)) {
          // 게시글 ID별로 구매 정보를 인덱싱
          purchasesByPostId = purchaseData.purchases.reduce((acc: Record<number, any>, purchase: any) => {
            if (purchase.postId || purchase.post_id) {
              // post_id 또는 postId 필드 처리
              const postId = purchase.postId || purchase.post_id;
              acc[postId] = purchase;
            }
            return acc;
          }, {});
        }
      } else {
        console.error("판매자 구매 내역 가져오기 실패:", purchaseResponse.status);
        const errorText = await purchaseResponse.text().catch(() => "");
        console.error("오류 응답:", errorText);
        
        try {
          // JSON 응답인 경우 구조적으로 파싱하여 표시
          const errorJson = JSON.parse(errorText);
          console.error("오류 응답:", errorJson);
        } catch (e) {
          // JSON이 아닌 경우 그냥 텍스트 로깅
        }
      }
        
      // API 응답을 화면에 표시할 형식으로 변환
      const salesData = data.posts.map((post: any) => {
        // 판매 상태에 따라 카운트 증가
        const postStatus = post.status || '';
        const category = post.category || '';
        
        // 관련된 구매 확인
        const relatedPurchase = purchasesByPostId[post.id];
        const purchaseStatus = relatedPurchase?.status || '';
        
        // 상태에 따른 텍스트 표시
        let statusText = "판매중";
        
        // 디버깅을 위한 로그 추가
        console.log(`게시글 ID ${post.id}의 상태: postStatus=${postStatus}, purchaseStatus=${purchaseStatus}`);
        
        // 구매 상태가 CONFIRMED인 경우 거래완료로 표시
        if (purchaseStatus === 'CONFIRMED') {
          statusText = "거래완료";
        } else if (postStatus === 'PENDING' || postStatus === 'PENDING_PAYMENT') {
          statusText = "취켓팅 진행중";
        } else if (postStatus === 'PROCESSING') {
          statusText = "취켓팅 진행중";
        } else if (postStatus === 'COMPLETED') {
          statusText = "취켓팅 완료";
        } else if (postStatus === 'CONFIRMED') {
          statusText = "거래완료";
        } else if (postStatus === 'CANCELLED') {
          statusText = "거래취소";
        }
        
        // 상태에 따른 카운트 로직
        if (purchaseStatus === 'CONFIRMED') {
          // 구매 확정된 경우 거래완료로 카운트
          newSaleStatus.거래완료 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 거래완료 (+1)`);
        } else if (postStatus === 'ACTIVE' || postStatus === '' || postStatus === undefined || postStatus === null) {
          // 글이 활성 상태(판매중)이거나 상태가 지정되지 않은 경우 '판매중인상품'으로 카운트
          // 이것이 "판매 가능한"(아직 안팔린) 상품을 의미합니다
          newSaleStatus.판매중인상품 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 판매중인상품 (+1) - 판매 가능한 상품`);
        } else if (postStatus === 'PENDING' || postStatus === 'PENDING_PAYMENT') {
          // 누군가 구매 신청을 했거나 결제 대기 중이면 '취켓팅진행중'으로 카운트
          newSaleStatus.취켓팅진행중 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 취켓팅진행중 (+1)`);
        } else if (postStatus === 'PROCESSING') {
          // 처리 중인 경우 '취켓팅진행중'으로 카운트
          newSaleStatus.취켓팅진행중 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 취켓팅진행중 (+1)`);
        } else if (postStatus === 'COMPLETED') {
          // 취켓팅 완료된 경우
          newSaleStatus.취켓팅완료 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 취켓팅완료 (+1)`);
        } else if (postStatus === 'CONFIRMED') {
          // 구매 확정된 경우도 거래완료로 카운트
          newSaleStatus.거래완료 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 거래완료 (+1)`);
        } else if (postStatus === 'CANCELLED') {
          // 거래가 취소된 경우
          newSaleStatus.거래취소 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 거래취소 (+1)`);
        } else {
          // 기타 상태는 일단 판매중으로 간주
          console.log(`[카운트] 알 수 없는 상태의 게시글: ${post.id}, status=${postStatus}`);
          newSaleStatus.판매중인상품 += 1;
          console.log(`[카운트] 게시글 ID ${post.id}: 판매중인상품(기본) (+1)`);
        }
        
        // 정렬을 위한 우선순위 부여
        let sortPriority = 0;
        if (statusText === "취켓팅 진행중") {
          sortPriority = 1;  // 가장 높은 우선순위
        } else if (statusText === "판매중") {
          sortPriority = 2;  // 두 번째 우선순위
        } else if (statusText === "취켓팅 완료") {
          sortPriority = 3;  // 세 번째 우선순위
        } else if (statusText === "거래완료") {
          sortPriority = 4;  // 네 번째 우선순위
        } else if (statusText === "거래취소") {
          sortPriority = 5;  // 가장 낮은 우선순위
        }
        
        return {
          id: post.id,
          title: post.title || post.eventName || "제목 없음",
          date: formatDate(post.eventDate, post.createdAt),
          price: post.ticketPrice 
            ? `${Number(post.ticketPrice).toLocaleString()}원` 
            : '가격 정보 없음',
          status: statusText,
          isActive: postStatus === 'ACTIVE' || postStatus === '' || postStatus === undefined || postStatus === null,
          sortPriority: sortPriority,  // 정렬용 우선순위 필드 추가
          orderNumber: relatedPurchase?.orderNumber // 관련 구매의 주문번호 추가
        };
      });
      
      // 상태에 따라 정렬 - 취켓팅 진행중인 상품이 먼저 오도록
      const sortedSalesData = [...salesData].sort((a, b) => a.sortPriority - b.sortPriority);
      
      // 상태 업데이트
      setSaleStatus(newSaleStatus);
        
      console.log("변환된 판매 데이터:", salesData);
      console.log("정렬된 판매 데이터:", sortedSalesData);
      console.log("판매 상태별 카운트:", newSaleStatus);
      console.log(`전체 상품 수: ${salesData.length}`);
      console.log(`판매 가능한 상품(ACTIVE) 수: ${newSaleStatus.판매중인상품}`);
      setOriginalSales(sortedSalesData);
      setOngoingSales(sortedSalesData);
    } catch (error) {
      console.error('판매 목록 로딩 오류:', error);
      toast.error('판매 목록을 불러오는데 실패했습니다.');
      // 더미 데이터로 대체
      setOngoingSales([
        { id: 2, title: "웃는 남자 [더미 데이터]", date: "2024-01-09", price: "110,000원", status: "취켓팅 진행중", isActive: false, sortPriority: 1 },
        { id: 1, title: "아이브 팬미팅 [더미 데이터]", date: "2024-04-05", price: "88,000원", status: "판매중", isActive: true, sortPriority: 2 },
      ]);
    } finally {
      setIsLoadingSales(false);
    }
  };

  // 구매 중인 상품 목록 가져오기
  const fetchOngoingPurchases = async () => {
    if (!user) return;
    
    setIsLoadingPurchases(true);
    try {
      console.log("📣 fetchOngoingPurchases 호출됨, 사용자 ID:", user.id);
      
      // Supabase 세션 갱신 먼저 시도
      try {
        console.log("Supabase 세션 갱신 중...");
        // 동적으로 Supabase 클라이언트 임포트
        const { supabase } = await import("@/lib/supabase");
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("세션 가져오기 오류:", error.message);
        } else {
          console.log("Supabase 세션 갱신 성공:", session ? "세션 있음" : "세션 없음");
        }
      } catch (sessionError) {
        console.error("Supabase 세션 갱신 실패:", sessionError);
      }
      
      // Supabase 저장소 키 찾기 (디버깅용)
      let authToken = '';
      const authTokenSources = [];
      
      // 1. sb-xxx-auth-token 형태의 키 찾기
      const supabaseKey = Object.keys(localStorage).find(key => 
        key.startsWith('sb-') && key.endsWith('-auth-token')
      );
      
      if (supabaseKey) {
        try {
          const supabaseData = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
          if (supabaseData.access_token) {
            authToken = supabaseData.access_token;
            authTokenSources.push('sb-auth-token');
            console.log("✅ sb-xxx-auth-token에서 토큰 발견");
          }
        } catch (e) {
          console.error("❌ Supabase 저장소 파싱 실패:", e);
        }
      }
      
      // 2. auth-token 포함 키 찾기
      if (!authToken) {
        const authKeys = Object.keys(localStorage).filter(k => k.includes('auth-token'));
        if (authKeys.length > 0) {
          try {
            const authData = JSON.parse(localStorage.getItem(authKeys[0]) || '{}');
            if (authData.access_token) {
              authToken = authData.access_token;
              authTokenSources.push('auth-token');
              console.log("✅ auth-token에서 토큰 발견");
            }
          } catch (e) {
            console.error("❌ auth-token 파싱 실패:", e);
          }
        }
      }
      
      // 3. 기존 방식 (token, supabase_token 등)
      if (!authToken) {
        authToken = localStorage.getItem('token') || localStorage.getItem('supabase_token') || localStorage.getItem('access_token') || '';
        if (authToken) {
          authTokenSources.push('legacy-token');
          console.log("✅ 기존 저장소에서 토큰 발견");
        }
      }
      
      // 캐시 방지를 위한 타임스탬프 추가
      const timestamp = new Date().getTime();
      
      // 디버깅을 위한 URL 및 토큰 로깅
      console.log("📡 구매 목록 API 호출:", `${API_BASE_URL}/api/purchase?userId=${user.id}&t=${timestamp}`);
      console.log("🔑 토큰 소스:", authTokenSources.join(', ') || '없음');
      console.log("🔑 토큰 형식 검증:", authToken ? `Bearer ${authToken.substring(0, 10)}...` : '없음');
      
      // 헤더 설정
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };
      
      console.log("📨 요청 헤더:", JSON.stringify(headers, null, 2));
      
      const response = await fetch(`${API_BASE_URL}/api/purchase?userId=${user.id}&t=${timestamp}`, {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store'
      });
      
      console.log("📥 구매 데이터 API 응답 상태:", response.status, response.statusText);
      
      // 응답 헤더 확인
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.log("📥 응답 헤더:", responseHeaders);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("구매 API 오류 응답:", errorData);
        throw new Error('구매 목록을 불러오는데 실패했습니다.');
      }
      
      const responseText = await response.text();
      console.log("원시 응답 텍스트:", responseText);
      
      // 응답이 빈 문자열인 경우 처리
      if (!responseText || responseText.trim() === '') {
        console.error("API가 빈 응답을 반환했습니다");
        setOngoingPurchases([]);
        return;
      }
      
      // 텍스트를 JSON으로 파싱
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("JSON 파싱 오류:", jsonError, "원본 텍스트:", responseText);
        throw new Error('응답 데이터 형식이 잘못되었습니다.');
      }
      
      console.log("구매 API 응답 데이터:", data);
      // 추가 디버깅 정보
      console.log("🔍 API 전체 응답 (data):", JSON.stringify(data, null, 2));
      console.log("🔎 data 타입:", typeof data);
      console.log("🔎 data 키들:", Object.keys(data));
      console.log("🔎 purchases 값:", data.purchases);
      console.log("🔎 data.data 값:", data.data);
      console.log("🔎 data.result 값:", data.result);
      console.log("🔎 data.items 값:", data.items);
      
      // 실제 구매 데이터가 어떤 필드에 있는지 확인
      let purchasesArray = null;
      if (data.purchases && Array.isArray(data.purchases)) {
        console.log("✅ 구매 데이터는 data.purchases에 있습니다.");
        purchasesArray = data.purchases;
      } else if (data.data && Array.isArray(data.data)) {
        console.log("✅ 구매 데이터는 data.data에 있습니다.");
        purchasesArray = data.data;
      } else if (data.result && Array.isArray(data.result)) {
        console.log("✅ 구매 데이터는 data.result에 있습니다.");
        purchasesArray = data.result;
      } else if (data.items && Array.isArray(data.items)) {
        console.log("✅ 구매 데이터는 data.items에 있습니다.");
        purchasesArray = data.items;
      } else if (Array.isArray(data)) {
        console.log("✅ 응답 자체가 배열입니다.");
        purchasesArray = data;
      }
      
      // API 응답에 purchases 배열이 있는지 확인
      if (!purchasesArray) {
        console.error("API 응답에서 구매 데이터 배열을 찾을 수 없습니다:", data);
        
        // 어드민 API를 사용하여 구매 내역 가져오기 시도
        console.log("어드민 API로 구매 내역 검색 시도 중...");
        try {
          const adminResponse = await fetch(`${API_BASE_URL}/api/admin-purchases?userId=${user.id}&t=${timestamp}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            credentials: 'include'
          });
          
          console.log("어드민 API 응답 상태:", adminResponse.status, adminResponse.statusText);
          
          if (!adminResponse.ok) {
            console.error("어드민 API 오류:", adminResponse.statusText);
            setOngoingPurchases([]);
            return;
          }
          
          const adminData = await adminResponse.json();
          console.log("어드민 API 응답 데이터:", adminData);
          console.log("🔍 어드민 API 전체 응답:", JSON.stringify(adminData, null, 2));
          
          if (adminData.success && adminData.purchases && adminData.purchases.length > 0) {
            console.log(`어드민 API에서 ${adminData.purchases.length}개의 구매 내역 발견`);
            purchasesArray = adminData.purchases;
          } else {
            console.log("어드민 API에서도 구매 내역을 찾지 못함");
            setOngoingPurchases([]);
            return;
          }
        } catch (adminError) {
          console.error("어드민 API 호출 오류:", adminError);
          setOngoingPurchases([]);
          return;
        }
      }
      
      console.log(`API에서 ${purchasesArray.length}개의 구매 내역 불러옴:`, purchasesArray);
      
      // 누락된 post 정보 가져오기
      const postIds = purchasesArray
        .filter((p: any) => p.post_id)
        .map((p: any) => p.post_id);
      
      console.log("게시물 ID 목록:", postIds);
      
      if (postIds.length > 0) {
        try {
          // 게시물 정보 가져오기
          const postsMap: Record<string | number, any> = {};
          
          // 각 게시물 정보 가져오기
          for (const postId of postIds) {
            try {
              console.log(`게시물 ID ${postId} 정보 가져오기 시도...`);
              const postResponse = await fetch(`${API_BASE_URL}/api/posts/${postId}?t=${timestamp}`, {
                method: 'GET',
                headers,
                credentials: 'include'
              });
              
              if (postResponse.ok) {
                const postData = await postResponse.json();
                if (postData && postData.post) {
                  console.log(`✅ 게시물 ID ${postId} 정보 가져오기 성공:`, postData.post);
                  postsMap[postId] = postData.post;
                }
              } else {
                console.error(`❌ 게시물 ID ${postId} 정보 가져오기 실패:`, postResponse.status);
              }
            } catch (error) {
              console.error(`❌ 게시물 ID ${postId} 정보 가져오기 오류:`, error);
            }
          }
          
          // 구매 항목에 post 정보 연결
          if (Object.keys(postsMap).length > 0) {
            console.log("게시물 정보 매핑:", postsMap);
            purchasesArray = purchasesArray.map(purchase => {
              const postId = purchase.post_id;
              if (postId && postsMap[postId]) {
                return {
                  ...purchase,
                  post: postsMap[postId]
                };
              }
              return purchase;
            });
            console.log("게시물 정보가 연결된 구매 데이터:", purchasesArray);
          }
        } catch (postError) {
          console.error("게시물 정보 가져오기 오류:", postError);
        }
      }
      
      // 구매 내역 처리
      processPurchaseData(purchasesArray);
    } catch (error) {
      console.error("구매 데이터 로딩 오류:", error);
      toast.error("구매 내역을 불러오는 중 오류가 발생했습니다.");
      
      // 오류 시에도 빈 배열로 설정하여 UI가 깨지지 않도록 함
      setOngoingPurchases([]);
    } finally {
      setIsLoadingPurchases(false);
    }
  };
  
  // 구매 데이터 처리 함수 추가
  const processPurchaseData = (purchases: any[]) => {
    // 구매 상태에 따른 카운트
    const newPurchaseStatus = {
      취켓팅진행중: 0,
      판매중인상품: 0,
      취켓팅완료: 0,
      거래완료: 0,
      거래취소: 0,
    };
    
    // API 응답을 화면에 표시할 형식으로 변환
    const purchasesData = purchases.map((purchase: any) => {
      // 구매 상태에 따라 카운트 증가
      const purchaseStatus = purchase.status || '';
      
      console.log(`구매 데이터 처리: ID=${purchase.id}, 상태=${purchaseStatus}`);
      console.log("구매 데이터 전체:", purchase);
      
      // 상태 카운트 로직
      if (purchaseStatus === 'PENDING' || purchaseStatus === 'PENDING_PAYMENT' || purchaseStatus === 'PROCESSING' || purchaseStatus === 'PROCESS') {
        newPurchaseStatus.취켓팅진행중 += 1;
        console.log(`[구매 카운트] ID ${purchase.id}: 취켓팅진행중 (+1)`);
      } else if (purchaseStatus === 'COMPLETED') {
        newPurchaseStatus.취켓팅완료 += 1;
        console.log(`[구매 카운트] ID ${purchase.id}: 취켓팅완료 (+1)`);
      } else if (purchaseStatus === 'CONFIRMED') {
        newPurchaseStatus.거래완료 += 1;
        console.log(`[구매 카운트] ID ${purchase.id}: 거래완료 (+1)`);
      } else if (purchaseStatus === 'CANCELLED') {
        newPurchaseStatus.거래취소 += 1;
        console.log(`[구매 카운트] ID ${purchase.id}: 거래취소 (+1)`);
      } else {
        console.log(`[구매 카운트] 알 수 없는 상태: ${purchase.id}, status=${purchaseStatus}`);
      }
      
      // 게시물 데이터 안전하게 접근
      const post = purchase.post || {};
      const seller = purchase.seller || {};
      
      // 제목 정보를 다양한 소스에서 찾기
      let title = '제목 없음';
      
      // 1. API에서 가져온 post 객체에서 찾기
      if (post) {
        if (post.title) {
          title = post.title;
          console.log(`[제목] post.title에서 찾음: ${title}`);
        } else if (post.eventName || post.event_name) {
          title = post.eventName || post.event_name;
          console.log(`[제목] post.eventName에서 찾음: ${title}`);
        }
      }
      
      // 2. purchase 객체 자체에서 찾기
      if (title === '제목 없음') {
        if (purchase.ticket_title) {
          title = purchase.ticket_title;
          console.log(`[제목] purchase.ticket_title에서 찾음: ${title}`);
        } else if (purchase.ticketTitle) {
          title = purchase.ticketTitle;
          console.log(`[제목] purchase.ticketTitle에서 찾음: ${title}`);
        } else if (purchase.event_name) {
          title = purchase.event_name;
          console.log(`[제목] purchase.event_name에서 찾음: ${title}`);
        } else if (purchase.eventName) {
          title = purchase.eventName;
          console.log(`[제목] purchase.eventName에서 찾음: ${title}`);
        }
      }
      
      console.log(`구매 항목 최종 제목: "${title}"`);
      
      // 디버깅: 제목 정보 로깅
      console.log(`구매 항목 제목 결정 과정:`, {
        'post.title': post.title,
        'post.eventName': post.eventName,
        'post.event_name': post.event_name,
        'purchase.ticket_title': purchase.ticket_title,
        'purchase.ticketTitle': purchase.ticketTitle,
        'purchase.event_name': purchase.event_name,
        'purchase.eventName': purchase.eventName,
        '최종 선택 제목': title
      });
      
      const formattedPurchase = {
        id: purchase.id,
        order_number: purchase.order_number || purchase.orderNumber,
        orderNumber: purchase.order_number || purchase.orderNumber,
        postId: purchase.post_id || purchase.postId,
        title: title,
        // 원본 데이터도 보존
        ticketTitle: purchase.ticket_title || purchase.ticketTitle,
        eventName: purchase.event_name || post.event_name || post.eventName,
        post: post,
        status: purchaseStatus,
        seller: seller.name || '판매자 정보 없음',
        sellerId: purchase.seller_id || seller.id,
        quantity: purchase.quantity || 1,
        price: purchase.total_price || post.ticket_price || post.ticketPrice || 0,
        createdAt: purchase.created_at || new Date().toISOString(),
        updatedAt: purchase.updated_at || purchase.created_at || new Date().toISOString(),
      };
      
      console.log(`[구매 데이터] ID ${purchase.id} 변환:`, formattedPurchase);
      return formattedPurchase;
    });
    
    console.log("최종 구매 상태 카운트:", newPurchaseStatus);
    
    // 정렬: 취켓팅 진행중 > 취켓팅 완료 > 거래완료 > 거래취소
    const sortedPurchases = [...purchasesData].sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === 'PENDING' || status === 'PENDING_PAYMENT' || status === 'PROCESSING' || status === 'PROCESS') return 1;
        if (status === 'COMPLETED') return 2;
        if (status === 'CONFIRMED') return 3;
        if (status === 'CANCELLED') return 4;
        return 5;
      };
      
      return getPriority(a.status) - getPriority(b.status);
    });
    
    console.log("정렬된 구매 데이터:", sortedPurchases);
    
    // 상태 업데이트
    setOngoingPurchases(sortedPurchases);
    setPurchaseStatus(newPurchaseStatus);
    
    console.log("구매 데이터 로딩 완료:", sortedPurchases.length, "개 항목");
  };

  // 상태 텍스트 변환 함수
  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING': return '입금 대기중';
      case 'PROCESSING': return '처리 중';
      case 'COMPLETED': return '완료됨';
      case 'CONFIRMED': return '구매 확정됨';
      case 'CANCELLED': return '취소됨';
      default: return '상태 불명';
    }
  };

  // 날짜 형식화 함수 추가
  const formatDate = (...dates: (string | undefined)[]): string => {
    // 유효한 날짜 찾기
    for (const date of dates) {
      if (!date) continue;
      
      try {
        const parsedDate = new Date(date);
        // 날짜가 유효한지 확인
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toLocaleDateString();
        }
      } catch (e) {
        console.error("날짜 변환 오류:", e);
      }
    }
    
    // 유효한 날짜가 없는 경우 기본값 반환
    return "날짜 정보 없음";
  };

  // 알림 목록 가져오기
  const fetchNotifications = async () => {
    if (!user) return;
    
    setIsLoadingNotifications(true);
    try {
      // 클라이언트 사이드에서만 localStorage에 접근하도록 수정
      // token 또는 supabase_token 키로 토큰을 가져옴
      const authToken = typeof window !== 'undefined' 
        ? localStorage.getItem('token') || localStorage.getItem('supabase_token') || '' 
        : '';
      
      const response = await fetch(`${API_BASE_URL}/api/notifications?userId=${user?.id || ''}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        credentials: 'include', // 쿠키를 포함시킵니다
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = '알림 목록을 불러오는데 실패했습니다.';
        
        if (errorData.error) {
          errorMessage = errorData.error;
          
          switch (errorData.code) {
            case 'AUTH_ERROR':
              errorMessage = '인증이 만료되었습니다. 다시 로그인해주세요.';
              break;
            case 'USER_NOT_FOUND':
              errorMessage = '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.';
              break;
            case 'USER_CREATE_ERROR':
              errorMessage = '사용자 정보 생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
              break;
            case 'DB_CONNECTION_ERROR':
              errorMessage = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
              break;
            case 'DB_TIMEOUT_ERROR':
              errorMessage = '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.';
              break;
            case 'DB_SCHEMA_ERROR':
              errorMessage = '서버에서 오류가 발생했습니다. 관리자에게 문의해주세요.';
              break;
            case 'NETWORK_ERROR':
              errorMessage = '네트워크 연결을 확인해주세요.';
              break;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.notifications || !Array.isArray(data.notifications)) {
        setNotifications([]);
        return;
      }
      
      // 알림 데이터 가공 (날짜 포맷 변경 등)
      const notificationsData = data.notifications.map((notification: any) => ({
        ...notification,
        createdAt: new Date(notification.createdAt).toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
      
      setNotifications(notificationsData);
    } catch (error) {
      console.error('알림 목록 로딩 오류:', error);
      toast.error('알림 목록을 불러오는데 실패했습니다.');
      // 더미 데이터로 대체
      setNotifications([
        { 
          id: 1, 
          message: "홍길동님이 '아이브 콘서트' 공연의 [R석] 좌석에 대한 취켓팅을 신청했습니다.", 
          type: "PURCHASE", 
          isRead: false, 
          createdAt: "2024-03-18 14:25", 
          postId: 1 
        },
        { 
          id: 2, 
          message: "시스템 정기 점검 안내: 3월 20일 새벽 2시부터 5시까지 서비스 이용이 제한됩니다.", 
          type: "SYSTEM", 
          isRead: true, 
          createdAt: "2024-03-15 09:00" 
        }
      ]);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // 알림 읽음 상태 업데이트
  const markNotificationAsRead = async (notificationId: number) => {
    try {
      // 클라이언트 사이드에서만 localStorage에 접근하도록 수정
      // token 또는 supabase_token 키로 토큰을 가져옴
      const authToken = typeof window !== 'undefined' 
        ? localStorage.getItem('token') || localStorage.getItem('supabase_token') || '' 
        : '';
      
      const response = await fetch(`${API_BASE_URL}/api/notifications?userId=${user?.id || ''}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        credentials: 'include', // 쿠키를 포함시킵니다
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error('알림 상태 업데이트에 실패했습니다.');
      }

      // 알림 목록 업데이트
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true } 
            : notification
        )
      );
    } catch (error) {
      console.error('알림 상태 업데이트 오류:', error);
      toast.error('알림 상태를 업데이트하는데 실패했습니다.');
    }
  };

  // 게시물 삭제 함수
  const deletePost = async (postId: number) => {
    try {
      if (!user || !user.id) {
        toast.error("사용자 인증 정보가 없습니다. 다시 로그인해주세요.");
        router.push("/login?callbackUrl=/mypage");
        return;
      }
      
      console.log("게시물 삭제 요청:", postId, "사용자 ID:", user.id);
      
      // 현재 실행 중인 포트 확인 및 사용
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      console.log("현재 접속 URL:", currentUrl);
      
      // 현재 호스트 URL 가져오기 (포트 포함)
      const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
      console.log("현재 호스트:", currentHost);
      
      // Supabase 세션 토큰 가져오기
      let authToken = '';
      try {
        if (typeof window !== 'undefined') {
          // 1. Supabase 저장소 키 가져오기
          const supabaseStorageKey = Object.keys(localStorage).find(key => 
            key.startsWith('sb-') && key.endsWith('-auth-token')
          );
          
          if (supabaseStorageKey) {
            // Supabase 세션 데이터 파싱
            const supabaseSession = JSON.parse(localStorage.getItem(supabaseStorageKey) || '{}');
            if (supabaseSession.access_token) {
              authToken = supabaseSession.access_token;
              console.log("Supabase 세션 토큰 발견");
            }
          }
          
          // 2. 이전 방식의 토큰 확인 (폴백)
          if (!authToken) {
            authToken = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
            if (authToken) console.log("기존 저장소에서 토큰 발견");
          }
        }
      } catch (storageError) {
        console.error("토큰 접근 오류:", storageError);
      }
      
      // 요청 헤더 구성
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      // 토큰이 있는 경우 인증 헤더 추가
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      // userId를 항상 쿼리 파라미터로 추가 (인증 백업)
      const userId = user.id?.toString() || '';
      // 현재 호스트 사용 (포트 불일치 문제 해결)
      let url = `${currentHost}/api/posts/${postId}?userId=${userId}&t=${Date.now()}`;
      
      console.log("삭제 요청 URL:", url);
      console.log("인증 헤더 포함:", !!headers['Authorization']);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        credentials: 'include', // 쿠키 포함
      });
      
      // 응답이 JSON이 아닌 경우 처리
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("응답이 JSON이 아닙니다:", await response.text());
        throw new Error("서버에서 유효한 응답을 받지 못했습니다.");
      }

      const data = await response.json();
      console.log("삭제 응답:", data);
      
      if (!response.ok) {
        throw new Error(data.message || '게시물 삭제에 실패했습니다.');
      }
      
      toast.success("게시물이 성공적으로 삭제되었습니다.");
      
      // UI에서 제거 (ongoingSales와 originalSales 모두 업데이트)
      setOngoingSales(prev => prev.filter(sale => sale.id !== postId));
      setOriginalSales(prev => prev.filter(sale => sale.id !== postId));
      
      // 상태 카운트 업데이트 (해당 항목의 상태에 따라)
      const deletedItem = originalSales.find(sale => sale.id === postId);
      if (deletedItem) {
        if (deletedItem.status === "판매중" && deletedItem.isActive) {
          setSaleStatus(prev => ({
            ...prev,
            판매중인상품: Math.max(0, prev.판매중인상품 - 1)
          }));
        } else if (deletedItem.status === "취켓팅 진행중") {
          setSaleStatus(prev => ({
            ...prev,
            취켓팅진행중: Math.max(0, prev.취켓팅진행중 - 1)
          }));
        } else if (deletedItem.status === "취켓팅 완료") {
          setSaleStatus(prev => ({
            ...prev,
            취켓팅완료: Math.max(0, prev.취켓팅완료 - 1)
          }));
        } else if (deletedItem.status === "거래완료") {
          setSaleStatus(prev => ({
            ...prev,
            거래완료: Math.max(0, prev.거래완료 - 1)
          }));
        } else if (deletedItem.status === "거래취소") {
          setSaleStatus(prev => ({
            ...prev,
            거래취소: Math.max(0, prev.거래취소 - 1)
          }));
        }
      }
    } catch (error) {
      console.error('게시물 삭제 오류:', error);
      toast.error(error instanceof Error ? error.message : "게시물 삭제 중 오류가 발생했습니다.");
    }
  };

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

  const handleLogout = async () => {
    await logout();
    toast.success("로그아웃 되었습니다");
    router.push("/");
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
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-l-4 border-[#0061FF]">
              <h2 className="text-lg font-medium text-gray-700 mb-1">나의 예치금</h2>
              <p className="text-2xl font-bold text-[#0061FF]">120,000원</p>
              <div className="flex justify-between items-center mt-4">
                <Link
                  href="/mypage/deposit-history"
                  className="text-sm text-gray-500 hover:text-[#0061FF] transition-colors"
                >
                  거래내역 보기
                </Link>
                <Button
                  className="bg-[#FFD600] hover:bg-[#FFE600] text-black px-5 py-2"
                  onClick={() => setIsWithdrawModalOpen(true)}
                >
                  출금하기
                </Button>
              </div>
            </div>
          </div>

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
                <span className="text-2xl font-bold">{purchaseStatus.거래완료}</span>
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
              <div>
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <p className="text-blue-700 text-sm">이 정보는 회원님만 볼 수 있는 개인 정보입니다.</p>
                </div>
                <h2 className="text-xl font-semibold mb-4">프로필 정보</h2>
                <p>
                  <strong>이름:</strong> {user.name || "이름 정보 없음"}
                </p>
                <p>
                  <strong>이메일:</strong> {user.email || "이메일 정보 없음"}
                </p>
                <p>
                  <strong>가입일:</strong> {new Date().toLocaleDateString()}
                </p>
                <Link href="/mypage/edit-profile">
                  <Button className="mt-4 bg-[#FFD600] hover:bg-[#FFE600] text-black px-6 py-2">프로필 수정</Button>
                </Link>
              </div>
            )}

            {activeTab === "ongoing-purchases" && (
              <div>
                <h2 className="text-xl font-semibold mb-4">진행중인 구매</h2>
                {isLoadingPurchases ? (
                  <div className="text-center py-8"><Loader size={30} /></div>
                ) : ongoingPurchases.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">구매 내역이 없습니다</p>
                    <Button 
                      onClick={() => router.push('/tickets')} 
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                    >
                      티켓 구매하러 가기
                    </Button>
                  </div>
                ) : (
                  ongoingPurchases.map((item) => (
                    <div key={item.id} className="border-b py-4 last:border-b-0">
                      <h3 className="font-medium">
                        {item.title !== '제목 없음' 
                          ? item.title 
                          : (item.post && item.post.title) 
                            || (item.post && (item.post.eventName || item.post.event_name))
                            || item.ticketTitle 
                            || item.eventName 
                            || '제목 없음'}
                      </h3>
                      <p className="text-sm text-gray-600">{item.date}</p>
                      <p className="text-sm font-semibold">
                        {typeof item.price === 'number' 
                          ? item.price.toLocaleString() + '원'
                          : item.price}
                      </p>
                      <p className="text-sm text-blue-600">{item.status}</p>
                      <div className="flex mt-2 gap-2">
                        <Link href={`/transaction/${item.orderNumber || item.id}`}>
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
                        <Link href={`/transaction/${item.orderNumber || item.id}`}>
                          <Button 
                            variant="outline" 
                            className="text-sm flex items-center gap-2 border-2 border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors font-medium"
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
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            메시지
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "ongoing-sales" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">판매중인 상품</h2>
                  <button
                    onClick={filterActiveSales}
                    className={`px-3 py-1 rounded text-sm flex items-center ${
                      showOnlyActive 
                        ? "bg-blue-500 text-white" 
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {showOnlyActive ? "전체 상품 보기" : "판매 가능한 상품만 보기 (" + saleStatus.판매중인상품 + ")"}
                  </button>
                </div>
                {isLoadingSales ? (
                  <div className="text-center py-8"><Loader size={30} /></div>
                ) : ongoingSales.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">판매 중인 티켓이 없습니다</p>
                    <Button
                      onClick={() => router.push('/sell')}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                    >
                      티켓 판매하러 가기
                    </Button>
                  </div>
                ) : (
                  ongoingSales.map((item) => (
                    <div 
                      key={item.id} 
                      className="border-b py-4 last:border-b-0"
                    >
                      <div className="flex justify-between mb-1">
                        <h3 className="font-medium">{item.title}</h3>
                        {item.status === "취켓팅 진행중" && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                            취켓팅 진행중
                          </span>
                        )}
                        {item.isActive && item.status === "판매중" && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            판매 가능
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{item.date}</p>
                      <p className="text-sm font-semibold">
                        {item.price}
                      </p>
                      <p className={`text-sm ${
                        item.status === "판매중" ? "text-green-600" : 
                        item.status.includes("취켓팅 진행중") ? "text-blue-600 font-medium" : 
                        item.status.includes("취켓팅") ? "text-blue-600" : 
                        item.status === "거래완료" ? "text-purple-600" : 
                        item.status === "거래취소" ? "text-red-600" : "text-gray-600"
                      }`}>{item.status}</p>
                      <div className="flex mt-2 justify-between items-center">
                        <div className="flex gap-2">
                          <Link href={`/seller/transaction/${item.orderNumber || item.id}`}>
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
                          <Link href={`/transaction/${item.orderNumber || item.id}`}>
                            <Button 
                              variant="outline" 
                              className="text-sm flex items-center gap-2 border-2 border-pink-400 bg-pink-50 text-pink-700 hover:bg-pink-100 transition-colors font-medium"
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
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                              메시지
                            </Button>
                          </Link>
                        </div>
                        {item.status === "판매중" && (
                          <AlertDialog>
                            <AlertDialogTrigger>
                              <div 
                                className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded cursor-pointer inline-flex items-center justify-center font-medium"
                              >
                                삭제
                              </div>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>판매 상품 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  이 상품을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePost(item.id)}>삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <WithdrawModal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} balance={120000} />
    </div>
  )
}

