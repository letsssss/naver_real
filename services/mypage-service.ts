import { Sale, Notification, TransactionStatus, Purchase } from "@/types/mypage";
import { API_BASE_URL, getStatusText, getStatusColor, getStatusPriority } from "@/utils/mypage-utils";
import { toast } from "sonner";
import { getSupabaseClient } from '@/lib/supabase';

// 데이터베이스 타입 정의
interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  profile_image: string;
  rating: number;
  successful_sales: number;
  response_rate: number;
}

interface DatabasePost {
  id: number;
  title: string;
  content: string;
  status: string;
  ticket_price: number;
  created_at: string;
  category: string;
  author_id: string;
}

interface DatabasePurchase {
  id: number;
  status: string;
  total_price: number;
  created_at: string;
  seller_id: string;
  order_number: string;
  post: DatabasePost;
}

interface DatabaseProposal {
  id: number;
  status: string;
  price: number;
  message: string;
  created_at: string;
  proposer_id: string;
  post: DatabasePost;
  users: DatabaseUser;
}

// Supabase 응답 타입
type SupabasePurchaseResponse = {
  id: number;
  status: string;
  total_price: number;
  created_at: string;
  seller_id: string;
  post: DatabasePost;
}

export interface StatusCount {
  '취켓팅진행중': number;
  '취켓팅완료': number;
  '거래완료': number;
  '거래취소': number;
}

// Supabase 세션 토큰 가져오기
const getSupabaseSession = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Supabase 세션 키 찾기
    const supabaseKey = Object.keys(localStorage).find(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    );
    
    if (supabaseKey) {
      const sessionStr = localStorage.getItem(supabaseKey);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        return session?.access_token || null;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};

// 인증 토큰 가져오기 함수
const getAuthToken = () => {
  const supabaseToken = getSupabaseSession();
  if (supabaseToken) return supabaseToken;
  
  // 기존 토큰 체크 (fallback)
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || '';
  }
  return '';
};

