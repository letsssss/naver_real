import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendTicketConfirmedNotification, sendOrderConfirmedNotification, sendOrderCancelledNotification } from '@/services/kakao-notification-service';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const { status } = await req.json();

  if (!id || !status) {
    return NextResponse.json({ error: "ID 또는 상태가 제공되지 않았습니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 먼저 purchases 테이블에서 조회
  const { data: purchaseData, error: fetchError } = await supabase
    .from("purchases")
    .select(`
      *,
      post:posts(*),
      buyer:users!purchases_buyer_id_fkey(id, name, phone_number),
      seller:users!purchases_seller_id_fkey(id, name, phone_number)
    `)
    .eq("id", id)
    .maybeSingle();

  let transactionData = purchaseData;
  let isProposalTransaction = false;

  // purchases에서 못 찾았으면 proposal_transactions에서 조회
  if (!purchaseData && !fetchError) {
    const { data: proposalTransactionData, error: proposalFetchError } = await supabase
      .from("proposal_transactions")
      .select(`
        *,
        post:posts(*),
        buyer:users!proposal_transactions_buyer_id_fkey(id, name, phone_number),
        seller:users!proposal_transactions_seller_id_fkey(id, name, phone_number)
      `)
      .eq("id", id)
      .maybeSingle();

    if (proposalFetchError) {
      console.error("proposal_transactions 조회 실패:", proposalFetchError);
      return NextResponse.json({ error: "구매 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    if (!proposalTransactionData) {
      console.error("구매 정보 조회 실패: 양쪽 테이블에서 모두 찾을 수 없음");
      return NextResponse.json({ error: "구매 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    transactionData = proposalTransactionData;
    isProposalTransaction = true;
  } else if (fetchError) {
    console.error("purchases 테이블 조회 실패:", fetchError);
    return NextResponse.json({ error: "구매 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!transactionData) {
    return NextResponse.json({ error: "구매 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  // 적절한 테이블에서 상태 업데이트
  const tableName = isProposalTransaction ? "proposal_transactions" : "purchases";
  const { error } = await supabase
    .from(tableName)
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("상태 업데이트 실패:", error);
    return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  // 🔔 취켓팅 완료 시 구매자와 판매자에게 알림톡 발송
  if (status === 'COMPLETED') {
    try {
      console.log("📱 취켓팅 완료 알림톡 발송 시작");
      
      const buyerData = transactionData.buyer;
      const sellerData = transactionData.seller;
      const postData = transactionData.post;
      const productName = postData?.title || postData?.event_name || '티켓';
      const orderNumber = transactionData.order_number || transactionData.id.toString();
      
      // 구매자에게 취켓팅 완료 알림톡 발송
      if (buyerData && buyerData.phone_number) {
        console.log(`📞 구매자 ${buyerData.name}(${buyerData.phone_number})에게 취켓팅 완료 알림톡 발송`);
        
        const buyerResult = await sendTicketConfirmedNotification(
          buyerData.phone_number,
          buyerData.name || '구매자',
          orderNumber,
          productName
        );
        
        if (buyerResult.success) {
          console.log("✅ 구매자 취켓팅 완료 알림톡 발송 성공");
        } else {
          console.error("❌ 구매자 취켓팅 완료 알림톡 발송 실패:", buyerResult.error);
        }
      } else {
        console.log("⚠️ 구매자 전화번호 없음: 구매자 알림톡 발송 건너뜀");
      }
      
      // 판매자에게 취켓팅 완료 알림톡 발송
      if (sellerData && sellerData.phone_number) {
        console.log(`📞 판매자 ${sellerData.name}(${sellerData.phone_number})에게 취켓팅 완료 알림톡 발송`);
        
        const sellerResult = await sendTicketConfirmedNotification(
          sellerData.phone_number,
          sellerData.name || '판매자',
          orderNumber,
          `[취켓팅 완료] ${productName}`
        );
        
        if (sellerResult.success) {
          console.log("✅ 판매자 취켓팅 완료 알림톡 발송 성공");
        } else {
          console.error("❌ 판매자 취켓팅 완료 알림톡 발송 실패:", sellerResult.error);
        }
      } else {
        console.log("⚠️ 판매자 전화번호 없음: 판매자 알림톡 발송 건너뜀");
      }
      
    } catch (kakaoError) {
      console.error("❌ 취켓팅 완료 알림톡 발송 중 오류:", kakaoError);
      // 알림톡 발송 실패해도 상태 업데이트는 성공으로 처리
    }
  }

  // 🔔 구매 확정 시 구매자와 판매자에게 알림톡 발송
  if (status === 'CONFIRMED') {
    try {
      console.log("📱 구매 확정 알림톡 발송 시작");
      
      const buyerData = transactionData.buyer;
      const sellerData = transactionData.seller;
      const postData = transactionData.post;
      const productName = postData?.title || postData?.event_name || '티켓';
      const orderNumber = transactionData.order_number || transactionData.id.toString();
      
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
      
    } catch (kakaoError) {
      console.error("❌ 구매 확정 알림톡 발송 중 오류:", kakaoError);
      // 알림톡 발송 실패해도 상태 업데이트는 성공으로 처리
    }
  }

  // 🔔 거래 취소 시 구매자와 판매자에게 알림톡 발송
  if (status === 'CANCELLED') {
    try {
      console.log("📱 거래 취소 알림톡 발송 시작");
      
      const buyerData = transactionData.buyer;
      const sellerData = transactionData.seller;
      const postData = transactionData.post;
      const productName = postData?.title || postData?.event_name || '티켓';
      const orderNumber = transactionData.order_number || transactionData.id.toString();
      
      // 구매자에게 거래 취소 알림톡 발송
      if (buyerData && buyerData.phone_number) {
        console.log(`📞 구매자 ${buyerData.name}(${buyerData.phone_number})에게 거래 취소 알림톡 발송`);
        
        const buyerResult = await sendOrderCancelledNotification(
          buyerData.phone_number,
          buyerData.name || '구매자',
          orderNumber,
          productName
        );
        
        if (buyerResult.success) {
          console.log("✅ 구매자 거래 취소 알림톡 발송 성공");
        } else {
          console.error("❌ 구매자 거래 취소 알림톡 발송 실패:", buyerResult.error);
        }
      } else {
        console.log("⚠️ 구매자 전화번호 없음: 구매자 알림톡 발송 건너뜀");
      }
      
      // 판매자에게 거래 취소 알림톡 발송
      if (sellerData && sellerData.phone_number) {
        console.log(`📞 판매자 ${sellerData.name}(${sellerData.phone_number})에게 거래 취소 알림톡 발송`);
        
        const sellerResult = await sendOrderCancelledNotification(
          sellerData.phone_number,
          sellerData.name || '판매자',
          orderNumber,
          `[거래 취소] ${productName}`
        );
        
        if (sellerResult.success) {
          console.log("✅ 판매자 거래 취소 알림톡 발송 성공");
        } else {
          console.error("❌ 판매자 거래 취소 알림톡 발송 실패:", sellerResult.error);
        }
      } else {
        console.log("⚠️ 판매자 전화번호 없음: 판매자 알림톡 발송 건너뜀");
      }
      
    } catch (kakaoError) {
      console.error("❌ 거래 취소 알림톡 발송 중 오류:", kakaoError);
      // 알림톡 발송 실패해도 상태 업데이트는 성공으로 처리
    }
  }

  return NextResponse.json({ message: "상태가 성공적으로 업데이트되었습니다." });
} 