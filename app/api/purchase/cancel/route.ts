import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { orderNumber, status, reason } = await req.json();
    
    console.log("📌 거래 취소 요청 받음:", { orderNumber, status, reason });

    if (!orderNumber || !status) {
      return NextResponse.json(
        { error: "orderNumber와 status는 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    console.log("🔍 주문번호로 취소할 데이터 찾기:", orderNumber);

    // single() 대신 maybeSingle() 사용하여 결과가 없는 경우도 처리
    const { data, error } = await supabase
      .from("purchases")
      .update({ status })
      .eq("order_number", orderNumber)
      .select("*")
      .maybeSingle();
    
    console.log("📊 쿼리 결과:", { data, error: error?.message });

    if (error) {
      console.error("❌ 데이터베이스 오류:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!data) {
      console.warn("⚠️ 해당 주문번호를 찾을 수 없음:", orderNumber);
      return NextResponse.json(
        { error: "해당 주문번호를 찾을 수 없습니다." }, 
        { status: 404 }
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