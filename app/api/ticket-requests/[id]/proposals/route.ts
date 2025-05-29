import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// CORS 헤더 설정
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// POST: 티켓 요청에 제안 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[🎯 제안 API] POST 요청 시작 - 티켓 요청 ID:', params.id);
  
  try {
    const supabase = createSupabaseServerClient();
    const requestId = params.id;
    
    if (!requestId) {
      return NextResponse.json(
        { success: false, message: '티켓 요청 ID가 필요합니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    console.log('[🎯 제안 API] 요청 데이터:', body);
    
    const {
      proposerId,
      selectedSectionId,
      selectedSectionName,
      proposedPrice,
      maxPrice,
      message,
      ticketTitle,
      requesterId
    } = body;

    // 필수 데이터 검증
    if (!proposerId || !selectedSectionId || !proposedPrice) {
      return NextResponse.json(
        { success: false, message: '필수 정보가 누락되었습니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. 티켓 요청 존재 여부 확인
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .select('id, title, author_id, category, status')
      .eq('id', requestId)
      .eq('category', 'TICKET_REQUEST')
      .single();

    if (postError || !postData) {
      console.error('[🎯 제안 API] 티켓 요청 조회 오류:', postError);
      return NextResponse.json(
        { success: false, message: '해당 티켓 요청을 찾을 수 없습니다.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 2. 자신의 요청에는 제안할 수 없음
    if (postData.author_id === proposerId) {
      return NextResponse.json(
        { success: false, message: '자신의 티켓 요청에는 제안할 수 없습니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. 이미 제안한 적이 있는지 확인
    const { data: existingProposal } = await supabase
      .from('proposals')
      .select('id')
      .eq('post_id', requestId)
      .eq('proposer_id', proposerId)
      .single();

    if (existingProposal) {
      return NextResponse.json(
        { success: false, message: '이미 이 요청에 제안하셨습니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 4. 제안 데이터 저장
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .insert({
        post_id: parseInt(requestId),
        proposer_id: proposerId,
        requester_id: requesterId || postData.author_id,
        section_id: selectedSectionId,
        section_name: selectedSectionName,
        proposed_price: parseInt(proposedPrice),
        max_price: parseInt(maxPrice),
        message: message,
        status: 'PENDING',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (proposalError) {
      console.error('[🎯 제안 API] 제안 저장 오류:', proposalError);
      return NextResponse.json(
        { success: false, message: '제안 저장 중 오류가 발생했습니다.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    console.log('[🎯 제안 API] 제안 저장 성공:', proposal.id);

    // 5. 성공 응답
    return NextResponse.json(
      { 
        success: true, 
        message: '제안이 성공적으로 전송되었습니다!',
        proposalId: proposal.id
      },
      { status: 201, headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('[🎯 제안 API] 전역 오류:', error);
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

// GET: 티켓 요청의 제안 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[🎯 제안 API] GET 요청 시작 - 티켓 요청 ID:', params.id);
  
  try {
    const supabase = createSupabaseServerClient();
    const requestId = params.id;
    
    if (!requestId) {
      return NextResponse.json(
        { success: false, message: '티켓 요청 ID가 필요합니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 제안 목록 조회 (제안자 정보 포함)
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select(`
        *,
        proposer:users!proposer_id (
          id,
          name,
          profile_image,
          rating
        )
      `)
      .eq('post_id', requestId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[🎯 제안 API] 제안 목록 조회 오류:', error);
      return NextResponse.json(
        { success: false, message: '제안 목록을 불러올 수 없습니다.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { 
        success: true,
        proposals: proposals || []
      },
      { headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('[🎯 제안 API] 전역 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다.'
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
} 