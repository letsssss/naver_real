import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// OPTIONS 요청 처리
export async function OPTIONS(request: Request) {
  return new NextResponse(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// 모든 알림을 읽음으로 표시
export async function POST(req: Request) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // Supabase 관리자 클라이언트로 토큰 검증
    const adminClient = createAdminClient();
    
    // 토큰으로 사용자 정보 가져오기
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 모든 알림을 읽음으로 표시
    const { data, error } = await adminClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id);

    if (error) {
      console.error('Supabase 알림 업데이트 오류:', error);
      return NextResponse.json({ success: false, message: '알림 업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '모든 알림이 읽음으로 표시되었습니다.' 
    });

  } catch (error) {
    console.error('모든 알림 읽음 표시 중 오류:', error);

    return NextResponse.json(
      { 
        success: false, 
        message: '알림 업데이트 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
} 