import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';

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
    const supabase = createSupabaseServerClient();
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: '사용자 ID가 필요합니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log('[내 티켓 요청 API] 사용자 ID:', userId);

    // 티켓 요청 목록과 각 요청의 제안 수 및 상태 조회
    const { data: requests, error } = await supabase
      .from('posts')
      .select(`
        *,
        users (id, name, email),
        proposals (id, status, proposed_price, proposer_id, created_at)
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

    // 응답 데이터 구성 - async/await 처리를 위해 Promise.all 사용
    const formattedRequests = await Promise.all(requests?.map(async (request) => {
      let parsedContent = null;
      try {
        parsedContent = typeof request.content === 'string' 
          ? JSON.parse(request.content) 
          : request.content;
      } catch (e) {
        console.warn('[내 티켓 요청 API] 콘텐츠 파싱 실패:', e);
        parsedContent = { description: request.content };
      }

      // 제안 상태 분석
      const proposals = request.proposals || [];
      const totalProposals = proposals.length;
      const acceptedProposal = proposals.find((p: any) => p.status === 'ACCEPTED');
      const pendingProposals = proposals.filter((p: any) => p.status === 'PENDING').length;
      
      // 수락된 제안이 있을 경우 관련 Proposal Transaction 정보 조회
      let acceptedProposalWithTransaction = null;
      if (acceptedProposal) {
        console.log('[내 티켓 요청 API] 수락된 제안 발견:', acceptedProposal.id, typeof acceptedProposal.id);
        
        // 수락된 제안과 연결된 Proposal Transaction 조회
        const { data: transactionData, error: transactionError } = await createAdminClient()
          .from('proposal_transactions')
          .select('id, order_number, status, total_price')
          .eq('proposal_id', parseInt(acceptedProposal.id))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('[내 티켓 요청 API] Transaction 조회 결과:', { 
          proposalId: acceptedProposal.id,
          transactionData, 
          transactionError 
        });

        acceptedProposalWithTransaction = {
          id: acceptedProposal.id,
          proposedPrice: acceptedProposal.proposed_price,
          proposerId: acceptedProposal.proposer_id,
          acceptedAt: acceptedProposal.updated_at || acceptedProposal.created_at,
          // Proposal Transaction 정보 추가
          transaction: transactionData ? {
            id: transactionData.id,
            orderNumber: transactionData.order_number,
            status: transactionData.status,
            totalPrice: transactionData.total_price
          } : null
        };
      }
      
      // 요청 상태 결정
      let requestStatus = 'PENDING'; // 기본: 제안 대기중
      if (acceptedProposal) {
        requestStatus = 'ACCEPTED'; // 제안 수락됨
      } else if (totalProposals > 0) {
        requestStatus = 'HAS_PROPOSALS'; // 제안 있음
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
        // 제안 정보
        proposalCount: totalProposals,
        pendingProposalCount: pendingProposals,
        requestStatus: requestStatus,
        acceptedProposal: acceptedProposalWithTransaction,
        // 파싱된 내용에서 추가 정보
        description: parsedContent?.description || '',
        quantity: parsedContent?.quantity || 1,
        sections: parsedContent?.sections || []
      };
    }) || []);

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