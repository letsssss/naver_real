import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs'

// 타입 정의
interface TransactionStatus {
  취켓팅진행중: number;
  판매중인상품: number;
  취켓팅완료: number;
  거래완료: number;
  거래취소: number;
}

interface Sale {
  id: number;
  orderNumber?: string;
  title: string;
  date: string;
  price: string;
  status: string;
  isActive: boolean;
  sortPriority: number;
  transaction_type?: 'direct_purchase' | 'proposal_based';
}

interface User {
  id: string | number;
  email?: string;
  name?: string;
}

interface Notification {
  id: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  postId?: number;
}

// 날짜 형식화 함수
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

export function useMyPageData(user: User | null, apiBaseUrl: string) {
  // 마이페이지 상태
  const [ongoingSales, setOngoingSales] = useState<Sale[]>([]);
  const [originalSales, setOriginalSales] = useState<Sale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [ongoingPurchases, setOngoingPurchases] = useState<any[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const router = useRouter();

  // 트랜잭션 상태 카운트
  const [purchaseStatus, setPurchaseStatus] = useState<TransactionStatus>({
    취켓팅진행중: 0,
    판매중인상품: 0,
    취켓팅완료: 0,
    거래완료: 0,
    거래취소: 0,
  });

  const [saleStatus, setSaleStatus] = useState<TransactionStatus>({
    취켓팅진행중: 0,
    판매중인상품: 0,
    취켓팅완료: 0,
    거래완료: 0,
    거래취소: 0,
  });

  // 판매 목록 가져오기
  const fetchOngoingSales = async () => {
    if (!user) return;
    
    setIsLoadingSales(true);
    try {
      // 인증 토큰 가져오기
      let authToken = '';
      
      // 클라이언트 사이드에서만 localStorage에 접근
      if (typeof window !== 'undefined') {
        // Supabase 스토리지 키 찾기
        const supabaseKey = Object.keys(localStorage).find(key => 
          key.startsWith('sb-') && key.endsWith('-auth-token')
        );
        
        if (supabaseKey) {
          try {
            const supabaseData = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
            if (supabaseData.access_token) {
              authToken = supabaseData.access_token;
            }
          } catch (e) {
            console.error("Supabase 저장소 파싱 실패:", e);
          }
        }
        
        if (!authToken) {
          authToken = localStorage.getItem('token') || 
                     localStorage.getItem('access_token') || 
                     localStorage.getItem('supabase_token') || '';
        }
      }
      
      // 1. 판매자의 판매 상품에 대한 구매 정보 먼저 가져오기 (구매 현황 우선)
      const timestamp = Date.now();
      const userId = user?.id || '';
      console.log(`판매자 구매 내역 요청: ${apiBaseUrl}/api/seller-purchases?t=${timestamp}&userId=${userId}`);
      
      const purchaseResponse = await fetch(`${apiBaseUrl}/api/seller-purchases?t=${timestamp}&userId=${userId}`, {
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
      let salesWithPurchaseInfo: any[] = [];
      
      if (purchaseResponse.ok) {
        const purchaseData = await purchaseResponse.json();
        console.log("판매자 구매 내역 데이터:", purchaseData);
        console.log("🔥 DEBUG: purchaseData.purchases 길이:", purchaseData.purchases?.length);
        console.log("🔥 DEBUG: purchaseData.purchases 샘플:", purchaseData.purchases?.slice(0, 2));
        
        if (purchaseData.purchases && Array.isArray(purchaseData.purchases)) {
          // 게시글 ID별로 구매 정보를 인덱싱
          purchasesByPostId = purchaseData.purchases.reduce((acc: Record<number, any>, purchase: any) => {
            if (purchase.postId || purchase.post_id) {
              // post_id 또는 postId 필드 처리
              const postId = purchase.postId || purchase.post_id;
              acc[postId] = purchase;
              console.log("🔥 DEBUG: purchasesByPostId에 추가:", postId, purchase.transaction_type);
            }
            return acc;
          }, {});
          
          // 구매 정보가 있는 판매 상품 목록 생성 - 제안 기반 거래 포함
          salesWithPurchaseInfo = purchaseData.purchases.map((purchase: any) => {
            const postId = purchase.postId || purchase.post_id;
            const post = purchase.post || {};
            
            console.log("🔥 DEBUG: 판매 상품 처리 중:", {
              postId,
              title: post.title || purchase.ticket_title,
              transaction_type: purchase.transaction_type,
              status: purchase.status
            });
            
            // 판매 데이터 기본 형식 생성
            const status = purchase.status || 'ACTIVE';
            
            // 상태 텍스트 변환
            let statusText = "판매중";
            if (status === 'PENDING' || status === 'PENDING_PAYMENT' || status === 'PROCESSING') {
              statusText = "취켓팅 진행중";
            } else if (status === 'COMPLETED') {
              statusText = "취켓팅 완료";
            } else if (status === 'CONFIRMED') {
              statusText = "거래완료";
            } else if (status === 'CANCELLED') {
              statusText = "거래취소";
            }
            
            // 날짜 처리
            const dateStr = purchase.created_at || post.created_at || new Date().toISOString();
            const date = new Date(dateStr);
            const formattedDate = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
            
            // 가격 처리
            const priceValue = post.ticket_price || post.ticketPrice || post.price || purchase.total_price || 0;
            const formattedPrice = priceValue 
              ? `${Number(priceValue).toLocaleString()}원` 
              : '가격 정보 없음';
              
            // 정렬 우선순위
            let sortPriority = 0;
            if (statusText === "취켓팅 진행중") {
              sortPriority = 1;
            } else if (statusText === "판매중") {
              sortPriority = 2;
            } else if (statusText === "취켓팅 완료") {
              sortPriority = 3;
            } else if (statusText === "거래완료") {
              sortPriority = 4;
            } else if (statusText === "거래취소") {
              sortPriority = 5;
            }
              
            return {
              id: postId,
              title: post.title || post.eventName || purchase.ticket_title || '제목 없음',
              date: formattedDate,
              price: formattedPrice,
              status: statusText,
              isActive: status === 'ACTIVE',
              sortPriority: sortPriority,
              transaction_type: purchase.transaction_type || 'direct_purchase', // 거래 유형 추가
              orderNumber: purchase.order_number || purchase.orderNumber
            };
          });
        }
      }

      // 2. 판매 목록 API 호출 - 구매 정보가 없는 경우만 추가
      const salesTimestamp = Date.now();
      const response = await fetch(`${apiBaseUrl}/api/posts?userId=${user.id}&t=${salesTimestamp}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        // 구매 정보가 있는 판매 상품만이라도 표시
        if (salesWithPurchaseInfo.length > 0) {
          const sortedSalesData = [...salesWithPurchaseInfo].sort((a, b) => a.sortPriority - b.sortPriority);
          setOriginalSales(sortedSalesData);
          setOngoingSales(sortedSalesData);
          
          // 상태 카운트 계산
          const newSaleStatus = {
            취켓팅진행중: 0,
            판매중인상품: 0,
            취켓팅완료: 0,
            거래완료: 0,
            거래취소: 0,
          };
          
          salesWithPurchaseInfo.forEach(sale => {
            if (sale.status === '취켓팅 진행중') newSaleStatus.취켓팅진행중 += 1;
            else if (sale.status === '판매중') newSaleStatus.판매중인상품 += 1;
            else if (sale.status === '취켓팅 완료') newSaleStatus.취켓팅완료 += 1;
            else if (sale.status === '거래완료') newSaleStatus.거래완료 += 1;
            else if (sale.status === '거래취소') newSaleStatus.거래취소 += 1;
          });
          
          setSaleStatus(newSaleStatus);
        } else {
          throw new Error('판매 목록을 불러오는데 실패했습니다.');
        }
        return;
      }
        
      const data = await response.json();
      
      if (!data.posts || !Array.isArray(data.posts)) {
        // 구매 정보가 있는 판매 상품만이라도 표시
        if (salesWithPurchaseInfo.length > 0) {
          const sortedSalesData = [...salesWithPurchaseInfo].sort((a, b) => a.sortPriority - b.sortPriority);
          setOriginalSales(sortedSalesData);
          setOngoingSales(sortedSalesData);
        } else {
          setOngoingSales([]);
          setOriginalSales([]);
        }
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
      
      // 3. 구매 정보가 없는 판매 상품 처리
      // 이미 구매 정보가 있는 ID 목록 생성
      const existingPostIds = salesWithPurchaseInfo.map(sale => sale.id);
      
      // 구매 정보가 없는 상품만 필터링
      const remainingPosts = data.posts.filter((post: any) => !existingPostIds.includes(post.id));

      // API 응답을 화면에 표시할 형식으로 변환
      const additionalSales = remainingPosts.map((post: any) => {
        // 관련된 구매 확인
        const relatedPurchase = purchasesByPostId[post.id];
        const purchaseStatus = relatedPurchase?.status || '';
        const postStatus = post.status || '';
        
        // 상태에 따른 텍스트 표시
        let statusText = "판매중";
        
        // 구매 상태가 CONFIRMED인 경우 거래완료로 표시
        if (purchaseStatus === 'CONFIRMED') {
          statusText = "거래완료";
        } else if (postStatus === 'ACTIVE' || postStatus === '' || postStatus === undefined || postStatus === null) {
          statusText = "판매중";
        } else if (postStatus === 'PENDING' || postStatus === 'PENDING_PAYMENT' || postStatus === 'PROCESSING') {
          statusText = "취켓팅 진행중";
        } else if (postStatus === 'COMPLETED') {
          statusText = "취켓팅 완료";
        } else if (postStatus === 'CONFIRMED') {
          statusText = "거래완료";
        } else if (postStatus === 'CANCELLED') {
          statusText = "거래취소";
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
          sortPriority: sortPriority,
          transaction_type: 'direct_purchase', // 일반 게시물은 직접 판매
          orderNumber: relatedPurchase?.orderNumber
        };
      });
      
      // 4. 모든 판매 데이터 결합
      const combinedSales = [...salesWithPurchaseInfo, ...additionalSales];
      
      // 상태 카운트 계산
      combinedSales.forEach(sale => {
        if (sale.status === '취켓팅 진행중') newSaleStatus.취켓팅진행중 += 1;
        else if (sale.status === '판매중') newSaleStatus.판매중인상품 += 1;
        else if (sale.status === '취켓팅 완료') newSaleStatus.취켓팅완료 += 1;
        else if (sale.status === '거래완료') newSaleStatus.거래완료 += 1;
        else if (sale.status === '거래취소') newSaleStatus.거래취소 += 1;
      });
      
      // 상태에 따라 정렬
      const sortedSalesData = [...combinedSales].sort((a, b) => a.sortPriority - b.sortPriority);
      
      console.log("✅ 통합된 판매 데이터:", combinedSales);
      console.log("✅ 제안 기반 거래 포함된 판매 목록:", salesWithPurchaseInfo.length, "개");
      
      // 상태 업데이트
      setSaleStatus(newSaleStatus);
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

  // 구매 목록 가져오기
  const fetchOngoingPurchases = async () => {
    if (!user) return;
    
    setIsLoadingPurchases(true);
    try {
      // ✅ 판매 목록과 동일한 방식으로 토큰 추출
      let authToken = '';
      if (typeof window !== 'undefined') {
        const supabaseKey = Object.keys(localStorage).find(key => 
          key.startsWith('sb-') && key.endsWith('-auth-token')
        );
        if (supabaseKey) {
          try {
            const supabaseData = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
            if (supabaseData.access_token) {
              authToken = supabaseData.access_token;
            }
          } catch (e) {
            console.error("Supabase 저장소 파싱 실패:", e);
          }
        }
        if (!authToken) {
          authToken = localStorage.getItem('token') || 
                     localStorage.getItem('access_token') || 
                     localStorage.getItem('supabase_token') || '';
        }
      }
      
      // API 호출
      const timestamp = Date.now();
      const response = await fetch(`${apiBaseUrl}/api/purchase?userId=${user.id}&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('구매 목록을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      console.log("📋 마이페이지 구매 API 응답:", data);
      
      // ✅ API가 배열을 직접 반환하는 새로운 구조에 맞게 수정
      if (!Array.isArray(data)) {
        console.log("📭 구매 내역이 배열이 아닙니다:", typeof data);
        setOngoingPurchases([]);
        return;
      }
      
      processPurchaseData(data);
    } catch (error) {
      console.error('구매 목록 로딩 오류:', error);
      toast.error('구매 목록을 불러오는데 실패했습니다.');
      setOngoingPurchases([]);
    } finally {
      setIsLoadingPurchases(false);
    }
  };
  
  // 구매 데이터 처리 함수
  const processPurchaseData = (purchases: any[]) => {
    // 구매 상태에 따른 카운트
    const newPurchaseStatus = {
      취켓팅진행중: 0,
      판매중인상품: 0,
      취켓팅완료: 0,
      거래완료: 0,
      거래취소: 0,
    };
    
    if (!Array.isArray(purchases) || purchases.length === 0) {
      setOngoingPurchases([]);
      setPurchaseStatus(newPurchaseStatus);
      return;
    }
    
    // API 응답을 화면에 표시할 형식으로 변환
    const purchasesData = purchases.map((purchase: any) => {
      const purchaseStatus = purchase.status || '';
      
      // 상태 카운트 로직
      if (purchaseStatus === 'PENDING' || purchaseStatus === 'PENDING_PAYMENT' || purchaseStatus === 'PROCESSING') {
        newPurchaseStatus.취켓팅진행중 += 1;
      } else if (purchaseStatus === 'COMPLETED') {
        newPurchaseStatus.취켓팅완료 += 1;
      } else if (purchaseStatus === 'CONFIRMED') {
        newPurchaseStatus.거래완료 += 1;
      } else if (purchaseStatus === 'CANCELLED') {
        newPurchaseStatus.거래취소 += 1;
      }
      
      // 게시물 데이터 안전하게 접근
      const post = purchase.post || {};
      const seller = purchase.seller || {};
      
      // 제목 정보를 다양한 소스에서 찾기
      let title = '제목 없음';
      
      if (post.title) {
        title = post.title;
      } else if (post.eventName || post.event_name) {
        title = post.eventName || post.event_name;
      } else if (purchase.ticket_title || purchase.ticketTitle) {
        title = purchase.ticket_title || purchase.ticketTitle;
      } else if (purchase.event_name || purchase.eventName) {
        title = purchase.event_name || purchase.eventName;
      } else if (purchase.title) {
        title = purchase.title;
      }
      
      return {
        id: purchase.id,
        orderNumber: purchase.order_number || purchase.orderNumber,
        postId: purchase.post_id || purchase.postId,
        title: title,
        post: post,
        status: purchaseStatus,
        date: formatDate(post.eventDate, purchase.createdAt, purchase.created_at),
        price: typeof purchase.price === 'number' 
          ? `${purchase.price.toLocaleString()}원` 
          : purchase.price || `${(purchase.total_price || post.ticket_price || 0).toLocaleString()}원`,
        sellerName: seller.name || post.sellerName || '판매자 정보 없음'
      };
    });
    
    // 상태로 정렬
    const sortedPurchases = [...purchasesData].sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === 'PENDING' || status === 'PROCESSING') return 1;
        if (status === 'COMPLETED') return 2;
        if (status === 'CONFIRMED') return 3;
        if (status === 'CANCELLED') return 4;
        return 5;
      };
      
      return getPriority(a.status) - getPriority(b.status);
    });
    
    // 진행중인 구매만 필터링 (CONFIRMED 상태 제외)
    const ongoingPurchasesOnly = sortedPurchases.filter(p => p.status !== 'CONFIRMED');
    
    // 상태 업데이트
    setOngoingPurchases(ongoingPurchasesOnly);
    setPurchaseStatus(newPurchaseStatus);
  };

  // 알림 목록 가져오기
  const fetchNotifications = async () => {
    if (!user) return;
    
    setIsLoadingNotifications(true);
    try {
      // Supabase 세션에서 토큰 가져오기
      const supabase = createBrowserSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const response = await fetch(`${apiBaseUrl}/api/notifications?userId=${user?.id || ''}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('알림 목록을 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      
      if (!data.notifications || !Array.isArray(data.notifications)) {
        setNotifications([]);
        return;
      }
      
      // 알림 데이터 가공
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
        }
      ]);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // 알림 읽음 상태 업데이트
  const markNotificationAsRead = async (notificationId: number) => {
    try {
      // Supabase 세션에서 토큰 가져오기
      const supabase = createBrowserSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      const response = await fetch(`${apiBaseUrl}/api/notifications?userId=${user?.id || ''}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        credentials: 'include',
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
      
      // 토큰 가져오기
      let authToken = '';
      
      if (typeof window !== 'undefined') {
        const supabaseKey = Object.keys(localStorage).find(key => 
          key.startsWith('sb-') && key.endsWith('-auth-token')
        );
        
        if (supabaseKey) {
          const supabaseData = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
          authToken = supabaseData.access_token || '';
        }
        
        if (!authToken) {
          authToken = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
        }
      }
      
      // 현재 호스트 URL 가져오기
      const currentHost = typeof window !== 'undefined' ? window.location.origin : apiBaseUrl;
      
      // 요청 헤더 구성
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      // userId를 쿼리 파라미터로 추가
      const userId = user.id?.toString() || '';
      const url = `${currentHost}/api/posts/${postId}?userId=${userId}&t=${Date.now()}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('게시물 삭제에 실패했습니다.');
      }

      const data = await response.json();
      
      toast.success("게시물이 성공적으로 삭제되었습니다.");
      
      // UI에서 제거
      setOngoingSales(prev => prev.filter(sale => sale.id !== postId));
      setOriginalSales(prev => prev.filter(sale => sale.id !== postId));
      
      // 상태 카운트 업데이트
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
      toast.error('게시물 삭제 중 오류가 발생했습니다.');
    }
  };

  // 필터링 함수
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

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchOngoingPurchases();
      fetchOngoingSales();
    }
  }, [user]);

  return {
    sales: ongoingSales,
    originalSales,
    saleStatus,
    isLoadingSales,
    purchases: ongoingPurchases,
    purchaseStatus,
    isLoadingPurchases,
    notifications,
    isLoadingNotifications,
    showOnlyActive,
    markNotificationAsRead,
    deletePost,
    filterActiveSales,
    setShowOnlyActive,
    fetchOngoingSales,
    fetchOngoingPurchases,
    fetchNotifications
  };
} 