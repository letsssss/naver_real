import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    console.log('📥 Webhook 요청 수신:', JSON.stringify(body, null, 2));

    const {
      paymentId,
      status,
      txId,
      transactionType,
    } = body;

    // 필수 값 검증
    if (!paymentId || !transactionType) {
      console.error('⚠️ Webhook 필수 항목 누락:', { paymentId, transactionType });
      return NextResponse.json({ success: false, message: '필수 항목 누락' }, { status: 400 });
    }

    // 상태 판단: PortOne에서 DONE / FAILED 로 내려주기도 함
    const finalStatus = status === 'DONE' || transactionType === 'PAYMENT' ? 'DONE' : 'FAILED';

    console.log(`🔄 결제 상태 업데이트: ${paymentId} → ${finalStatus} (txId: ${txId})`);

    // DB 업데이트
    const { data, error } = await supabase
      .from('payments')
      .update({ 
        status: finalStatus,
        transaction_id: txId,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select();

    if (error) {
      console.error('🔴 Webhook DB 업데이트 실패:', JSON.stringify(error, null, 2));
      return NextResponse.json({ success: false, message: 'DB 업데이트 실패', error }, { status: 500 });
    }

    // 업데이트된 결제 정보 로깅
    if (data && data.length > 0) {
      console.log(`✅ Webhook 반영 완료: ${paymentId} → ${finalStatus}, 데이터:`, data[0]);
    } else {
      console.log(`✅ Webhook 반영 완료: ${paymentId} → ${finalStatus}, 데이터 없음`);
    }

    // 결제 성공 시 추가 작업 (예: 알림 발송, 주문 상태 업데이트 등)
    if (finalStatus === 'DONE') {
      try {
        // 결제 완료 시 주문 상태 업데이트 등의 작업을 여기서 수행할 수 있음
        // 예: 이메일 알림, SMS 발송, 주문 테이블 업데이트 등
      } catch (err) {
        console.error('⚠️ 결제 성공 후 추가 처리 중 오류:', err);
        // 주요 업데이트는 성공했으므로 이 오류는 무시하고 성공 응답 반환
      }
    }

    return NextResponse.json({ success: true, status: finalStatus });
  } catch (err: any) {
    console.error('❌ Webhook 처리 중 오류:', err);
    return NextResponse.json({ success: false, message: '서버 오류', error: err.message }, { status: 500 });
  }
} 