import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 요청 본문에서 데이터 추출
    const bodyData = await req.json().catch(() => ({}));
    const { status, reason } = bodyData;
    
    // URL 쿼리 파라미터에서 orderNumber 추출
    const url = new URL(req.url);
    const queryOrderNumber = url.searchParams.get('orderNumber');
    
    // body의 orderNumber와 URL의 orderNumber 중 하나 선택 (URL 우선)
    let orderNumber = queryOrderNumber || bodyData.orderNumber;
    
    // 공백 제거 및 정규화
    if (orderNumber) {
      orderNumber = orderNumber.trim();
    }
    
    console.log("📌 거래 취소 요청 받음:", { 
      queryOrderNumber, 
      bodyOrderNumber: bodyData.orderNumber,
      finalOrderNumber: orderNumber,
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

    // 일반 클라이언트 대신 관리자 권한 클라이언트 사용 (RLS 우회)
    const supabase = createAdminClient();
    
    console.log("🔍 주문번호로 취소할 데이터 찾기 (관리자 권한):", orderNumber);

    try {
      // limit(1).single() 사용하여 정확히 하나의 결과만 가져오도록 함
      const { data: existingData, error: findError } = await supabase
        .from("purchases")
        .select("*")
        .eq("order_number", orderNumber)
        .limit(1)
        .single();
        
      console.log("🔎 주문번호 존재 여부 확인:", { 
        exists: !!existingData, 
        error: findError?.message,
        data: existingData ? `ID: ${existingData.id}, Status: ${existingData.status}` : 'None'
      });
      
      if (findError) {
        console.error("❌ 주문 조회 오류:", findError.message);
        
        // 주문이 없는 경우 vs 다른 오류 구분
        if (findError.message.includes("no rows found") || findError.message.includes("no row found")) {
          return NextResponse.json(
            { error: "해당 주문번호를 찾을 수 없습니다." }, 
            { status: 404 }
          );
        }
        
        return NextResponse.json({ error: findError.message }, { status: 500 });
      }

      // 존재하는 경우에만 상태 업데이트 진행 (이미 single()로 확인했으므로 existingData는 항상 존재)
      const { data, error } = await supabase
        .from("purchases")
        .update({ status })
        .eq("order_number", orderNumber)
        .select("*")
        .single();
      
      console.log("📊 상태 업데이트 결과:", { 
        data: data ? `ID: ${data.id}, Status: ${data.status}` : 'None',
        error: error?.message 
      });

      if (error) {
        console.error("❌ 데이터베이스 오류:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      console.log("✅ 거래 취소 성공:", { orderNumber, status });
      return NextResponse.json({ success: true, updated: data });
    
    } catch (dbError: any) {
      console.error("❌ 데이터베이스 작업 예외:", dbError.message);
      return NextResponse.json({ error: `데이터베이스 오류: ${dbError.message}` }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error("❌ 예상치 못한 오류:", error.message);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` }, 
      { status: 500 }
    );
  }
} 