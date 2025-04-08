import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { supabase, createAuthedClient, createAdminClient } from '@/lib/supabase';

// BigInt를 문자열로 변환하는 함수
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertBigIntToString(obj[key]);
    }
    return newObj;
  }
  
  return obj;
}

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 캐시 방지 헤더
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

// 정규화된 문자열 ID로 변환하는 함수
function normalizeId(id: any): string {
  if (id === null || id === undefined) return '';
  return String(id).trim();
}

// GET 요청 처리 함수
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("거래 상세 정보 조회 API 호출됨");
    
    // 인증 헤더 로깅 (디버깅용)
    const authHeader = request.headers.get('authorization');
    console.log("인증 헤더:", authHeader ? `${authHeader.substring(0, 15)}...` : '없음');
    
    // URL 파라미터에서 ID 추출 및 검증 - params가 비동기 객체이므로 await 사용
    if (!params) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "유효하지 않은 요청: 파라미터가 제공되지 않았습니다." },
        { status: 400 }
      ));
    }
    
    // params.id에 접근하기 전에 전체 params 객체가 유효한지 확인
    const id = params.id;
    if (!id) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "유효하지 않은 요청: ID가 제공되지 않았습니다." },
        { status: 400 }
      ));
    }
    
    console.log(`요청된 거래 ID 또는 주문번호: ${id}`);
    
    // 인증 토큰을 직접 가져오기
    let token = "";
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim(); // 'Bearer ' 부분 제거 및 공백 제거
      console.log("요청에서 직접 토큰 추출됨");
    }
    
    // 인증된 사용자 확인
    let authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      console.log("인증되지 않은 사용자: 인증 헤더 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }
    
    console.log("인증된 사용자 ID:", authUser.id);
    
    // 토큰이 있으면 인증된 클라이언트 사용, 없으면 관리자 클라이언트 사용
    const supabaseClient = token 
      ? createAuthedClient(token) 
      : createAdminClient();
    
    console.log(token ? "인증된 클라이언트로 조회 시도" : "관리자 클라이언트로 조회 시도");
    
    let purchase;
    
    // ID가 숫자인지 확인
    const numericId = parseInt(id);
    let orderNumber = id;
    
    // 숫자 ID인 경우 주문번호 형식으로 변환
    if (!isNaN(numericId)) {
      orderNumber = `ORDER${numericId}`;
      console.log(`숫자 ID ${numericId}를 주문번호 형식 ${orderNumber}으로 변환`);
    }
    
    try {
      console.log(`주문번호로 조회: ${orderNumber}`);
      
      // 주문번호로 조회
      const { data: purchaseData, error } = await supabaseClient
        .from('purchases')
        .select(`
          *,
          post:posts(*),
          buyer:users!buyer_id(*),
          seller:users!seller_id(*)
        `)
        .eq('order_number', orderNumber)
        .single();
      
      if (error) {
        console.error("주문번호 쿼리 오류:", error);
        
        // ID로 직접 조회 시도 (fallback)
        if (!isNaN(numericId)) {
          console.log(`주문번호 조회 실패, ID로 직접 조회 시도: ${numericId}`);
          const { data: idBasedData, error: idError } = await supabaseClient
            .from('purchases')
            .select(`
              *,
              post:posts(*),
              buyer:users!buyer_id(*),
              seller:users!seller_id(*)
            `)
            .eq('id', numericId)
            .single();
            
          if (idError) {
            console.error("ID 기반 쿼리 오류:", idError);
            return addCorsHeaders(NextResponse.json(
              { success: false, message: "구매 정보를 찾을 수 없습니다." },
              { status: 404 }
            ));
          }
          
          purchase = idBasedData;
        } else {
          return addCorsHeaders(NextResponse.json(
            { success: false, message: "구매 정보를 찾을 수 없습니다." },
            { status: 404 }
          ));
        }
      } else {
        purchase = purchaseData;
      }
    } catch (error) {
      console.error("조회 과정 중 예외 발생:", error);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "구매 정보 조회 중 오류가 발생했습니다." },
        { status: 500 }
      ));
    }

    if (!purchase) {
      console.log(`구매 정보를 찾을 수 없음: ID 또는 주문번호 ${id}`);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "해당 구매 정보를 찾을 수 없습니다." },
        { status: 404 }
      ));
    }
    
    // 판매자 정보가 없을 경우 기본 정보 제공
    if (!purchase.seller) {
      console.log("판매자 정보가 없습니다. 기본 정보를 추가합니다.");
      purchase.seller = {
        id: purchase.seller_id || "알 수 없음",
        name: "판매자 정보 없음"
      } as any;
    }
    
    // 구매자 정보가 없을 경우 기본 정보 제공
    if (!purchase.buyer) {
      console.log("구매자 정보가 없습니다. 기본 정보를 추가합니다.");
      purchase.buyer = {
        id: purchase.buyer_id || "알 수 없음",
        name: "구매자 정보 없음"
      } as any;
    }
    
    // 접근 권한 확인 로직 개선 - 문자열로 정규화하여 비교
    const buyerId = normalizeId(purchase.buyer_id);
    const sellerId = normalizeId(purchase.seller_id);
    const userId = normalizeId(authUser.id);
    
    // 디버깅을 위해 ID 값과 타입 모두 로깅
    console.log("권한 확인:", { 
      buyerId, 
      sellerId, 
      userId,
      buyerIdType: typeof purchase.buyer_id,
      sellerIdType: typeof purchase.seller_id,
      userIdType: typeof authUser.id
    });
    
    // ID 비교 시 정규화된 문자열 사용
    if (buyerId !== userId && sellerId !== userId) {
      console.log(`접근 권한 없음: 사용자 ${userId}는 구매 ID ${id}에 접근할 수 없음`);
      console.log(`구매자 ID: ${buyerId}, 판매자 ID: ${sellerId}, 사용자 ID: ${userId}`);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "이 거래 정보를 볼 권한이 없습니다." },
        { status: 403 }
      ));
    }
    
    // 응답 데이터를 가공하여 post 필드가 없더라도 필요한 정보가 포함되도록 함
    const enhancedResponse = (purchase: any) => {
      const serializedPurchase = convertBigIntToString(purchase);
      
      // post 필드가 없는 경우 Purchase 모델의 필드로 보완
      if (!serializedPurchase.post) {
        // ticket_title 등의 필드가 Purchase에 저장되어 있으면 이를 사용하여 post 객체 생성
        if (serializedPurchase.ticket_title || serializedPurchase.event_date || serializedPurchase.event_venue || serializedPurchase.ticket_price) {
          serializedPurchase.post = {
            title: serializedPurchase.ticket_title || '제목 없음',
            event_date: serializedPurchase.event_date || null,
            event_venue: serializedPurchase.event_venue || null,
            ticket_price: serializedPurchase.ticket_price || null,
            author: serializedPurchase.seller || null
          };
          
          console.log('Purchase 필드로부터 post 정보 생성:', serializedPurchase.post);
        }
      }
      
      // 필드명 변환을 통한 호환성 유지 (Supabase는 snake_case, 기존 코드는 camelCase 사용)
      serializedPurchase.buyerId = serializedPurchase.buyer_id;
      serializedPurchase.sellerId = serializedPurchase.seller_id;
      serializedPurchase.postId = serializedPurchase.post_id;
      serializedPurchase.orderNumber = serializedPurchase.order_number;
      serializedPurchase.totalPrice = serializedPurchase.total_price;
      serializedPurchase.createdAt = serializedPurchase.created_at;
      serializedPurchase.updatedAt = serializedPurchase.updated_at;
      serializedPurchase.ticketTitle = serializedPurchase.ticket_title;
      serializedPurchase.ticketPrice = serializedPurchase.ticket_price;
      serializedPurchase.eventDate = serializedPurchase.event_date;
      serializedPurchase.eventVenue = serializedPurchase.event_venue;
      serializedPurchase.selectedSeats = serializedPurchase.selected_seats;
      serializedPurchase.imageUrl = serializedPurchase.image_url;
      
      return serializedPurchase;
    };

    // BigInt 값을 문자열로 변환
    const serializedPurchase = enhancedResponse(purchase);
    
    // 최종 확인 로그
    console.log("최종 응답에 포함된 판매자 정보:", serializedPurchase.seller ? {
      id: serializedPurchase.seller.id,
      name: serializedPurchase.seller.name
    } : "없음");
    
    // 성공 응답 반환
    return addCorsHeaders(NextResponse.json({
      success: true,
      purchase: serializedPurchase
    }, { status: 200 }));
    
  } catch (dbError) {
    console.error("데이터베이스 조회 오류:", dbError instanceof Error ? dbError.message : String(dbError));
    console.error("상세 오류:", dbError);
    
    return addCorsHeaders(
      NextResponse.json({ 
        success: false, 
        message: "데이터베이스 조회 중 오류가 발생했습니다.",
        error: String(dbError)
      }, { status: 500 })
    );
  }
}