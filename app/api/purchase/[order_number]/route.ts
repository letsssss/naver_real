export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // ✅ 캐싱 막기
export const preferredRegion = 'auto';  // ✅ 자동 라우팅

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { sendOrderConfirmedNotification } from '@/services/kakao-notification-service'

// ✅ CORS 헤더를 상수로 정의하여 중복 제거
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// CORS Preflight 요청 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  const { order_number } = params
  
  if (!order_number) {
    return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { 
      status: 400,
      headers: corsHeaders
    })
  }
  
  // 환경변수 로그
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10))

  const supabase = createAdminClient()

  // 1. 먼저 기존 purchases 테이블에서 조회
  const { data: purchaseData, error: purchaseError } = await supabase
    .from("purchases")
    .select("*, post:posts(*), buyer:users!purchases_buyer_id_fkey(*)")
    .eq("order_number", order_number)
    .maybeSingle()

  console.log('🧪 purchases 테이블 조회 결과:', purchaseData)
  console.log('❌ purchases 테이블 에러:', purchaseError)

  // 2. purchases에 데이터가 있으면 바로 반환
  if (purchaseData && !purchaseError) {
    return NextResponse.json(purchaseData, { headers: corsHeaders })
  }

  // 3. purchases에 없으면 proposal_transactions에서 조회
  console.log('🔍 proposal_transactions 테이블에서 조회 시도...')
  
  const { data: proposalTransactionData, error: proposalError } = await supabase
    .from("proposal_transactions")
    .select(`
      *,
      posts!proposal_transactions_post_id_fkey(*),
      buyer:users!proposal_transactions_buyer_id_fkey(*),
      seller:users!proposal_transactions_seller_id_fkey(*)
    `)
    .eq("order_number", order_number)
    .maybeSingle()

  console.log('🧪 proposal_transactions 조회 결과:', proposalTransactionData)
  console.log('❌ proposal_transactions 에러:', proposalError)

  if (proposalTransactionData && !proposalError) {
    // proposal_transactions 데이터를 purchases 형태로 변환
    const convertedData = {
      id: proposalTransactionData.id,
      order_number: proposalTransactionData.order_number,
      buyer_id: proposalTransactionData.buyer_id,
      seller_id: proposalTransactionData.seller_id,
      post_id: proposalTransactionData.post_id,
      total_price: proposalTransactionData.total_price,
      selected_seats: proposalTransactionData.selected_seats,
      quantity: proposalTransactionData.quantity,
      status: proposalTransactionData.status,
      created_at: proposalTransactionData.created_at,
      updated_at: proposalTransactionData.updated_at,
      payment_method: 'proposal_based', // 제안 기반 거래 표시
      // 관련 데이터
      post: proposalTransactionData.posts,
      buyer: proposalTransactionData.buyer,
      seller: proposalTransactionData.seller
    }
    
    console.log('✅ proposal_transactions 데이터를 purchases 형태로 변환 완료')
    return NextResponse.json(convertedData, { headers: corsHeaders })
  }

  // 4. 둘 다 없으면 404 에러
  console.error("주문번호 조회 오류: 두 테이블 모두에서 찾을 수 없음")
  return NextResponse.json({ error: "해당 주문번호를 찾을 수 없습니다." }, { 
    status: 404,
    headers: corsHeaders
  })
} 

