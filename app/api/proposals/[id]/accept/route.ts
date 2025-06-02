import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';

// CORS 헤더 설정
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// 간단한 주문 번호 생성 함수
async function createSimpleOrderNumber() {
  const timestamp = new Date().getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORDER-${timestamp}-${random}`;
}

// POST: 제안 수락
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[🎯 제안 수락 API] POST 요청 시작 - 제안 ID:', params.id);
  
  try {
    // 원래 방식대로 일반 작업에는 서버 클라이언트 사용
    const supabase = createSupabaseServerClient();
    const adminSupabase = createAdminClient();
    const proposalId = params.id;
    
    if (!proposalId) {
      return NextResponse.json(
        { success: false, message: '제안 ID가 필요합니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. 제안 존재 여부 및 상태 확인
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        *,
        posts (id, title, author_id, ticket_price)
      `)
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error('[🎯 제안 수락 API] 제안 조회 오류:', proposalError);
      return NextResponse.json(
        { success: false, message: '해당 제안을 찾을 수 없습니다.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 2. 이미 처리된 제안인지 확인
    if (proposal.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, message: '이미 처리된 제안입니다.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. 제안 상태를 수락으로 변경
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'ACCEPTED',
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    if (updateError) {
      console.error('[🎯 제안 수락 API] 제안 업데이트 오류:', updateError);
      return NextResponse.json(
        { success: false, message: '제안 수락 처리 중 오류가 발생했습니다.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 4. 포스트 상태를 거래 진행중으로 변경
    const { error: postUpdateError } = await supabase
      .from('posts')
      .update({
        status: 'IN_PROGRESS',
        updated_at: new Date().toISOString()
      })
      .eq('id', proposal.post_id);

    if (postUpdateError) {
      console.warn('[🎯 제안 수락 API] 포스트 상태 업데이트 오류:', postUpdateError);
      // 치명적이지 않으므로 계속 진행
    }

    // 5. Proposal Transaction 레코드 생성 (별도 테이블)
    const orderNumber = await createSimpleOrderNumber();
    
    const proposalTransactionData = {
      proposal_id: parseInt(proposalId),
      post_id: proposal.post_id,
      buyer_id: proposal.posts.author_id, // 티켓을 요청한 사람이 구매자
      seller_id: proposal.proposer_id,    // 제안한 사람이 판매자
      order_number: orderNumber,
      status: 'PROCESSING',
      total_price: proposal.proposed_price,
      selected_seats: proposal.section_name,
      quantity: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('[🎯 제안 수락 API] Proposal Transaction 데이터 생성:', proposalTransactionData);

    const { data: proposalTransaction, error: proposalTransactionError } = await adminSupabase
      .from('proposal_transactions')
      .insert(proposalTransactionData)
      .select()
      .single();

    if (proposalTransactionError) {
      console.error('[🎯 제안 수락 API] Proposal Transaction 생성 오류:', proposalTransactionError);
      return NextResponse.json(
        { success: false, message: 'Proposal Transaction 생성 중 오류가 발생했습니다.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    console.log('[🎯 제안 수락 API] 제안 수락 및 Proposal Transaction 생성 완료:', { proposalId, orderNumber });

    // 수락 성공 메시지
    return NextResponse.json(
      { 
        success: true, 
        message: '제안이 성공적으로 수락되었습니다!',
        proposalId: proposalId,
        orderNumber: orderNumber,
        transactionId: proposalTransaction.id
      },
      { status: 200, headers: CORS_HEADERS }
    );

  } catch (error) {
    console.error('[🎯 제안 수락 API] 전역 오류:', error);
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