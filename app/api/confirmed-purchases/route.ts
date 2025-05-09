import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

export async function GET(request: NextRequest) {
  try {
    // API 라우트에 특화된 Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // 세션 확인
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('인증 세션 오류: 세션 없음');
      return NextResponse.json(
        { success: false, error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Supabase에서 확인된 구매 내역 가져오기 (개선된 쿼리)
    const { data, error } = await supabase
      .from("purchases")
      .select(`
        id,
        total_price,
        status,
        updated_at,
        ticket_title,
        post:post_id (
          title,
          event_date,
          event_venue
        ),
        seller:seller_id (
          name
        ),
        ratings(id)
      `)
      .eq("buyer_id", userId)
      .eq("status", "CONFIRMED")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error('구매 내역 조회 오류:', error);
      return NextResponse.json(
        { success: false, error: '구매 내역을 가져오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 콘솔에 디버깅 정보 출력 (개발 시에만 활성화)
    console.log('구매 내역 샘플:', data && data.length > 0 ? JSON.stringify(data[0], null, 2) : '데이터 없음');

    // 배열 인덱싱으로 Supabase 조인 결과 접근 (개선된 매핑)
    const mapped = data.map((purchase) => ({
      id: purchase.id,
      title: purchase.ticket_title || (purchase.post?.[0]?.title ?? "제목 없음"),
      date: purchase.post?.[0]?.event_date || purchase.event_date || '날짜 정보 없음',
      venue: purchase.post?.[0]?.event_venue || purchase.event_venue || '장소 정보 없음',
      price: purchase.total_price ? `${purchase.total_price.toLocaleString()}원` : '가격 정보 없음',
      status: purchase.status,
      seller: purchase.seller?.[0]?.name ?? "판매자 없음",
      completedAt: purchase.updated_at,
      reviewSubmitted: purchase.ratings?.length > 0
    }));

    return NextResponse.json({ success: true, purchases: mapped });
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 