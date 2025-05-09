import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import supabase from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // 인증된 사용자 가져오기
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Supabase에서 확인된 구매 내역 가져오기
    const { data, error } = await supabase
      .from("purchases")
      .select(`
        id,
        total_price,
        status,
        updated_at,
        ticket_title,
        event_date,
        event_venue,
        seller:seller_id ( name ),
        post:post_id ( title ),
        ratings(id)
      `)
      .eq("buyer_id", userId)
      .eq("status", "CONFIRMED")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error('구매 내역 조회 오류:', error);
      return NextResponse.json(
        { error: '구매 내역을 가져오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 배열 인덱싱으로 Supabase 조인 결과 접근
    const mapped = data.map((purchase) => ({
      id: purchase.id,
      title: purchase.ticket_title || (purchase.post?.[0]?.title ?? "제목 없음"),
      date: purchase.event_date || '날짜 정보 없음',
      venue: purchase.event_venue || '장소 정보 없음',
      price: purchase.total_price ? `${purchase.total_price.toLocaleString()}원` : '가격 정보 없음',
      status: '거래완료',
      seller: purchase.seller?.[0]?.name ?? "판매자 없음",
      completedAt: new Date(purchase.updated_at).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(/\//g, '-'),
      reviewSubmitted: purchase.ratings?.length > 0
    }));

    return NextResponse.json({ success: true, purchases: mapped });
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 