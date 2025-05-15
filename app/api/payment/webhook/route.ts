import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 주의: PortOne 에서는 snake_case 필드명을 사용합니다 (payment_id, tx_id 등)
    console.log("📌 Webhook 수신 데이터:", JSON.stringify(body, null, 2));
    
    // 다양한 필드명 호환성 처리
    const paymentId = body.payment_id || body.paymentId;
    const transaction_id = body.tx_id || body.txId;
    const transaction_type = body.transaction_type || body.transactionType;
    const status = body.status || 'DONE'; // 기본값 설정

    if (!paymentId) {
      console.error("❌ Webhook: paymentId 없음");
      return NextResponse.json({ 
        success: false, 
        message: "paymentId가 필요합니다" 
      }, { status: 400 });
    }

    console.log(`📢 Webhook: payment_id=${paymentId}, status=${status}, tx_id=${transaction_id}, type=${transaction_type}`);
    
    const supabase = createClient();

    // ✅ 수정: payment_id가 아닌 id 컬럼으로 조회 (이 컬럼에 PortOne의 paymentId가 저장됨)
    const { data, error } = await supabase
      .from('payments')
      .update({
        status,
        transaction_id,
        transaction_type,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select('status');

    if (error) {
      console.error("❌ Webhook: DB 업데이트 실패", error);
      return NextResponse.json({ 
        success: false, 
        message: "결제 상태 업데이트 실패", 
        error: error.message 
      }, { status: 500 });
    }

    console.log(`✅ Webhook: 결제 상태 업데이트 성공 (payment_id=${paymentId}, status=${status})`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Webhook 처리 완료",
      data
    });
    
  } catch (err: any) {
    console.error("❌ Webhook 처리 중 오류:", err);
    return NextResponse.json({ 
      success: false, 
      message: "서버 오류", 
      error: err.message 
    }, { status: 500 });
  }
} 