// 판매 중인 상품 목록 가져오기
export const fetchOngoingSales = async (
  user: any,
  setSaleStatus: (status: TransactionStatus) => void,
  setOngoingSales: (sales: Sale[]) => void,
  setOriginalSales: (sales: Sale[]) => void,
  setIsLoadingSales: (isLoading: boolean) => void
) => {
  if (!user) {
    return;
  }
  
  setIsLoadingSales(true);
  
  try {
    const supabaseClient = await getSupabaseClient();
    
    // 1. 판매자의 판매 상품에 대한 구매 정보 먼저 가져오기
    const { data: purchaseData, error: purchaseError } = await supabaseClient
      .from('purchases')
      .select(`
        id,
        status,
        total_price,
        created_at,
        seller_id,
        order_number,
        post:posts (
          id,
          title,
          content,
          status,
          ticket_price,
          created_at,
          category
        )
      `)
      .eq('seller_id', user.id);

    if (purchaseError) {
      throw purchaseError;
    }

    let purchasesByPostId: Record<number, DatabasePurchase> = {};
    let salesWithPurchaseInfo: Sale[] = [];
    
    if (purchaseData) {
      // 게시글 ID별로 구매 정보를 인덱싱
      purchasesByPostId = (purchaseData as unknown as DatabasePurchase[]).reduce((acc, purchase) => {
        if (purchase.post?.id) {
          acc[purchase.post.id] = purchase;
        }
        return acc;
      }, {} as Record<number, DatabasePurchase>);
      
      // 구매 정보가 있는 판매 상품 목록 생성
      salesWithPurchaseInfo = (purchaseData as unknown as DatabasePurchase[])
        .filter(purchase => purchase.post)
        .map(purchase => {
          const post = purchase.post;
          const status = purchase.status || 'ACTIVE';
          const statusText = getStatusText(status);
          
          const date = new Date(purchase.created_at);
          const formattedDate = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
          
          const priceValue = post.ticket_price || 0;
          const formattedPrice = priceValue 
            ? `${Number(priceValue).toLocaleString()}원`
            : '가격 정보 없음';
            
          return {
            id: post.id,
            title: post.title || '제목 없음',
            date: formattedDate,
            price: formattedPrice,
            ticket_price: priceValue,
            status: statusText,
            isActive: status === 'ACTIVE',
            sortPriority: getStatusPriority(status),
            purchaseInfo: {
              id: purchase.id,
              status: purchase.status,
              originalStatus: status,
              orderNumber: purchase.order_number
            }
          };
        });
    }
    
    // 2. 판매 목록 가져오기
    const { data: postsData, error: postsError } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });

    if (postsError) {
      throw postsError;
    }

    if (!postsData) {
      // 구매 정보가 있는 판매 상품 처리
      if (salesWithPurchaseInfo.length > 0) {
        processAndSetSalesData(salesWithPurchaseInfo, setSaleStatus, setOriginalSales, setOngoingSales);
      } else {
        setOngoingSales([]);
        setOriginalSales([]);
      }
      return;
    }
    
    // 3. 제안 기반 거래 확인
    const { data: proposalData, error: proposalError } = await supabaseClient
      .from('proposals')
      .select(`
        id,
        status,
        proposed_price,
        message,
        created_at,
        proposer_id,
        post:posts (
          id,
          title,
          content,
          status,
          category
        )
      `)
      .eq('proposer_id', user.id)
      .eq('status', 'accepted');

    if (proposalError) {
      // 제안 조회 실패는 무시하고 계속 진행
    }

    // 제안이 있는 경우 사용자 정보 가져오기
    let acceptedProposalPosts: any[] = [];
    if (proposalData) {
      // 사용자 정보 가져오기
      const userIds = proposalData.map(proposal => proposal.proposer_id).filter(Boolean);
      
      let usersData: any[] = [];
      if (userIds.length > 0) {
        const { data: queryUsersData } = await supabaseClient
          .from('users')
          .select('id, name, email, profile_image, rating, successful_sales, response_rate')
          .in('id', userIds);
        
        usersData = queryUsersData || [];
      }

      // 사용자 정보를 Map으로 변환
      const usersMap = new Map(
        usersData.map(user => [user.id, user])
      );

      acceptedProposalPosts = (proposalData as unknown as DatabaseProposal[])
        .filter(proposal => proposal.post && proposal.post.category === 'TICKET_REQUEST')
        .map(proposal => ({
          ...proposal.post,
          proposed_price: proposal.price,
          proposal_status: proposal.status,
          proposal_id: proposal.id,
          proposal_message: proposal.message,
          user: usersMap.get(proposal.proposer_id) || null
        }));
    }

    // 모든 데이터 통합 및 처리
    const allSales = [
      ...salesWithPurchaseInfo,
      ...postsData.map((post: any) => {
        const date = new Date(post.created_at);
        const formattedDate = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
        
        return {
          id: post.id,
          title: post.title,
          date: formattedDate,
          price: post.ticket_price ? `${Number(post.ticket_price).toLocaleString()}원` : '가격 정보 없음',
          ticket_price: post.ticket_price,
          status: getStatusText(post.status),
          isActive: post.status === 'ACTIVE',
          sortPriority: getStatusPriority(post.status),
          category: post.category
        };
      }),
      ...acceptedProposalPosts
    ];

    processAndSetSalesData(allSales, setSaleStatus, setOriginalSales, setOngoingSales);

  } catch (error) {
    toast.error('판매 목록을 불러오는데 실패했습니다.');
    setOngoingSales([]);
    setOriginalSales([]);
  } finally {
    setIsLoadingSales(false);
  }
};

