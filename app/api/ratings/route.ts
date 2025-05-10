import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// CORS 헤더 추가 유틸리티 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

// 평점 스키마 유효성 검사
const ratingSchema = z.object({
  transactionId: z.number(),
  rating: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 인증된 사용자 정보 가져오기 (createRouteHandlerClient 방식으로 통일)
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return addCorsHeaders(
        NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
      );
    }

    const reviewerId = session.user.id;

    // 요청 본문 파싱
    const body = await req.json();
    const parsed = ratingSchema.safeParse(body);
    
    if (!parsed.success) {
      return addCorsHeaders(
        NextResponse.json({ 
          error: '유효하지 않은 요청 데이터입니다.', 
          details: parsed.error.format() 
        }, { status: 400 })
      );
    }

    const { transactionId, rating, comment } = parsed.data;

    // 1. 거래 내역 확인 (본인의 거래인지, 상태는 CONFIRMED인지)
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('id, buyer_id, seller_id, status')
      .eq('id', transactionId)
      .single();

    if (purchaseError || !purchase) {
      console.error('거래 조회 오류:', purchaseError);
      return addCorsHeaders(
        NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 })
      );
    }

    if (purchase.buyer_id !== reviewerId) {
      return addCorsHeaders(
        NextResponse.json({ error: '본인의 거래만 평가할 수 있습니다.' }, { status: 403 })
      );
    }

    if (purchase.status !== 'CONFIRMED') {
      return addCorsHeaders(
        NextResponse.json({ error: '완료된 거래만 평가할 수 있습니다.' }, { status: 400 })
      );
    }

    // 2. 이미 평점이 있는지 확인
    const { data: existing, error: existingError } = await supabase
      .from('ratings')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();

    if (existingError && !existingError.message.includes('No rows found')) {
      console.error('기존 평점 조회 오류:', existingError);
      return addCorsHeaders(
        NextResponse.json({ error: '평점 조회 중 오류가 발생했습니다.' }, { status: 500 })
      );
    }

    if (existing) {
      return addCorsHeaders(
        NextResponse.json({ error: '이미 평가가 완료된 거래입니다.' }, { status: 409 })
      );
    }

    // 3. 평점 저장
    const { error: insertError } = await supabase.from('ratings').insert({
      transaction_id: transactionId,
      reviewer_id: reviewerId,
      seller_id: purchase.seller_id,
      rating,
      comment,
      created_at: new Date().toISOString()
    });

    if (insertError) {
      console.error('평점 저장 오류:', insertError);
      return addCorsHeaders(
        NextResponse.json({ error: '평가 저장 중 오류가 발생했습니다.' }, { status: 500 })
      );
    }

    // 4. 판매자의 평균 평점 업데이트 (선택적)
    // 판매자의 모든 평점을 가져와서 평균 계산
    const { data: sellerRatings, error: ratingsError } = await supabase
      .from('ratings')
      .select('rating')
      .eq('seller_id', purchase.seller_id);

    if (!ratingsError && sellerRatings && sellerRatings.length > 0) {
      // 평균 평점 계산
      const totalRating = sellerRatings.reduce((sum, item) => sum + (item.rating || 0), 0);
      const averageRating = totalRating / sellerRatings.length;
      
      // 사용자 테이블에 평균 평점 업데이트 (users 테이블에 rating 필드가 있는 경우)
      const { error: updateError } = await supabase
        .from('users')
        .update({ rating: averageRating })
        .eq('id', purchase.seller_id);
      
      if (updateError) {
        console.warn('판매자 평균 평점 업데이트 실패:', updateError);
        // 경고만 기록하고 실패 처리는 하지 않음 (비필수 기능)
      }
    }

    return addCorsHeaders(
      NextResponse.json({ 
        success: true, 
        message: '평가가 성공적으로 등록되었습니다.' 
      }, { status: 201 })
    );
  } catch (error: any) {
    console.error('평점 등록 중 오류 발생:', error);
    return addCorsHeaders(
      NextResponse.json({ 
        error: '서버 오류가 발생했습니다.', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      }, { status: 500 })
    );
  }
}

// OPTIONS 요청 처리 (CORS 프리플라이트 지원)
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 204 }));
} 