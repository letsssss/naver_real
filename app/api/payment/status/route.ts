import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const payment_id = searchParams.get('payment_id');

    console.log(`🔍 결제 상태 조회 요청: payment_id=${payment_id}`);

    if (!payment_id) {
      console.warn('❌ payment_id 파라미터 누락');
      return NextResponse.json({ 
        success: false, 
        message: 'payment_id 파라미터가 필요합니다' 
      }, { status: 400 });
    }

    const supabase = createClient();
    
    // ⭐️ 중요: payment_id -> id 필드로 수정 (웹훅과 일치시킴)
    // Supabase에서 id 필드로 결제 상태 조회 (payment_id 아님!)
    const { data, error } = await supabase
      .from('payments')
      .select('status, transaction_id, updated_at')
      .eq('id', payment_id) // payment_id -> id로 변경
      .single();

    if (error) {
      console.error('❌ 결제 상태 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '결제 정보 조회 실패',
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      console.warn(`⚠️ 결제 정보 없음: payment_id=${payment_id}`);
      return NextResponse.json({
        success: false,
        message: '해당 결제 정보를 찾을 수 없습니다',
        status: 'NOT_FOUND'
      }, { status: 404 });
    }

    console.log(`✅ 조회된 결제 상태: payment_id=${payment_id}, status=${data?.status}, updated_at=${data?.updated_at}`);

    return NextResponse.json({
      success: true,
      payment_id,
      status: data.status,
      transaction_id: data.transaction_id,
      updated_at: data.updated_at
    });
  } catch (err: any) {
    console.error('❌ 결제 상태 조회 중 오류:', err);
    return NextResponse.json({
      success: false,
      message: '서버 오류',
      error: err.message
    }, { status: 500 });
  }
} 