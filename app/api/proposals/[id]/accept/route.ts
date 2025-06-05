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
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const proposalId = parseInt(params.id);
    
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: '로그인이 필요합니다.' 
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const adminSupabase = createAdminClient();
    
    // 토큰으로 사용자 정보 확인
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (!user || authError) {
      return NextResponse.json({ 
        error: '인증에 실패했습니다.' 
      }, { status: 401 });
    }

    // 1. 제안 정보 가져오기
    const { data: proposal, error: proposalError } = await adminSupabase
      .from('proposals')
      .select(`
        id,
        post_id,
        proposer_id,
        proposed_price,
        section_name,
        message,
        posts (
          id,
          title,
          author_id,
          event_date,
          event_venue,
          ticket_price
        )
      `)
      .eq('id', proposalId)
      .eq('status', 'PENDING')
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json({ 
        error: '제안을 찾을 수 없거나 이미 처리된 제안입니다.' 
      }, { status: 404 });
    }

    // 2. 권한 확인 (티켓 요청자만 수락 가능)
    const post = proposal.posts as any;
    if (post.author_id !== user.id) {
      return NextResponse.json({ 
        error: '권한이 없습니다.' 
      }, { status: 403 });
    }

    // 3. 트랜잭션으로 제안 수락 및 거래 생성
    const orderNumber = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    
    // 제안 상태 업데이트
    const { error: updateError } = await adminSupabase
      .from('proposals')
      .update({ 
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    if (updateError) {
      throw updateError;
    }

    // 거래 생성 (purchases 테이블)
    const { data: purchase, error: purchaseError } = await adminSupabase
      .from('purchases')
      .insert({
        order_number: orderNumber,
        buyer_id: user.id, // 티켓 요청자가 구매자
        seller_id: proposal.proposer_id, // 제안자가 판매자
        post_id: proposal.post_id,
        quantity: 1,
        total_price: proposal.proposed_price,
        status: 'PENDING_PAYMENT',
        ticket_info: {
          section: proposal.section_name,
          price: proposal.proposed_price,
          event_date: post.event_date,
          event_venue: post.event_venue
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('거래 생성 오류:', purchaseError);
      // 제안 상태 롤백
      await adminSupabase
        .from('proposals')
        .update({ status: 'PENDING' })
        .eq('id', proposalId);
      
      throw purchaseError;
    }

    // 4. 다른 제안들 거절 처리
    const { error: rejectError } = await adminSupabase
      .from('proposals')
      .update({ status: 'REJECTED' })
      .eq('post_id', proposal.post_id)
      .neq('id', proposalId);

    if (rejectError) {
      console.error('다른 제안 거절 처리 오류:', rejectError);
    }

    return NextResponse.json({
      success: true,
      message: '제안이 수락되었습니다!',
      data: {
        orderNumber,
        purchaseId: purchase.id,
        proposalId
      }
    });

  } catch (error) {
    console.error('제안 수락 오류:', error);
    return NextResponse.json({ 
      error: '제안 수락에 실패했습니다.' 
    }, { status: 500 });
  }
} 