// 판매 데이터 처리 함수 (구매 데이터 처리 함수와 유사한 구조)
export const processAndSetSalesData = (
  sales: any[],
  setSaleStatus: (status: TransactionStatus) => void,
  setOriginalSales: (sales: Sale[]) => void,
  setOngoingSales: (sales: Sale[]) => void
) => {
  // 상태 카운트 초기화
  const newSaleStatus = {
    취켓팅진행중: 0,
    판매중인상품: 0,
    취켓팅완료: 0,
    거래완료: 0,
    거래취소: 0,
  };
  
  // 배열이 비어있는 경우
  if (!Array.isArray(sales) || sales.length === 0) {
    setOngoingSales([]);
    setOriginalSales([]);
    setSaleStatus(newSaleStatus);
    return;
  }
  
  // 상태 카운트 계산
  sales.forEach(sale => {
    const statusText = sale.status;
    if (statusText === '취켓팅진행중') {
      newSaleStatus.취켓팅진행중 += 1;
    } else if (statusText === '취켓팅완료') {
      newSaleStatus.취켓팅완료 += 1;
    } else if (statusText === '거래완료') {
      newSaleStatus.거래완료 += 1;
    } else if (statusText === '거래취소') {
      newSaleStatus.거래취소 += 1;
    } else if (statusText === '판매중') {
      newSaleStatus.판매중인상품 += 1;
    }
  });
  
  // 상태에 따라 정렬
  const sortedSalesData = [...sales].sort((a, b) => a.sortPriority - b.sortPriority);
  
  // 거래완료 상품 제외
  const filteredSales = sortedSalesData.filter(item => item.status !== '거래완료');
  
  // 상태 업데이트
  setSaleStatus(newSaleStatus);
  setOriginalSales(filteredSales);
  setOngoingSales(filteredSales);
}

