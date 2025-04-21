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

// 단일 알림 읽음 표시
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, message: '알림 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token) as TokenPayload;

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, message: '유효하지 않은 인증 토큰입니다.' },
        { status: 401 }
      );
    }

    const userId = String(decoded.userId);

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select();

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { success: false, message: '알림을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: '알림이 읽음으로 표시되었습니다.',
      notification: data[0]
    });

  } catch (error) {
    console.error('알림 읽음 표시 중 오류:', error);

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