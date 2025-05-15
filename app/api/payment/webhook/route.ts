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
  const success = body.success ?? null;
  let status = body.status || (success === true ? "DONE" : "FAILED");

  // ✅ 중요: PortOne에서 'Paid' 상태로 오는 경우 'DONE'으로 처리
  if (status === 'Paid') {
    status = 'DONE';
    console.log(`✅ 'Paid' 상태를 'DONE'으로 변환: ${paymentId}`);
  }

  if (!paymentId) {
    console.warn("❌ paymentId 없음");
    return new Response("paymentId 누락", { status: 400 });
  }

  // ✅ 상태 문자열 정규화 (혹시 null 들어올 경우 대비)
  if (!["DONE", "FAILED", "CANCELLED", "PENDING"].includes(status)) {
    console.log(`⚠️ 인식할 수 없는 상태값: '${status}' → 'FAILED'로 변환`);
    status = "FAILED"; // 기본 fallback
  }

  // ✅ Supabase 업데이트
  const { data, error } = await supabase
    .from("payments")
    .update({
      status,
      transaction_id: transactionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId) // ← ✅ 반드시 'id' 필드로!
    .select('status');

  if (error) {
    console.error("❌ Supabase 업데이트 실패:", error);
    return new Response("fail", { status: 500 });
  }

  console.log("✅ Webhook 처리 완료:", { paymentId, status, updated_status: data?.[0]?.status });
  return new Response("OK", { status: 200 });
} 