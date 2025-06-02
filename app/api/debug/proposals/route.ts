import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// 개발 환경에서만 사용할 디버깅 API
export async function GET(req: NextRequest) {
  // 프로덕션에서는 접근 차단
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const supabase = createAdminClient();
    
    // proposals 테이블의 모든 데이터 조회 (최근 10개)
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select(`
        *,
        posts (id, title),
        proposer:users!proposer_id (id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Proposals 조회 오류:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `총 ${proposals?.length || 0}개의 제안이 있습니다`,
      proposals: proposals || [],
      debug: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    });

  } catch (error) {
    console.error('Debug API 오류:', error);
    return NextResponse.json(
      { error: 'Server error', details: String(error) },
      { status: 500 }
    );
  }
} 