import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, userId, postId, amount, selectedSeats } = body;

    if (!paymentId) {
      return NextResponse.json({
        success: false,
        message: 'paymentId는 필수 입력 항목입니다'
      }, { status: 400 });
    }

    const supabase = await createClient();

    // 이미 존재하는 payment_id인지 확인
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('payment_id', paymentId)
      .maybeSingle();

    if (existingPayment) {
      return NextResponse.json({
        success: false,
        message: '이미 존재하는 payment_id입니다'
      }, { status: 400 });
    }

    // 결제 정보 저장
    const { data, error } = await supabase
      .from('payments')
      .insert({
        payment_id: paymentId,
        status: 'PENDING',
        user_id: userId || null,
        post_id: postId || null,
        amount: amount || 0,
        metadata: {
          selectedSeats: selectedSeats || []
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('결제 초기화 저장 오류:', error);
      return NextResponse.json({
        success: false,
        message: '결제 초기화 실패',
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '결제 초기화 성공',
      paymentId,
      data
    });
  } catch (err: any) {
    console.error('결제 초기화 중 오류:', err);
    return NextResponse.json({
      success: false,
      message: '서버 오류',
      error: err.message
    }, { status: 500 });
  }
} 