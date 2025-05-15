import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const payload = await req.json();
    console.log("📩 포트원 웹훅 수신:", payload);

    const { paymentId, status, totalAmount } = payload;

    if (!paymentId) {
      console.error("❌ 웹훅 페이로드에 paymentId 없음:", payload);
      return NextResponse.json({ success: false, message: 'paymentId 없음' }, { status: 400 });
    }

    // ✅ 결제 성공일 때만 상태 업데이트
    if (status === "DONE") {
      // paymentId에 해당하는 결제 내역을 찾아서 상태 업데이트
      const { data, error } = await supabase
        .from("payments")
        .update({ 
          status: "COMPLETED",
          updated_at: new Date().toISOString()
        })
        .eq("id", paymentId)
        .select();

      if (error) {
        console.error("❌ DB 업데이트 실패:", error);
        return NextResponse.json({ success: false, message: "DB 업데이트 실패", error: error.message }, { status: 500 });
      }

      if (!data || data.length === 0) {
        console.warn("⚠️ 웹훅: DB에서 해당 paymentId를 찾을 수 없음:", paymentId);
        return NextResponse.json({ success: false, message: "해당 결제 내역 없음" }, { status: 404 });
      }

      console.log("✅ 결제 완료 처리:", paymentId);
      return NextResponse.json({ success: true, message: "결제 상태 업데이트 성공" }, { status: 200 });
    }

    // ✅ 결제 실패/취소의 경우 상태 업데이트
    if (status === "FAILED" || status === "CANCELLED") {
      const { error } = await supabase
        .from("payments")
        .update({ 
          status: status === "FAILED" ? "FAILED" : "CANCELLED",
          updated_at: new Date().toISOString()
        })
        .eq("id", paymentId);

      if (error) {
        console.error("❌ 실패 상태 업데이트 실패:", error);
      }

      console.warn("⚠️ 웹훅: 결제 실패/취소 상태:", status, paymentId);
    }

    // 다른 상태는 일단 로그만 남기고 200 응답
    console.log("ℹ️ 웹훅: 기타 상태:", status, paymentId);
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err: any) {
    console.error("❌ 웹훅 처리 중 오류:", err);
    return NextResponse.json({ success: false, message: "서버 오류", error: err.message }, { status: 500 });
  }
} 