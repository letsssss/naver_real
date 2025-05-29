import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

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
    const supabase = createServerSupabaseClient();
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

    // TODO: 알림 발송 (제안자에게 수락 알림)
    // await sendNotification(proposal.proposer_id, 'PROPOSAL_ACCEPTED', ...)

    return NextResponse.json(
      { 
        success: true, 
        message: '제안이 성공적으로 수락되었습니다!',
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