import { Sale, Notification, TransactionStatus, Purchase } from "@/types/mypage";
import { API_BASE_URL, getAuthToken, getStatusText, getStatusColor, getStatusPriority } from "@/utils/mypage-utils";
import { toast } from "sonner";
import { fetchData } from '@/utils/api' // 새로운 API 유틸리티 가져오기

export interface StatusCount {
  '취켓팅진행중': number;
  '취켓팅완료': number;
  '거래완료': number;
  '거래취소': number;
}

// 판매 중인 상품 목록 가져오기
export const fetchOngoingSales = async (
  user: any,
  setSaleStatus: (status: TransactionStatus) => void,
  setOngoingSales: (sales: Sale[]) => void,
  setOriginalSales: (sales: Sale[]) => void,
  setIsLoadingSales: (isLoading: boolean) => void
) => {
  if (!user) return;
  
  setIsLoadingSales(true);
  try {
    // 인증 토큰 가져오기
    const authToken = getAuthToken();
    
    // 1. 판매자의 판매 상품에 대한 구매 정보 먼저 가져오기 (구매 현황 우선)
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
    let salesWithPurchaseInfo: any[] = [];
    
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
        
        // 구매 정보가 있는 판매 상품 목록 생성 - 구매 현황 방식과 유사
        salesWithPurchaseInfo = purchaseData.purchases.map((purchase: any) => {
          const postId = purchase.postId || purchase.post_id;
          const post = purchase.post || {};
          
          // 판매 데이터 기본 형식 생성
          const status = purchase.status || 'ACTIVE';
          const statusText = getStatusText(status);
          
          // 날짜 처리
          const dateStr = purchase.created_at || post.created_at || new Date().toISOString();
          const date = new Date(dateStr);
          const formattedDate = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
          
          // 가격 처리
          const priceValue = post.ticket_price || post.ticketPrice || post.price || 0;
          const formattedPrice = priceValue 
            ? `${Number(priceValue).toLocaleString()}원` 
            : '가격 정보 없음';
            
          return {
            id: postId,
            title: post.title || post.eventName || purchase.ticket_title || '제목 없음',
            date: formattedDate,
            price: formattedPrice,
            ticket_price: priceValue,
            status: statusText,
            isActive: status === 'ACTIVE',
            sortPriority: getStatusPriority(status),
            purchaseInfo: {
              id: purchase.id,
              status: purchase.status,
              originalStatus: status
            }
          };
        });
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
    
    // 2. 판매 목록 API 호출 - 구매 정보가 없는 경우만 추가
    const salesTimestamp = Date.now();
    console.log("판매 목록 불러오기 시도... 사용자 ID:", user.id);
    const response = await fetch(`${API_BASE_URL}/api/posts?userId=${user.id}&t=${salesTimestamp}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
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
      // 구매 정보가 있는 판매 상품 처리
      if (salesWithPurchaseInfo.length > 0) {
        processAndSetSalesData(salesWithPurchaseInfo, setSaleStatus, setOriginalSales, setOngoingSales);
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
    
<<<<<<< HEAD
    // 구매 정보가 없는 상품만 필터링
    const remainingPosts = data.posts.filter((post: any) => !existingPostIds.includes(post.id));
=======
    const purchaseResponse = await fetchData(`${API_BASE_URL}/api/seller-purchases?t=${timestamp}&userId=${userId}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
>>>>>>> 02455941ea48b4852a803f920f801b393d47d7cb
    
    // 구매 정보가 없는 상품 처리
    const additionalSales = remainingPosts.map((post: any, idx: number) => {
      // content 필드에서 가격 정보 추출 (JSON 파싱)
      let parsedContent: any = {};
      try {
        if (post.content && typeof post.content === 'string') {
          parsedContent = JSON.parse(post.content);
        }
      } catch (e) {
        console.warn('❗ content 파싱 오류:', post.id, e);
      }
      
      // status는 post.status를 직접 사용 (구매 정보가 없음)
      const status = post.status || 'ACTIVE';
      const isActive = status === 'ACTIVE';
      const statusText = getStatusText(status);
      
      // 날짜 처리
      const dateStr = post.created_at || post.updatedAt || post.createdAt || new Date().toISOString();
      const date = new Date(dateStr);
      const formattedDate = `${date.getFullYear()}.${(date.getMonth()+1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
      
      // 가격 처리
      const contentPrice = parsedContent?.price;
      const priceValue = contentPrice || post.ticket_price || post.ticketPrice || post.price || 0;
      const formattedPrice = priceValue 
        ? `${Number(priceValue).toLocaleString()}원` 
        : '가격 정보 없음';
      
      return {
        ...post, // 기존 필드 유지
        id: post.id,
        title: post.title || post.eventName || '제목 없음',
        date: formattedDate,
        price: formattedPrice,
        ticket_price: priceValue,
        status: statusText,
        isActive,
        sortPriority: getStatusPriority(status),
        parsedContent: parsedContent,
        rawPrice: contentPrice,
        purchaseInfo: null // 구매 정보 없음
      };
    });
    
    // 4. 모든 판매 데이터 결합
    const combinedSales = [...salesWithPurchaseInfo, ...additionalSales];
    
    // 5. 데이터 처리 및 상태 업데이트
    processAndSetSalesData(combinedSales, setSaleStatus, setOriginalSales, setOngoingSales);
  } catch (error) {
    console.error('판매 목록 로딩 오류:', error);
    toast.error('판매 목록을 불러오는데 실패했습니다.');
    // 더미 데이터로 대체
    setOngoingSales([
      { id: 2, title: "웃는 남자 [더미 데이터]", date: "2024-01-09", price: "110,000원", status: "취켓팅진행중", isActive: false, sortPriority: 1 },
      { id: 1, title: "아이브 팬미팅 [더미 데이터]", date: "2024-04-05", price: "88,000원", status: "판매중", isActive: true, sortPriority: 2 },
    ]);
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
    console.log("판매 데이터가 없습니다");
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
    
    // 상품별 상태 로그
    console.log(`[LOG][상품] id=${sale.id}, title=${sale.title}, statusText=${statusText}, isActive=${sale.isActive}, 누적카운트:`, { ...newSaleStatus });
  });
  
  // 상태에 따라 정렬
  const sortedSalesData = [...sales].sort((a, b) => a.sortPriority - b.sortPriority);
  
  // 거래완료 상품 제외
  const filteredSales = sortedSalesData.filter(item => item.status !== '거래완료');
  
  // 최종 카운트 및 상품 개수 로그
  console.log("[LOG] 최종 판매중인 상품 카운트:", newSaleStatus.판매중인상품);
  console.log("[LOG] 최종 상태별 카운트:", { ...newSaleStatus });
  console.log("[LOG] 최종 필터링된 상품 개수:", filteredSales.length);
  
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
    console.log("📣 fetchOngoingPurchases 호출됨, 사용자 ID:", user.id);
    
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

    console.log("📥 구매 데이터 API 응답 상태:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("구매 API 오류 응답:", errorText);
      throw new Error('구매 목록을 불러오는데 실패했습니다.');
    }

    const data = await response.json();

    if (!data.purchases || !Array.isArray(data.purchases)) {
      console.error("응답에 purchases 배열이 없습니다:", data);
      setOngoingPurchases([]);
      return;
    }

    console.log("✅ 구매 데이터:", data.purchases);

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
    console.error("구매 목록 로딩 오류:", error);
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
    console.log("구매 데이터가 없거나 유효하지 않습니다", purchases);
    setOngoingPurchases([]);
    setPurchaseStatus(newPurchaseStatus);
    return;
  }
  
  // API 응답을 화면에 표시할 형식으로 변환
  const purchasesData = purchases.map((purchase: any) => {
    // 구매 상태에 따라 카운트 증가
    const purchaseStatus = purchase.status || '';
    const statusText = getStatusText(purchaseStatus);
    
    console.log(`구매 데이터 처리: ID=${purchase.id}, 상태=${purchaseStatus}, 변환된 상태=${statusText}`);
    
    // 상태 카운트 로직 - getStatusText 함수 사용
    if (statusText === '취켓팅진행중') {
      newPurchaseStatus.취켓팅진행중 += 1;
      console.log(`[구매 카운트] ID ${purchase.id}: 취켓팅진행중 (+1)`);
    } else if (statusText === '취켓팅완료') {
      newPurchaseStatus.취켓팅완료 += 1;
      console.log(`[구매 카운트] ID ${purchase.id}: 취켓팅완료 (+1)`);
    } else if (statusText === '거래완료') {
      newPurchaseStatus.거래완료 += 1;
      console.log(`[구매 카운트] ID ${purchase.id}: 거래완료 (+1)`);
    } else if (statusText === '거래취소') {
      newPurchaseStatus.거래취소 += 1;
      console.log(`[구매 카운트] ID ${purchase.id}: 거래취소 (+1)`);
    } else if (statusText === '판매중') {
      newPurchaseStatus.판매중인상품 += 1;
      console.log(`[구매 카운트] ID ${purchase.id}: 판매중인상품 (+1)`);
    } else {
      console.log(`[구매 카운트] 알 수 없는 상태: ${purchase.id}, status=${purchaseStatus}, 변환된 상태=${statusText}`);
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
      } else if (purchase.title) {
        title = purchase.title;
        console.log(`[제목] purchase.title에서 찾음: ${title}`);
      }
    }
    
    console.log(`구매 항목 최종 제목: "${title}"`);
    
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
  
  console.log("최종 구매 상태 카운트:", newPurchaseStatus);
  
  // 정렬: 취켓팅 진행중 > 취켓팅 완료 > 거래완료 > 거래취소
  const sortedPurchases = [...purchasesData].sort((a, b) => a.sortPriority - b.sortPriority);
  
  console.log("정렬된 구매 데이터:", sortedPurchases);
  
  // ✅ CONFIRMED 상태의 구매 항목 필터링 (진행중인 구매만 표시)
  const ongoingPurchasesOnly = sortedPurchases.filter((p) => p.status !== '거래완료');
  console.log("진행중인 구매 데이터 (CONFIRMED 제외):", ongoingPurchasesOnly);
  
  // 상태 업데이트 - 진행중인 구매만 표시
  setOngoingPurchases(ongoingPurchasesOnly);
  setPurchaseStatus(newPurchaseStatus);
  
  console.log("구매 데이터 로딩 완료:", sortedPurchases.length, "개 항목 중", ongoingPurchasesOnly.length, "개 진행중");
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
    console.error('알림 상태 업데이트 오류:', error);
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
    
    console.log("게시물 삭제 요청:", postId, "사용자 ID:", user.id);
    
    // 현재 실행 중인 포트 확인 및 사용
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    console.log("현재 접속 URL:", currentUrl);
    
    // 현재 호스트 URL 가져오기 (포트 포함)
    const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
    console.log("현재 호스트:", currentHost);
    
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
    console.error('게시물 삭제 오류:', error);
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
    
    console.log("구매 거래 취소 요청:", orderNumber, "사용자 ID:", user.id);
    
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
    
    console.log("취소 요청 URL:", url);
    
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
      console.error("응답 파싱 오류:", e);
      responseData = { success: false, message: "서버 응답을 처리할 수 없습니다." };
    }
    
    console.log("취소 응답:", responseData);
    
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
    console.error('거래 취소 오류:', error);
    toast.error(error instanceof Error ? error.message : "거래 취소 중 오류가 발생했습니다.");
    return false;
  }
}; 