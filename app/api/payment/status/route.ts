import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const payment_id = searchParams.get('payment_id');

    if (!payment_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'payment_id 파라미터가 필요합니다' 
      }, { status: 400 });
    }

    const supabase = createClient();
    
    // Supabase에서 payment_id로 결제 상태 조회
    const { data, error } = await supabase
      .from('payments')
      .select('status, transaction_id, code, updated_at')
      .eq('payment_id', payment_id)
      .single();

    if (error) {
      console.error('결제 상태 조회 오류:', error);
      return NextResponse.json({
        success: false,
        message: '결제 정보 조회 실패',
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        message: '해당 결제 정보를 찾을 수 없습니다',
        status: 'NOT_FOUND'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      payment_id,
      status: data.status,
      transaction_id: data.transaction_id,
      code: data.code,
      updated_at: data.updated_at
    });
  } catch (err: any) {
    console.error('결제 상태 조회 중 오류:', err);
    return NextResponse.json({
      success: false,
      message: '서버 오류',
      error: err.message
    }, { status: 500 });
  }
} 