import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');

    console.log(`🔍 결제 상태 조회 요청: paymentId=${paymentId}`);

    if (!paymentId) {
      console.warn('❌ paymentId 파라미터 누락');
      return NextResponse.json({ 
        success: false, 
        message: 'paymentId는 필수 입력 항목입니다' 
      }, { status: 400 });
    }

    const supabase = await createClient();
    
    // 💡 테이블 구조 확인 (디버깅용)
    try {
      const { data: tableInfo } = await supabase
        .from('payments')
        .select('id')
        .limit(1);
      
      console.log("💾 payments 테이블 존재 여부:", !!tableInfo);
    } catch (tableErr) {
      console.error("⚠️ 테이블 정보 확인 중 오류:", tableErr);
    }
    
    console.log("🔎 Supabase 조회 시작 - 대상 ID:", paymentId);
    
    // ⭐️ 중요: paymentId -> id 필드로 수정 (웹훅과 일치시킴)
    // Supabase에서 id 필드로 결제 상태 조회 (paymentId 아님!)
    const { data, error } = await supabase
      .from('payments')
      .select('status, transaction_id, updated_at')
      .eq('id', paymentId) // paymentId -> id로 변경
      .single();

    // 💬 전체 응답 결과 로깅 (디버깅용)
    console.log("💬 Supabase 조회 결과:", JSON.stringify({
      success: !error,
      data,
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details
      } : null
    }, null, 2));

    if (error) {
      console.error('❌ 결제 상태 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '결제 정보 조회 실패',
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      console.warn(`⚠️ 결제 정보 없음: paymentId=${paymentId}`);
      return NextResponse.json({
        success: false,
        message: '해당 결제 정보를 찾을 수 없습니다',
        status: 'NOT_FOUND'
      }, { status: 404 });
    }

    console.log(`✅ 조회된 결제 상태: paymentId=${paymentId}, status=${data?.status}, updated_at=${data?.updated_at}`);
    
    // 추가 디버깅 정보
    console.log("📦 응답 데이터 전체:", {
      data: data,
      status존재여부: 'status' in data,
      status값: data.status, 
      status타입: typeof data.status
    });

    const responseData = {
      success: true,
      paymentId,
      status: data.status,
      transaction_id: data.transaction_id,
      updated_at: data.updated_at
    };
    
    console.log("🚀 최종 응답:", JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error('❌ 결제 상태 조회 중 오류:', err);
    return NextResponse.json({
      success: false,
      message: '서버 오류',
      error: err.message
    }, { status: 500 });
  }
} 