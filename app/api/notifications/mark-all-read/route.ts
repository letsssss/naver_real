import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getTokenFromHeaders, getTokenFromCookies, verifyToken, isDevelopment } from '@/lib/auth';

// verifyToken 반환 타입 정의
interface TokenPayload {
  userId: string | number;
  email?: string;
  role?: string;
}

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
    console.log('모든 알림 읽음 표시 API 호출됨');
    
    const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
    console.log('토큰 정보:', token ? '토큰 있음' : '토큰 없음');
    
    let userId: number = 0;

    if (isDevelopment) {
      userId = 3;
      console.log(`개발 환경에서 기본 사용자 ID(${userId}) 사용`);
    } else {
      if (!token) {
        return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
      }

      const decoded = await verifyToken(token) as TokenPayload;
      if (!decoded || !decoded.userId) {
        return NextResponse.json({ error: '유효하지 않은 인증 토큰입니다.' }, { status: 401 });
      }

      userId = Number(decoded.userId);
    }

    console.log(`사용자 ID(${userId})의 모든 알림을 읽음으로 표시합니다.`);

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId.toString());

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
        error: isDevelopment ? String(error) : undefined
      },
      { status: 500 }
    );
  }
} 