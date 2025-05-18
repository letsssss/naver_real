import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    // 요청 본문에서 데이터 추출
    const bodyData = await req.json().catch(() => ({}));
    const { status, reason } = bodyData;
    
    // URL 쿼리 파라미터에서 orderNumber 추출
    const url = new URL(req.url);
    const queryOrderNumber = url.searchParams.get('orderNumber');
    
    // body의 orderNumber와 URL의 orderNumber 중 하나 선택 (URL 우선)
    const orderNumber = queryOrderNumber || bodyData.orderNumber;
    
    console.log("📌 거래 취소 요청 받음:", { 
      queryOrderNumber, 
      bodyOrderNumber: bodyData.orderNumber,
      status, 
      reason,
      url: req.url
    });

    if (!orderNumber || !status) {
      return NextResponse.json(
        { error: "orderNumber와 status는 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    console.log("🔍 주문번호로 취소할 데이터 찾기:", orderNumber);

    // 먼저 해당 주문번호가 존재하는지 확인
    const { data: existingData, error: findError } = await supabase
      .from("purchases")
      .select("*")
      .eq("order_number", orderNumber)
      .maybeSingle();
      
    console.log("🔎 주문번호 존재 여부 확인:", { exists: !!existingData, error: findError?.message });
    
    if (findError) {
      console.error("❌ 주문 조회 오류:", findError.message);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }
    
    if (!existingData) {
      console.warn("⚠️ 해당 주문번호를 찾을 수 없음:", orderNumber);
      return NextResponse.json(
        { error: "해당 주문번호를 찾을 수 없습니다." }, 
        { status: 404 }
      );
    }

    // 존재하는 경우에만 상태 업데이트 진행
    const { data, error } = await supabase
      .from("purchases")
      .update({ status })
      .eq("order_number", orderNumber)
      .select("*")
      .maybeSingle();
    
    console.log("📊 상태 업데이트 결과:", { data, error: error?.message });

    if (error) {
      console.error("❌ 데이터베이스 오류:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      console.warn("⚠️ 상태 업데이트 실패:", orderNumber);
      return NextResponse.json(
        { error: "상태 업데이트에 실패했습니다." }, 
        { status: 500 }
      );
    }

    console.log("✅ 거래 취소 성공:", { orderNumber, status });
    return NextResponse.json({ success: true, updated: data });
    
  } catch (error: any) {
    console.error("❌ 예상치 못한 오류:", error.message);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` }, 
      { status: 500 }
    );
  }
} 