export async function POST(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  const { order_number } = params
  
  // 요청 시작 시점 로깅
  console.log("🔄 구매확정 API POST 요청 시작 - order_number:", order_number);
  
  if (!order_number) {
    return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { 
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    const body = await req.json()
    // 디버깅: 원본 body 로깅
    console.log("🔎 원본 요청 body:", body);
    
    const { status: updatedStatus } = body

    // 디버깅: 수신된 status 값 확인 (더 명확하게)
    console.log("📦 전달된 status:", updatedStatus, "타입:", typeof updatedStatus, "값 존재?:", !!updatedStatus);
    console.log("🔬 status 값 분석:", {
      isEmpty: !updatedStatus,
      rawValue: updatedStatus,
      trimmed: typeof updatedStatus === 'string' ? updatedStatus.trim() : updatedStatus,
      upperCased: typeof updatedStatus === 'string' ? updatedStatus.toUpperCase() : updatedStatus
    });

    if (!updatedStatus) {
      return NextResponse.json({ error: "상태가 제공되지 않았습니다." }, { 
        status: 400,
        headers: corsHeaders
      })
    }

    // 유효한 상태값 검증
    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'CONFIRMED', 'CANCELLED']
    if (!validStatuses.includes(updatedStatus)) {
      return NextResponse.json({ error: "유효하지 않은 상태값입니다." }, { 
        status: 400,
        headers: corsHeaders
      })
    }

    const supabase = createAdminClient()
    console.log("✅ Supabase Admin 클라이언트 생성 완료");
    
    // 1. 먼저 purchases 테이블에서 조회
    const { data: purchase, error: purchaseError } = await supabase
      .from("purchases")
      .select("*")
      .eq("order_number", order_number)
      .maybeSingle()

    let transactionData = purchase;
    let isProposalTransaction = false;

    // 2. purchases에서 못 찾았으면 proposal_transactions에서 조회
    if (!purchase && !purchaseError) {
      const { data: proposalTransaction, error: proposalError } = await supabase
        .from("proposal_transactions")
        .select("*")
        .eq("order_number", order_number)
        .maybeSingle()

      if (proposalError) {
        console.error("proposal_transactions 조회 실패:", proposalError);
        return NextResponse.json({ error: "해당 주문을 찾을 수 없습니다." }, { 
          status: 404,
          headers: corsHeaders
        });
      }

      if (!proposalTransaction) {
        console.error("주문 조회 오류: 양쪽 테이블에서 모두 찾을 수 없음");
        return NextResponse.json({ error: "해당 주문을 찾을 수 없습니다." }, { 
          status: 404,
          headers: corsHeaders
        });
      }

      transactionData = proposalTransaction;
      isProposalTransaction = true;
    } else if (purchaseError) {
      console.error("purchases 테이블 조회 실패:", purchaseError);
      return NextResponse.json({ error: "해당 주문을 찾을 수 없습니다." }, { 
        status: 404,
        headers: corsHeaders
      });
    }

    if (!transactionData) {
      return NextResponse.json({ error: "해당 주문을 찾을 수 없습니다." }, { 
        status: 404,
        headers: corsHeaders
      });
    }

    // 디버깅: 현재 DB 상태 로깅
    console.log("📊 DB 상태 확인 - 현재 상태:", transactionData.status, "요청 상태:", updatedStatus);

    // 현재 상태와 동일한 상태로 업데이트하려는 경우
    if (transactionData.status === updatedStatus) {
      return NextResponse.json({ 
        message: "상태가 이미 동일합니다.",
        transaction: transactionData
      }, {
        headers: corsHeaders
      })
    }

    // 상태 업데이트 전 로깅
    console.log("✏️ 상태 업데이트 시작:", transactionData.status, "→", updatedStatus);
    
    // 적절한 테이블에서 상태 업데이트
    const tableName = isProposalTransaction ? "proposal_transactions" : "purchases";
    const { data: updatedTransaction, error: updateError } = await supabase
      .from(tableName)
      .update({ 
        status: updatedStatus,
        updated_at: new Date().toISOString()
      })
      .eq("order_number", order_number)
      .select()
      .maybeSingle()

    if (updateError) {
      console.error("상태 업데이트 실패:", updateError);
      return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { 
        status: 500,
        headers: corsHeaders
      });
    }

    console.log("✏️ 상태 업데이트 결과:", updateError ? "실패" : "성공");

    // 구매 확정 시 알림톡 발송
    if (updatedStatus === 'CONFIRMED') {
      try {
        console.log("📱 구매 확정 알림톡 발송 시작");
        
        const buyerData = transactionData.buyer;
        const sellerData = transactionData.seller;
        const postData = transactionData.post;
        const productName = postData?.title || postData?.event_name || '티켓';
        
        // 구매자에게 구매 확정 알림톡 발송
        if (buyerData && buyerData.phone_number) {
          console.log(`📞 구매자 ${buyerData.name}(${buyerData.phone_number})에게 구매 확정 알림톡 발송`);
          
          const buyerResult = await sendOrderConfirmedNotification(
            buyerData.phone_number,
            buyerData.name || '구매자',
            order_number,
            productName
          );
          
          if (buyerResult.success) {
            console.log("✅ 구매자 구매 확정 알림톡 발송 성공");
          } else {
            console.error("❌ 구매자 구매 확정 알림톡 발송 실패:", buyerResult.error);
          }
        } else {
          console.log("⚠️ 구매자 전화번호 없음: 구매자 알림톡 발송 건너뜀");
        }
        
        // 판매자에게 구매 확정 알림톡 발송
        if (sellerData && sellerData.phone_number) {
          console.log(`📞 판매자 ${sellerData.name}(${sellerData.phone_number})에게 구매 확정 알림톡 발송`);
          
          const sellerResult = await sendOrderConfirmedNotification(
            sellerData.phone_number,
            sellerData.name || '판매자',
            order_number,
            `[구매 확정] ${productName}`
          );
          
          if (sellerResult.success) {
            console.log("✅ 판매자 구매 확정 알림톡 발송 성공");
          } else {
            console.error("❌ 판매자 구매 확정 알림톡 발송 실패:", sellerResult.error);
          }
        } else {
          console.log("⚠️ 판매자 전화번호 없음: 판매자 알림톡 발송 건너뜀");
        }
        
      } catch (kakaoError) {
        console.error("❌ 구매 확정 알림톡 발송 중 오류:", kakaoError);
        // 알림톡 발송 실패해도 상태 업데이트는 성공으로 처리
      }
    }

    return NextResponse.json({ 
      message: "상태가 성공적으로 업데이트되었습니다.",
      transaction: updatedTransaction
    }, {
      headers: corsHeaders
    });

  } catch (error) {
    console.error("❌ 구매확정 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { 
      status: 500,
      headers: corsHeaders
    });
  }
} 
