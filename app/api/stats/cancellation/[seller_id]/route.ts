import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: { seller_id: string } }) {
  const supabase = createAdminClient();

  const { seller_id } = params;
  
  console.log("[✅ 취켓팅 통계 API 진입] seller_id:", seller_id);

  try {
    const { data, error } = await supabase
      .from('cancellation_ticketing_stats_view')
      .select('confirmed_count, cancelled_count, cancellation_ticketing_rate')
      .eq('seller_id', seller_id)
      .single();

    if (error) {
      console.error("❌ 취켓팅 통계 조회 오류:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ 취켓팅 통계 조회 성공:", data);
    
    // 결과가 없는 경우 기본값 반환
    if (!data) {
      return NextResponse.json({
        confirmed_count: 0,
        cancelled_count: 0,
        cancellation_ticketing_rate: 0
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("❌ 취켓팅 통계 API 오류:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
} 