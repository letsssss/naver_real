import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // 서버 Supabase 클라이언트

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const body = await req.json();

    const { userId, postId, amount, phoneNumber, selectedSeats } = body;

    if (!userId || !postId || !amount) {
      return NextResponse.json({ success: false, message: '필수 데이터 누락' }, { status: 400 });
    }

    // 고유한 주문번호 생성
    const paymentId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // DB에 결제 시도 기록
    const { data, error } = await supabase.from('payments').insert({
      id: paymentId,
      user_id: userId,
      post_id: postId,
      amount: amount,
      phone_number: phoneNumber,
      seats: selectedSeats,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    }).select('id');

    if (error) {
      console.error('🔴 결제 시작 기록 실패:', error);
      return NextResponse.json({ success: false, message: 'DB 기록 실패', error: error.message }, { status: 500 });
    }

    console.log('✅ 결제 시작 기록 성공:', paymentId);
    return NextResponse.json({ success: true, paymentId });
  } catch (error: any) {
    console.error('🔴 결제 초기화 API 오류:', error);
    return NextResponse.json({ success: false, message: '서버 오류', error: error.message }, { status: 500 });
  }
} 