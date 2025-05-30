import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase';

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

// POST: 제안 수락
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[🎯 제안 수락 API] POST 요청 시작 - 제안 ID:', params.id);
  
  try {
    // 원래 방식대로 일반 작업에는 서버 클라이언트 사용
    const supabase = createSupabaseServerClient();
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
        posts (id, title, author_id)
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

    // 4. 같은 포스트의 다른 제안들을 거절 상태로 변경
    const { error: rejectOthersError } = await supabase
      .from('proposals')
      .update({
        status: 'REJECTED',
        updated_at: new Date().toISOString()
      })
      .eq('post_id', proposal.post_id)
      .neq('id', proposalId)
      .eq('status', 'PENDING');

    if (rejectOthersError) {
      console.warn('[🎯 제안 수락 API] 다른 제안 거절 처리 오류:', rejectOthersError);
      // 치명적이지 않으므로 계속 진행
    }

    // 5. 포스트 상태를 거래 진행중으로 변경
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

    console.log('[🎯 제안 수락 API] 제안 수락 완료:', proposalId);

    // 6. Purchase 레코드 생성 (기존 진행중인 거래 탭 재활용)
    try {
      // 주문번호 생성 (타임스탬프 기반)
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      // 안전한 데이터 접근
      const postData = proposal.posts;
      const buyerId = postData?.author_id; // 요청자 = 구매자
      const sellerId = proposal.proposer_id; // 제안자 = 판매자
      const ticketTitle = postData?.title || '티켓 요청';
      
      console.log('[🎯 제안 수락 API] Purchase 생성 데이터:', {
        post_id: proposal.post_id,
        buyer_id: buyerId,
        seller_id: sellerId,
        total_price: proposal.proposed_price,
        order_number: orderNumber,
        ticket_title: ticketTitle
      });

      // 필수 데이터 검증
      if (!buyerId || !sellerId) {
        console.error('[🎯 제안 수락 API] 필수 ID 누락:', { buyerId, sellerId });
        throw new Error('구매자 또는 판매자 ID가 누락되었습니다.');
      }
      
      const insertData = {
        post_id: proposal.post_id,
        buyer_id: buyerId,
        seller_id: sellerId,
        total_price: proposal.proposed_price,
        quantity: 1, // 기본값
        status: 'PROCESSING',
        order_number: orderNumber,
        ticket_title: ticketTitle,
        event_date: postData?.event_date || null,
        event_venue: postData?.event_venue || null, 
        ticket_price: proposal.proposed_price,
        payment_method: 'PENDING', // 결제 방법 미정
        created_at: new Date().toISOString()
      };

      console.log('[🎯 제안 수락 API] Purchase INSERT 데이터:', insertData);
      
      // Purchase 생성에만 관리자 클라이언트 사용 (RLS 우회)
      const adminSupabase = createAdminClient();
      
      const { data: purchaseData, error: purchaseError } = await adminSupabase
        .from('purchases')
        .insert(insertData)
        .select()
        .single();

      if (purchaseError) {
        console.error('[🎯 제안 수락 API] Purchase 레코드 생성 실패:', {
          error: purchaseError,
          code: purchaseError.code,
          message: purchaseError.message,
          details: purchaseError.details,
          hint: purchaseError.hint
        });
        // 에러를 throw하지 않고 로그만 남김 (제안 수락은 성공하도록)
      } else {
        console.log('[🎯 제안 수락 API] Purchase 레코드 생성 성공:', purchaseData.id);
      }
    } catch (purchaseCreateError) {
      console.error('[🎯 제안 수락 API] Purchase 생성 중 예외 발생:', {
        error: purchaseCreateError,
        message: purchaseCreateError instanceof Error ? purchaseCreateError.message : String(purchaseCreateError)
      });
      // 치명적이지 않으므로 계속 진행
    }

    // TODO: 알림 발송 (제안자에게 수락 알림)
    // await sendNotification(proposal.proposer_id, 'PROPOSAL_ACCEPTED', ...)

    return NextResponse.json(
      { 
        success: true, 
        message: '제안이 성공적으로 수락되었습니다! 진행중인 거래에서 확인하세요.',
        proposalId: proposalId
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