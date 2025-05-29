import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

// CORS 헤더 설정
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// GET: 내 티켓 요청 목록 조회
export async function GET(req: NextRequest) {
  console.log('[내 티켓 요청 API] GET 요청 시작');
  
  try {
    const supabase = createServerSupabaseClient();
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: '사용자 ID가 필요합니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log('[내 티켓 요청 API] 사용자 ID:', userId);

    // 티켓 요청 목록과 각 요청의 제안 수 조회
    const { data: requests, error } = await supabase
      .from('posts')
      .select(`
        *,
        users (id, name, email),
        proposals (id)
      `, { count: 'exact' })
      .eq('category', 'TICKET_REQUEST')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[내 티켓 요청 API] 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '티켓 요청 목록을 불러올 수 없습니다.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 응답 데이터 구성
    const formattedRequests = requests?.map(request => {
      let parsedContent = null;
      try {
        parsedContent = typeof request.content === 'string' 
          ? JSON.parse(request.content) 
          : request.content;
      } catch (e) {
        console.warn('[내 티켓 요청 API] 콘텐츠 파싱 실패:', e);
        parsedContent = { description: request.content };
      }

      return {
        id: request.id,
        title: request.title,
        content: request.content,
        category: request.category,
        status: request.status || 'ACTIVE',
        created_at: request.created_at,
        updated_at: request.updated_at,
        // 이벤트 정보
        event_name: request.event_name || request.title,
        event_date: request.event_date || parsedContent?.date,
        event_venue: request.event_venue || parsedContent?.venue,
        ticket_price: request.ticket_price,
        // 제안 수 계산
        proposalCount: request.proposals ? request.proposals.length : 0,
        // 파싱된 내용에서 추가 정보
        description: parsedContent?.description || '',
        quantity: parsedContent?.quantity || 1,
        sections: parsedContent?.sections || []
      };
    }) || [];

    console.log(`[내 티켓 요청 API] ${formattedRequests.length}개 요청 조회 성공`);

    return NextResponse.json(
      { 
        success: true,
        requests: formattedRequests,
        count: formattedRequests.length
      },
      { headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('[내 티켓 요청 API] 전역 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
} 