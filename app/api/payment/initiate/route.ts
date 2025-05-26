import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // 서버 Supabase 클라이언트

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const { userId, postId, amount, phoneNumber, selectedSeats } = body;

    if (!userId || !postId || !amount) {
      return NextResponse.json({ success: false, message: '필수 데이터 누락' }, { status: 400 });
    }
    
    // 타입 변환 - 문자열 ID를 적절한 형식으로 변환
    const formattedUserId = typeof userId === 'string' ? userId : String(userId);
    const formattedPostId = typeof postId === 'string' ? parseInt(postId, 10) : postId;
    const formattedAmount = typeof amount === 'string' ? parseInt(amount, 10) : amount;
    
    // 데이터 유효성 다시 검증
    if (!formattedUserId || isNaN(formattedPostId) || isNaN(formattedAmount)) {
      console.error('💥 데이터 형식 오류:', { userId, postId, amount, formattedUserId, formattedPostId, formattedAmount });
      return NextResponse.json({ 
        success: false, 
        message: '데이터 형식 오류', 
        details: { userId, postId, amount } 
      }, { status: 400 });
    }

    // 고유한 주문번호 생성
    const paymentId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // DB에 결제 시도 기록 전 디버깅 로그 추가
    console.log('💾 DB 기록 시도 데이터:', {
      paymentId,
      userId: formattedUserId,
      postId: formattedPostId,
      amount: formattedAmount,
      dataTypes: {
        userId: typeof formattedUserId,
        postId: typeof formattedPostId,
        amount: typeof formattedAmount
      }
    });

    // DB에 결제 시도 기록
    const { data, error } = await supabase.from('payments').insert({
      id: paymentId,
      user_id: formattedUserId,
      post_id: formattedPostId,
      amount: formattedAmount,
      phone_number: phoneNumber,
      seats: selectedSeats,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    }).select('id');

    if (error) {
      console.error('🔴 결제 시작 기록 실패:', JSON.stringify(error, null, 2));
      return NextResponse.json({ success: false, message: 'DB 기록 실패', error }, { status: 500 });
    }

    console.log('✅ 결제 시작 기록 성공:', paymentId);
    return NextResponse.json({ success: true, paymentId });
  } catch (error: any) {
    console.error('🔴 결제 초기화 API 오류:', error);
    return NextResponse.json({ success: false, message: '서버 오류', error: error.message }, { status: 500 });
  }
} 