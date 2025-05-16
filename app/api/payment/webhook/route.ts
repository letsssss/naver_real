import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await req.json();

  console.log("📦 수신된 Webhook Body:", JSON.stringify(body, null, 2));

  // ✅ 필수 필드 파싱
  const paymentId = body.paymentId || body.id;
  const transactionId = body.txId || null;
  const type = body.type; // 'Transaction.Paid' 등
  
  // ⭐️ 중요: type 필드 기반으로 상태 판단 (성공 여부를 더 명확하게)
  let status;
  if (type === 'Transaction.Paid') {
    status = 'DONE';
  } else if (type === 'Transaction.Cancelled') {
    status = 'CANCELLED';
  } else {
    // body.status가 있으면 사용, 없으면 FAILED
    status = body.status || 'FAILED';
  }

  // 디버깅용 상세 로그
  console.log("🔎 파싱된 필드:", {
    paymentId,
    transactionId,
    type,
    rawStatus: body.status,
    rawSuccess: body.success,
    parsedStatus: status
  });

  if (!paymentId) {
    console.warn("❌ paymentId 없음");
    return new Response("paymentId 누락", { status: 400 });
  }

  // ✅ 상태 문자열 정규화 (혹시 null 들어올 경우 대비)
  if (!["DONE", "FAILED", "CANCELLED", "PENDING"].includes(status)) {
    console.log(`⚠️ 인식할 수 없는 상태값: '${status}' → 'FAILED'로 변환`);
    status = "FAILED"; // 기본 fallback
  }

  // ⭐️ 중요: 결제 성공 처리 함수
  async function handlePaymentSuccess(payId: string) {
    console.log('💾 결제 성공 처리 시작:', payId);
    
    try {
      // DB에 결제 상태 최종 업데이트
      const { data, error } = await supabase
        .from("payments")
        .update({
          status: "DONE", // 명시적으로 DONE 설정
          transaction_id: transactionId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payId) // id 필드 사용 (중요)
        .select('status, id');
        
      if (error) {
        console.error("❌ 결제 성공 처리 실패:", error);
        return false;
      }
      
      console.log('✅ DB에 결제 완료 상태 저장 성공:', data?.[0]);
      return true;
    } catch (err) {
      console.error('❌ 결제 성공 처리 중 오류:', err);
      return false;
    }
  }

  // 1. 기본 상태 업데이트
  const { data, error } = await supabase
    .from("payments")
    .update({
      status,
      transaction_id: transactionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId) // ← ✅ 반드시 'id' 필드로!
    .select('status, id');

  if (error) {
    console.error("❌ Supabase 업데이트 실패:", error);
    return new Response("fail", { status: 500 });
  }

  // 2. 결제 성공이면 추가 처리
  if (status === "DONE") {
    await handlePaymentSuccess(paymentId);
  }

  // 확인을 위해 최종 상태 다시 조회
  const { data: finalData } = await supabase
    .from("payments")
    .select('status, updated_at')
    .eq("id", paymentId)
    .single();

  console.log("✅ Webhook 처리 완료 (최종상태):", { 
    paymentId, 
    type,
    requested_status: status, 
    final_status: finalData?.status,
    updated_at: finalData?.updated_at
  });
  
  return new Response("OK", { status: 200 });
} 