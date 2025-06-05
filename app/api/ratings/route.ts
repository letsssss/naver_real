import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase-admin';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, rating, comment } = body;

    console.log("리뷰 등록 요청:", { transactionId, rating, comment });

    // 관리자 권한으로 Supabase 클라이언트 생성
    const supabase = createAdminClient();

    // 1. 거래 정보 확인
    const { data: transaction, error: transactionError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (transactionError || !transaction) {
      console.error('거래 조회 오류:', transactionError);
      return NextResponse.json(
        { error: '해당 거래를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 이미 리뷰가 존재하는지 확인
    const { data: existingRating, error: existingError } = await supabase
      .from('ratings')
      .select('id')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existingError) {
      console.error('기존 리뷰 확인 오류:', existingError);
      return NextResponse.json(
        { error: '리뷰 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    if (existingRating) {
      console.log('이미 리뷰가 존재함:', existingRating);
      return NextResponse.json(
        { error: '이미 이 거래에 대한 리뷰를 작성하셨습니다.' },
        { status: 409 }
      );
    }

    // 3. 새 리뷰 등록
    const { data: newRating, error: insertError } = await supabase
      .from('ratings')
      .insert({
        transaction_id: transactionId,
        rating: rating,
        comment: comment,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('리뷰 등록 오류:', insertError);
      return NextResponse.json(
        { error: '리뷰 등록에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log('리뷰 등록 성공:', newRating);

    return NextResponse.json({
      message: '리뷰가 성공적으로 등록되었습니다.',
      rating: newRating
    });

  } catch (error) {
    console.error('리뷰 등록 처리 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// OPTIONS 요청 처리 (CORS 프리플라이트 지원)
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 204 }));
} 