// 구매 중인 상품 목록 가져오기
export const fetchOngoingPurchases = async (
  user: any,
  setPurchaseStatus: (status: TransactionStatus) => void,
  setOngoingPurchases: (purchases: Purchase[]) => void,
  setIsLoadingPurchases: (isLoading: boolean) => void
) => {
  if (!user) return;
  
  setIsLoadingPurchases(true);
  try {
    // ✅ 토큰 가져오기 (판매 목록과 동일하게 처리)
    const authToken = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authToken ? `Bearer ${authToken}` : '',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };

    const purchaseTimestamp = Date.now();
    const response = await fetch(`${API_BASE_URL}/api/purchase?userId=${user.id}&t=${purchaseTimestamp}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('구매 목록을 불러오는데 실패했습니다.');
    }

    const data = await response.json();

    if (!data.purchases || !Array.isArray(data.purchases)) {
      setOngoingPurchases([]);
      return;
    }

    // ✅ CONFIRMED 제외하고 표시할 구매 목록 필터링
    const newPurchaseStatus = {
      취켓팅진행중: 0,
      판매중인상품: 0,
      취켓팅완료: 0,
      거래완료: 0,
      거래취소: 0,
    };

    const processed = data.purchases.map((purchase: any) => {
      const status = purchase.status || "";
      const statusText = getStatusText(status);
      
      // 상태 카운트 - getStatusText 함수 사용
      if (statusText === '취켓팅진행중') {
        newPurchaseStatus.취켓팅진행중 += 1;
      } else if (statusText === '취켓팅완료') {
        newPurchaseStatus.취켓팅완료 += 1;
      } else if (statusText === '거래완료') {
        newPurchaseStatus.거래완료 += 1;
      } else if (statusText === '거래취소') {
        newPurchaseStatus.거래취소 += 1;
      } else if (statusText === '판매중') {
        newPurchaseStatus.판매중인상품 += 1;
      }

      return {
        id: purchase.id,
        orderNumber: purchase.order_number || purchase.orderNumber,
        title: purchase.post?.title || purchase.title || purchase.ticket_title || purchase.event_name || "제목 없음",
        post: purchase.post,
        date: purchase.created_at || "날짜 없음",
        price: (purchase.total_price || purchase.post?.ticket_price || 0).toLocaleString() + "원",
        status: statusText,
        sortPriority: getStatusPriority(status),
        seller: purchase.seller?.name || "판매자 정보 없음"
      };
    });

    // 상태에 따라 정렬 - getStatusPriority 함수 사용
    const sortedPurchases = [...processed].sort((a, b) => a.sortPriority - b.sortPriority);
    
    // CONFIRMED 상태의 구매 항목 필터링
    const filtered = sortedPurchases.filter(p => p.status !== '거래완료');

    setOngoingPurchases(filtered);
    setPurchaseStatus(newPurchaseStatus);
  } catch (error) {
    toast.error('구매 목록을 불러오는데 실패했습니다.');
    setOngoingPurchases([]);
  } finally {
    setIsLoadingPurchases(false);
  }
};

// 구매 데이터 처리 함수
export const processPurchaseData = (
  purchases: any[], 
  setPurchaseStatus: (status: TransactionStatus) => void, 
  setOngoingPurchases: (purchases: Purchase[]) => void
) => {
  // 구매 상태에 따른 카운트
  const newPurchaseStatus = {
    취켓팅진행중: 0,
    판매중인상품: 0,
    취켓팅완료: 0,
    거래완료: 0,
    거래취소: 0,
  };
  
  // 배열이 아니거나 비어있는 경우 빈 배열로 처리
  if (!Array.isArray(purchases) || purchases.length === 0) {
    setOngoingPurchases([]);
    setPurchaseStatus(newPurchaseStatus);
    return;
  }
  
  // API 응답을 화면에 표시할 형식으로 변환
  const purchasesData = purchases.map((purchase: any) => {
    // 구매 상태에 따라 카운트 증가
    const purchaseStatus = purchase.status || '';
    const statusText = getStatusText(purchaseStatus);
    
    // 상태 카운트 로직 - getStatusText 함수 사용
    if (statusText === '취켓팅진행중') {
      newPurchaseStatus.취켓팅진행중 += 1;
    } else if (statusText === '취켓팅완료') {
      newPurchaseStatus.취켓팅완료 += 1;
    } else if (statusText === '거래완료') {
      newPurchaseStatus.거래완료 += 1;
    } else if (statusText === '거래취소') {
      newPurchaseStatus.거래취소 += 1;
    } else if (statusText === '판매중') {
      newPurchaseStatus.판매중인상품 += 1;
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
      } else if (post.eventName || post.event_name) {
        title = post.eventName || post.event_name;
      }
    }
    
    // 2. purchase 객체 자체에서 찾기
    if (title === '제목 없음') {
      if (purchase.ticket_title) {
        title = purchase.ticket_title;
      } else if (purchase.ticketTitle) {
        title = purchase.ticketTitle;
      } else if (purchase.event_name) {
        title = purchase.event_name;
      } else if (purchase.eventName) {
        title = purchase.eventName;
      } else if (purchase.title) {
        title = purchase.title;
      }
    }
    
    return {
      id: purchase.id,
      order_number: purchase.order_number || purchase.orderNumber,
      orderNumber: purchase.order_number || purchase.orderNumber,
      postId: purchase.post_id || purchase.postId,
      title: title,
      // 원본 데이터도 보존
      ticketTitle: purchase.ticket_title || purchase.ticketTitle,
      eventName: purchase.event_name || post.event_name || post.eventName,
      post: post,
      status: statusText,
      seller: seller.name || '판매자 정보 없음',
      sellerId: purchase.seller_id || seller.id,
      quantity: purchase.quantity || 1,
      price: purchase.total_price || post.ticket_price || post.ticketPrice || 0,
      createdAt: purchase.created_at || new Date().toISOString(),
      updatedAt: purchase.updated_at || purchase.created_at || new Date().toISOString(),
      sortPriority: getStatusPriority(purchaseStatus)
    };
  });
  
  // 정렬: 취켓팅 진행중 > 취켓팅 완료 > 거래완료 > 거래취소
  const sortedPurchases = [...purchasesData].sort((a, b) => a.sortPriority - b.sortPriority);
  
  // ✅ CONFIRMED 상태의 구매 항목 필터링 (진행중인 구매만 표시)
  const ongoingPurchasesOnly = sortedPurchases.filter((p) => p.status !== '거래완료');
  
  // 상태 업데이트 - 진행중인 구매만 표시
  setOngoingPurchases(ongoingPurchasesOnly);
  setPurchaseStatus(newPurchaseStatus);
};

// 알림 목록 가져오기
export const fetchNotifications = async (
  user: any,
  setNotifications: (notifications: Notification[]) => void,
  setIsLoadingNotifications: (isLoading: boolean) => void
) => {
  if (!user) return;
  
  setIsLoadingNotifications(true);
  try {
    // 인증 토큰 가져오기
    const authToken = getAuthToken();
    
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
export const markNotificationAsRead = async (
  user: any,
  notificationId: number,
  setNotifications: (updater: (prev: Notification[]) => Notification[]) => void
) => {
  try {
    // 인증 토큰 가져오기
    const authToken = getAuthToken();
    
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
    toast.error('알림 상태를 업데이트하는데 실패했습니다.');
  }
};

// 게시물 삭제 함수
export const deletePost = async (
  user: any,
  postId: number,
  router: any,
  setOngoingSales: (updater: (prev: Sale[]) => Sale[]) => void, 
  setOriginalSales: (updater: (prev: Sale[]) => Sale[]) => void,
  setSaleStatus: (updater: (prev: TransactionStatus) => TransactionStatus) => void
) => {
  try {
    if (!user || !user.id) {
      toast.error("사용자 인증 정보가 없습니다. 다시 로그인해주세요.");
      router.push("/login?callbackUrl=/mypage");
      return;
    }
    
    // 현재 실행 중인 포트 확인 및 사용
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    
    // 현재 호스트 URL 가져오기 (포트 포함)
    const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
    
    // 인증 토큰 가져오기
    const authToken = getAuthToken();
    
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
    let url = `${currentHost}/api/posts/${postId}?userId=${userId}&t=${Date.now()}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    
    // 응답이 JSON이 아닌 경우 처리
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("서버에서 유효한 응답을 받지 못했습니다.");
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || '게시물 삭제에 실패했습니다.');
    }
    
    toast.success("게시물이 성공적으로 삭제되었습니다.");
    
    // UI에서 제거 (ongoingSales와 originalSales 모두 업데이트)
    setOngoingSales(prev => prev.filter(sale => sale.id !== postId));
    setOriginalSales(prev => prev.filter(sale => sale.id !== postId));
    
    // 상태 카운트 업데이트 (해당 항목의 상태에 따라)
    setSaleStatus(prev => {
      // 기존 상태를 복사
      const newStatus = { ...prev };
      // 원래 리스트에서 삭제된 항목 찾기
      const deletedItem = prev as any;
      
      if (deletedItem) {
        if (deletedItem.status === "판매중" && deletedItem.isActive) {
          newStatus.판매중인상품 = Math.max(0, newStatus.판매중인상품 - 1);
        } else if (deletedItem.status === "취켓팅진행중") {
          newStatus.취켓팅진행중 = Math.max(0, newStatus.취켓팅진행중 - 1);
        } else if (deletedItem.status === "취켓팅완료") {
          newStatus.취켓팅완료 = Math.max(0, newStatus.취켓팅완료 - 1);
        } else if (deletedItem.status === "거래완료") {
          newStatus.거래완료 = Math.max(0, newStatus.거래완료 - 1);
        } else if (deletedItem.status === "거래취소") {
          newStatus.거래취소 = Math.max(0, newStatus.거래취소 - 1);
        }
      }
      
      return newStatus;
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "게시물 삭제 중 오류가 발생했습니다.");
  }
};

