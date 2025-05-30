export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // ✅ 캐싱 막기
export const preferredRegion = 'auto';  // ✅ 자동 라우팅

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase"
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
    
    // 주문 정보 조회
    const { data: purchase, error: queryError } = await supabase
      .from("purchases")
      .select("*")
      .eq("order_number", order_number)
      .single()

    if (queryError || !purchase) {
      console.error("주문 조회 오류:", queryError)
      return NextResponse.json({ error: "해당 주문을 찾을 수 없습니다." }, { 
        status: 404,
        headers: corsHeaders
      })
    }

    // 디버깅: 현재 DB 상태 로깅
    console.log("📊 DB 상태 확인 - 현재 상태:", purchase.status, "요청 상태:", updatedStatus);

    // 현재 상태와 동일한 상태로 업데이트하려는 경우
    if (purchase.status === updatedStatus) {
      return NextResponse.json({ 
        message: "상태가 이미 동일합니다.",
        purchase
      }, {
        headers: corsHeaders
      })
    }

    // 상태 업데이트 전 로깅
    console.log("✏️ 상태 업데이트 시작:", purchase.status, "→", updatedStatus);
    
    // 상태 업데이트
    const { data: updatedPurchase, error: updateError } = await supabase
      .from("purchases")
      .update({ 
        status: updatedStatus,
        updated_at: new Date().toISOString()
      })
      .eq("order_number", order_number)
      .select()
      .single()

    console.log("✏️ 상태 업데이트 결과:", updateError ? "실패" : "성공");
    
    if (updateError) {
      console.error("상태 업데이트 오류:", updateError)
      return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { 
        status: 500,
        headers: corsHeaders
      })
    }

    // 디버깅: 조건문 진입 직전에 로그 추가 (더 명확하게)
    console.log("🧭 조건문 진입 시도 - 안전한 비교 방식 체크:", (updatedStatus || '').toUpperCase().trim() === 'CONFIRMED');
    
    // 문자열 정확한 비교를 위한 추가 검사
    const isExactConfirmed = updatedStatus === 'CONFIRMED';
    const isLowerConfirmed = updatedStatus?.toLowerCase() === 'confirmed';
    const containsConfirmed = updatedStatus?.includes('CONFIRM');
    const isSafeConfirmed = (updatedStatus || '').toUpperCase().trim() === 'CONFIRMED';
    
    console.log("🔍 문자열 비교 결과:", {
      updatedStatus,
      isExactConfirmed,
      isLowerConfirmed,
      containsConfirmed,
      isSafeConfirmed,
      charCodes: Array.from(String(updatedStatus || '')).map(c => c.charCodeAt(0))
    });
    
    // 구매확정 조건 - 더 안전한 비교 방식 사용
    if ((updatedStatus || '').toUpperCase().trim() === 'CONFIRMED') {
      console.log("✅ CONFIRMED 조건 통과 - 수수료 계산 시작");
      
      // 🔔 구매 확정 시 알림톡 발송
      try {
        console.log("📱 구매 확정 알림톡 발송 시작");
        
        // 구매 정보와 관련 데이터 조회
        const { data: purchaseWithDetails, error: detailsError } = await supabase
          .from("purchases")
          .select(`
            *,
            post:posts(*),
            buyer:users!purchases_buyer_id_fkey(id, name, phone_number),
            seller:users!purchases_seller_id_fkey(id, name, phone_number)
          `)
          .eq("order_number", order_number)
          .single();

        if (!detailsError && purchaseWithDetails) {
          const buyerData = purchaseWithDetails.buyer;
          const sellerData = purchaseWithDetails.seller;
          const postData = purchaseWithDetails.post;
          const productName = postData?.title || postData?.event_name || '티켓';
          const orderNumber = purchaseWithDetails.order_number || purchaseWithDetails.id.toString();
          
          // 구매자에게 구매 확정 알림톡 발송
          if (buyerData && buyerData.phone_number) {
            console.log(`📞 구매자 ${buyerData.name}(${buyerData.phone_number})에게 구매 확정 알림톡 발송`);
            
            const buyerResult = await sendOrderConfirmedNotification(
              buyerData.phone_number,
              buyerData.name || '구매자',
              orderNumber,
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
              orderNumber,
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
        } else {
          console.error("❌ 구매 상세 정보 조회 실패:", detailsError);
        }
        
      } catch (kakaoError) {
        console.error("❌ 구매 확정 알림톡 발송 중 오류:", kakaoError);
        // 알림톡 발송 실패해도 구매 확정 프로세스는 계속 진행
      }
      
      // 수수료 계산 로직
      try {
        console.log("\n===== 간소화된 수수료 계산 시작 (테스트) =====");
        console.log("✅ 구매확정 요청 → 수수료 계산 시작");
        
        // 1. purchaseId 검증 (필수)
        const purchaseId = purchase.id;
        if (!purchaseId) {
          console.error("❌ purchaseId가 없습니다:", purchaseId);
          throw new Error("purchaseId 없음");
        }
        
        console.log("📌 purchaseId:", purchaseId);
        console.log("📌 order_number:", order_number);
        
        // 2. 단순화된 데이터 조회
        const { data: purchaseData, error: fetchError } = await supabase
          .from('purchases')
          .select('id, total_price')
          .eq('id', purchaseId)
          .single();
        
        if (fetchError) {
          console.error("❌ 데이터 조회 실패:", fetchError);
          throw new Error("데이터 조회 실패");
        }
        
        if (!purchaseData) {
          console.error("❌ 조회 결과 없음");
          throw new Error("조회 결과 없음");
        }
        
        // 3. 간단한 수수료 계산
        const totalPrice = purchaseData.total_price || 0;
        const feeAmount = Math.floor(totalPrice * 0.1);
        
        console.log("📌 총 가격(total_price):", totalPrice);
        console.log("📌 계산된 수수료(fee_amount):", feeAmount);
        
        if (totalPrice <= 0) {
          console.warn("⚠️ 가격이 0 이하입니다:", totalPrice);
        }
        
        // 4. 수수료 정보 업데이트
        const feeDueAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
        
        const { error: updateError } = await supabase
          .from('purchases')
          .update({
            fee_amount: feeAmount,
            fee_due_at: feeDueAt.toISOString(),
            update_test: "수수료계산테스트_" + new Date().toISOString().substring(0, 19)
          })
          .eq('id', purchaseId);
        
        if (updateError) {
          console.error("❌ 수수료 업데이트 실패:", updateError);
          throw new Error("수수료 업데이트 실패");
        }
        
        // 5. 업데이트 확인
        const { data: verifyResult } = await supabase
          .from('purchases')
          .select('id, fee_amount, fee_due_at, update_test')
          .eq('id', purchaseId)
          .single();
        
        console.log("✅ 수수료 업데이트 성공:", verifyResult);
        console.log("===== 수수료 계산 완료 =====\n");
        
      } catch (error) {
        console.error("❌❌❌ 수수료 처리 중 오류:", error);
        console.log("🔍 디버깅 정보:", {
          purchaseId: purchase?.id,
          totalPrice: purchase?.total_price,
          order_number
        });
      }
    } else {
      console.log("⚠️ CONFIRMED 조건 불일치 - 수수료 계산 건너뜀", {
        updatedStatus, 
        isConfirmed: updatedStatus === 'CONFIRMED',
        type: typeof updatedStatus
      });
    }
    
    // 디버깅: 최종 응답 전 로그
    console.log("🏁 API 처리 완료 - 상태:", updatedStatus, "수수료 계산 여부:", updatedStatus === 'CONFIRMED');

    return NextResponse.json({ 
      message: "상태가 성공적으로 업데이트되었습니다.",
      purchase: updatedPurchase
    }, {
      headers: corsHeaders
    })

  } catch (error) {
    console.error("요청 처리 오류:", error)
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다." }, { 
      status: 500,
      headers: corsHeaders
    })
  }
} 
