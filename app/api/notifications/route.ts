export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { validateRequestToken } from '@/lib/auth';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase.types';

// CORS 기본 헤더
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 표준 응답 생성기
function createApiResponse(data: any, status = 200) {
  return NextResponse.json(data, { 
    status, 
    headers: CORS_HEADERS
  });
}

// 오류 응답 생성기
function createErrorResponse(message: string, code: string, status = 500, details?: any) {
  const isDev = process.env.NODE_ENV === 'development';
  
  return NextResponse.json({ 
    error: message, 
    code,
    details: isDev ? details : undefined
  }, { 
    status, 
    headers: CORS_HEADERS
  });
}

// OPTIONS 프리플라이트 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// 알림 조회 (로그인 필요)
export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    // Supabase 관리자 클라이언트로 토큰 검증
    const adminClient = createAdminClient();
    
    // 토큰으로 사용자 정보 가져오기
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token', details: userError?.message }, { status: 402 });
    }

    // 알림 조회
    const { data, error } = await adminClient
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // 데이터 형식 변환
    const formattedNotifications = (data || []).map(notification => ({
      id: notification.id,
      title: notification.message, // title이 없으면 message 사용
      message: notification.message,
      link: `/notifications/${notification.id}`, // 기본 링크
      isRead: notification.is_read,
      createdAt: notification.created_at,
      type: notification.type || 'SYSTEM'
    }));

    return NextResponse.json({ 
      success: true, 
      notifications: formattedNotifications 
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// 알림 생성
export async function POST(req: Request) {
  try {
    // 관리자 권한 필요한 작업이므로 서버 클라이언트 사용
    const serverClient = createAdminClient();
    
    const body = await req.json();
    const { userId, postId, message, type = 'SYSTEM' } = body;

    // 필수 파라미터 검증
    if (!userId || !message) {
      return createErrorResponse(
        '필수 파라미터가 누락되었습니다.', 
        'VALIDATION_ERROR', 
        400
      );
    }

    // 사용자 ID 형식 변환
    const formattedUserId = String(userId);

    // 알림 데이터 생성
    const notificationData = {
      user_id: formattedUserId,
      post_id: postId,
      message,
      type,
      is_read: false
    };
    
    // 데이터베이스에 저장
    const { data: notification, error } = await serverClient
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();
    
    if (error) {
      console.error('[알림 생성] 오류:', error);
      return createErrorResponse(
        '알림 생성 중 오류가 발생했습니다.', 
        'DB_ERROR', 
        500, 
        error
      );
    }
    
    // 응답 형식 변환
    const formattedNotification = {
      id: notification.id,
      userId: notification.user_id,
      postId: notification.post_id,
      message: notification.message,
      type: notification.type,
      isRead: notification.is_read,
      createdAt: notification.created_at
    };
    
    return createApiResponse({
      success: true,
      notification: formattedNotification
    }, 201);
  } catch (error) {
    console.error('[알림 생성] 전역 오류:', error);
    return createErrorResponse(
      '알림 생성 중 오류가 발생했습니다.', 
      'SERVER_ERROR', 
      500, 
      error
    );
  }
}

// 알림 읽음 상태 변경
export async function PATCH(req: Request) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }

    // Supabase 관리자 클라이언트로 토큰 검증
    const adminClient = createAdminClient();
    
    // 토큰으로 사용자 정보 가져오기
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) {
      return createErrorResponse('유효하지 않은 토큰입니다.', 'AUTH_ERROR', 401);
    }
    
    // 요청 본문 파싱
    const body = await req.json();
    const { notificationId } = body;
    
    if (!notificationId) {
      return createErrorResponse('알림 ID가 필요합니다.', 'VALIDATION_ERROR', 400);
    }
    
    try {
      // 알림 소유자 확인
      const { data: notification, error: fetchError } = await adminClient
        .from('notifications')
        .select('user_id')
        .eq('id', notificationId)
        .single();
      
      if (fetchError) {
        console.error('[알림 업데이트] 조회 오류:', fetchError);
        
        // 개발 환경에서 오류 처리
        if (process.env.NODE_ENV === 'development') {
          return createApiResponse({
            success: true,
            notification: {
              id: notificationId,
              userId: user.id,
              postId: null,
              message: '모의 알림 메시지',
              type: 'SYSTEM',
              isRead: true,
              createdAt: new Date().toISOString()
            }
          });
        }
        
        return createErrorResponse(
          '알림을 찾을 수 없습니다.',
          'NOT_FOUND',
          404,
          fetchError
        );
      }
      
      if (!notification) {
        return createErrorResponse('알림을 찾을 수 없습니다.', 'NOT_FOUND', 404);
      }
      
      // 권한 확인
      if (notification.user_id !== user.id) {
        return createErrorResponse(
          '이 알림에 대한 권한이 없습니다.',
          'FORBIDDEN',
          403
        );
      }
      
      // 읽음 상태 업데이트
      const { data: updatedNotification, error: updateError } = await adminClient
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (updateError) {
        console.error('[알림 업데이트] 업데이트 오류:', updateError);
        
        // 개발 환경에서 오류 처리
        if (process.env.NODE_ENV === 'development') {
          return createApiResponse({
            success: true,
            notification: {
              id: notificationId,
              userId: user.id,
              postId: null,
              message: '모의 알림 메시지 (업데이트 복구)',
              type: 'SYSTEM',
              isRead: true,
              createdAt: new Date().toISOString()
            }
          });
        }
        
        return createErrorResponse(
          '알림 업데이트 중 오류가 발생했습니다.',
          'DB_ERROR',
          500,
          updateError
        );
      }
      
      // 응답 형식 변환
      const formattedNotification = {
        id: updatedNotification.id,
        userId: updatedNotification.user_id,
        postId: updatedNotification.post_id,
        message: updatedNotification.message,
        type: updatedNotification.type,
        isRead: updatedNotification.is_read,
        createdAt: updatedNotification.created_at
      };
      
      return createApiResponse({
        success: true,
        notification: formattedNotification
      });
      
    } catch (innerError) {
      console.error('[알림 업데이트] 내부 처리 오류:', innerError);
      
      // 개발 환경에서 오류 처리
      if (process.env.NODE_ENV === 'development') {
        return createApiResponse({
          success: true,
          notification: {
            id: notificationId,
            userId: user.id,
            postId: null,
            message: '모의 알림 메시지 (내부 오류 복구)',
            type: 'SYSTEM',
            isRead: true,
            createdAt: new Date().toISOString()
          }
        });
      }
      
      return createErrorResponse(
        '알림 업데이트 중 내부 오류가 발생했습니다.',
        'INTERNAL_ERROR',
        500,
        innerError
      );
    }
  } catch (error) {
    console.error('[알림 업데이트] 전역 오류:', error);
    
    // 개발 환경에서 오류 처리
    if (process.env.NODE_ENV === 'development') {
      return createApiResponse({
        success: true,
        notification: {
          id: 0,
          userId: '3',
          postId: null,
          message: '모의 알림 메시지 (전역 오류 복구)',
          type: 'SYSTEM',
          isRead: true,
          createdAt: new Date().toISOString()
        }
      });
    }
    
    return createErrorResponse(
      '알림 업데이트 중 오류가 발생했습니다.',
      'SERVER_ERROR',
      500,
      error
    );
  }
}