import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

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
    const supabase = createServerSupabaseClient();
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
        section_id: selectedSectionId,
        section_name: selectedSectionName,
        proposed_price: parseInt(proposedPrice),
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
    const supabase = createServerSupabaseClient();
    const requestId = params.id;
    
    if (!requestId) {
      return NextResponse.json(
        { success: false, message: '티켓 요청 ID가 필요합니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 숫자로 변환
    const postId = parseInt(requestId);
    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 티켓 요청 ID입니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log('[🎯 제안 API] 제안 목록 조회 시도 - post_id:', postId);

    // 먼저 해당 포스트가 존재하는지 확인
    const { data: postCheck, error: postCheckError } = await supabase
      .from('posts')
      .select('id, title, category')
      .eq('id', postId)
      .eq('category', 'TICKET_REQUEST')
      .single();

    if (postCheckError || !postCheck) {
      console.error('[🎯 제안 API] 포스트 확인 오류:', postCheckError);
      return NextResponse.json(
        { success: false, message: '해당 티켓 요청을 찾을 수 없습니다.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log('[🎯 제안 API] 포스트 확인 성공:', postCheck);

    // 기본 제안 목록부터 조회 (users JOIN 없이)
    const { data: basicProposals, error: basicError } = await supabase
      .from('proposals')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    console.log('[🎯 제안 API] 기본 제안 조회 결과:', { 
      error: basicError, 
      count: basicProposals?.length || 0,
      proposals: basicProposals 
    });

    if (basicError) {
      console.error('[🎯 제안 API] 기본 제안 조회 오류:', basicError);
      return NextResponse.json(
        { success: false, message: '제안 목록 조회 중 오류가 발생했습니다.', error: basicError.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 제안이 있다면 users 정보와 함께 다시 조회
    let proposals = basicProposals;
    if (basicProposals && basicProposals.length > 0) {
      const { data: detailedProposals, error: detailedError } = await supabase
        .from('proposals')
        .select(`
          id,
          post_id,
          proposer_id,
          section_id,
          section_name,
          proposed_price,
          message,
          status,
          created_at,
          updated_at
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (detailedError) {
        console.warn('[🎯 제안 API] 상세 정보 조회 실패, 기본 정보만 반환:', detailedError);
        proposals = basicProposals;
      } else {
        // 각 제안에 대해 실제 웹사이트와 동일한 판매자 정보 조회
        const proposalsWithSellerInfo = await Promise.all(
          detailedProposals.map(async (proposal) => {
            try {
              // 1. 프로필 정보 (response_rate 포함)
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, name, profile_image, response_rate')
                .eq('id', proposal.proposer_id)
                .maybeSingle();

              // 2. 판매자 통계 (successful_sales 포함)
              const { data: statsData } = await supabase
                .from('seller_stats')
                .select('successful_sales')
                .eq('seller_id', proposal.proposer_id)
                .maybeSingle();

              // 3. 평점 통계
              const { data: ratingStats } = await supabase
                .from('seller_rating_stats_view')
                .select('avg_rating, review_count')
                .eq('seller_id', proposal.proposer_id)
                .maybeSingle();

              return {
                ...proposal,
                proposer: {
                  id: profileData?.id || proposal.proposer_id,
                  name: profileData?.name || '사용자',
                  profile_image: profileData?.profile_image,
                  response_rate: profileData?.response_rate,
                  successful_sales: statsData?.successful_sales || 0,
                  rating: ratingStats?.avg_rating || 0,
                  review_count: ratingStats?.review_count || 0
                }
              };
            } catch (error) {
              console.warn('[🎯 제안 API] 판매자 정보 조회 실패:', proposal.proposer_id, error);
              return {
                ...proposal,
                proposer: {
                  id: proposal.proposer_id,
                  name: '사용자',
                  successful_sales: 0,
                  rating: 0,
                  review_count: 0
                }
              };
            }
          })
        );

        proposals = proposalsWithSellerInfo;
        console.log('[🎯 제안 API] 실제 웹사이트와 동일한 데이터 소스로 조회 성공');
      }
    }

    console.log(`[🎯 제안 API] 제안 목록 조회 성공 - ${proposals?.length || 0}개 발견`);
    
    return NextResponse.json(
      { 
        success: true,
        proposals: proposals || [],
        count: proposals?.length || 0,
        debug: {
          postId,
          postExists: !!postCheck,
          hasBasicProposals: !!(basicProposals && basicProposals.length > 0)
        }
      },
      { headers: CORS_HEADERS }
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