export const getPurchaseStatusCount = (purchases: Purchase[]): StatusCount => {
  const statusCount: StatusCount = {
    '취켓팅진행중': 0,
    '취켓팅완료': 0,
    '거래완료': 0,
    '거래취소': 0
  };

  purchases.forEach(purchase => {
    const status = getStatusText(purchase.status);
    if (status in statusCount) {
      statusCount[status as keyof StatusCount]++;
    }
  });

  return statusCount;
};

export const getPurchaseStatusText = (status: string): string => {
  return getStatusText(status);
};

export const getPurchaseStatusColor = (status: string): string => {
  return getStatusColor(status);
};

// 판매 현황 카운트 함수 추가
export const getSaleStatusCount = (sales: Sale[]): StatusCount => {
  const statusCount: StatusCount = {
    '취켓팅진행중': 0,
    '취켓팅완료': 0,
    '거래완료': 0,
    '거래취소': 0
  };

  sales.forEach(sale => {
    const status = getStatusText(sale.status);
    if (status in statusCount) {
      statusCount[status as keyof StatusCount]++;
    }
  });

  return statusCount;
};

// 구매 거래 취소 함수
export const cancelPurchase = async (
  user: any,
  orderNumber: string,
  setOngoingPurchases: (updater: (prev: Purchase[]) => Purchase[]) => void,
  setPurchaseStatus: (updater: (prev: TransactionStatus) => TransactionStatus) => void
) => {
  try {
    if (!user || !user.id) {
      toast.error("사용자 인증 정보가 없습니다. 다시 로그인해주세요.");
      return false;
    }
    
    // 현재 호스트 URL 가져오기 (포트 포함)
    const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
    
    // 인증 토큰 가져오기
    const authToken = getAuthToken();
    
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
    let url = `${currentHost}/api/purchase/cancel?orderNumber=${orderNumber}&userId=${userId}&t=${Date.now()}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include', // 쿠키 포함
      body: JSON.stringify({
        orderNumber,
        reason: "판매자가 3일 내에 티켓을 확보하지 못했습니다.",
        status: "CANCELLED" // 상태 필드 추가
      })
    });
    
    // 응답 처리
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      responseData = { success: false, message: "서버 응답을 처리할 수 없습니다." };
    }
    
    if (!response.ok) {
      throw new Error(responseData.message || responseData.error || '거래 취소에 실패했습니다.');
    }
    
    toast.success("거래가 성공적으로 취소되었습니다.");
    
    // UI에서 상태 업데이트
    setOngoingPurchases(prev => 
      prev.map(purchase => 
        purchase.orderNumber === orderNumber
          ? { ...purchase, status: "CANCELLED", statusText: "거래취소" }
          : purchase
      )
    );
    
    // 상태 카운트 업데이트
    setPurchaseStatus(prev => {
      // 기존 상태를 복사
      const newStatus = { ...prev };
      // 취켓팅진행중 카운트 감소, 거래취소 카운트 증가
      newStatus.취켓팅진행중 = Math.max(0, newStatus.취켓팅진행중 - 1);
      newStatus.거래취소 = newStatus.거래취소 + 1;
      return newStatus;
    });
    
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "거래 취소 중 오류가 발생했습니다.");
    return false;
  }
};

export const confirmPurchase = async (
  orderNumber: string,
  setOngoingPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>,
  setPurchaseStatus: React.Dispatch<React.SetStateAction<TransactionStatus>>
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/purchase/${orderNumber}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'CONFIRMED' })
    });

    if (!response.ok) {
      throw new Error('구매 확정에 실패했습니다.');
    }

    const data = await response.json();

    // UI 업데이트
    setOngoingPurchases(prev => prev.filter(purchase => purchase.orderNumber !== orderNumber));

    // 상태 카운트 업데이트
    setPurchaseStatus(prev => ({
      ...prev,
      취켓팅완료: Math.max(0, prev.취켓팅완료 - 1),
      거래완료: prev.거래완료 + 1
    }));

    return data;
  } catch (error) {
    throw error;
  }
}; 