import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * 수수료 납부 처리 API
 * 지정된 구매 ID의 수수료 납부 상태를 true로 변경합니다.
 */
export async function POST(req: Request) {
  try {
    // 요청에서 구매 ID 추출
    const { purchaseId } = await req.json();

    if (!purchaseId) {
      return NextResponse.json(
        { success: false, message: "구매 ID가 제공되지 않았습니다." }, 
        { status: 400 }
      );
    }

    // 관리자 권한으로 Supabase 클라이언트 생성
    const supabase = createAdminClient();

    // 수수료 납부 상태 업데이트
    const { error } = await supabase
      .from("purchases")
      .update({ is_fee_paid: true })
      .eq("id", purchaseId);

    if (error) {
      console.error("수수료 납부 처리 오류:", error);
      return NextResponse.json(
        { success: false, message: error.message }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "수수료 납부 처리가 완료되었습니다."
    });
  } catch (error) {
    console.error("API 처리 중 오류 발생:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." 
      }, 
      { status: 500 }
    );
  }
} 