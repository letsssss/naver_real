import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { getTokenFromHeaders, getTokenFromCookies, verifyToken, isDevelopment } from '@/lib/auth';

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

// 개별 알림을 읽음으로 표시
export async function POST(req: Request) {
  try {
    console.log('개별 알림 읽음 표시 API 호출됨');
    
    // 요청 본문 파싱
    const body = await req.json();
    const { id: notificationId } = body;
    
    // 알림 ID 유효성 검사
    if (!notificationId) {
      console.log('알림 ID가 제공되지 않음');
      return new NextResponse(
        JSON.stringify({ error: '알림 ID가 필요합니다.' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }
    
    console.log(`알림 ID(${notificationId})를 읽음으로 표시합니다.`);
    
    // JWT 토큰 확인 (옵션 - 필요한 경우 권한 확인)
    const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
    let userId = 0;
    
    if (token) {
      // 개발 환경이 아닌 경우에만 토큰 검증
      if (!isDevelopment) {
        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
          return new NextResponse(
            JSON.stringify({ error: '유효하지 않은 인증 토큰입니다.' }),
            { 
              status: 401,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
              }
            }
          );
        }
        userId = decoded.userId;
      } else {
        userId = 3; // 개발 환경에서 기본 사용자 ID
      }
    } else if (isDevelopment) {
      userId = 3; // 개발 환경에서 토큰이 없는 경우에도 기본 사용자 ID
    }
    
    // Supabase로 알림 업데이트 시도, 실패 시 Prisma로 폴백
    let updated = false;
    
    // 1. Supabase 업데이트 시도
    try {
      if (supabase) {
        console.log('Supabase로 알림 업데이트 시도...');
        
        const { data, error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .select();
        
        if (error) {
          console.error('Supabase 알림 업데이트 오류:', error);
          throw error; // Prisma 폴백으로 진행
        }
        
        if (data && data.length > 0) {
          console.log('Supabase로 알림 업데이트 성공:', data[0]);
          updated = true;
        } else {
          console.log('Supabase 업데이트했지만 결과가 없음, Prisma로 폴백');
          throw new Error('업데이트된 알림이 없음');
        }
      } else {
        throw new Error('Supabase 클라이언트 사용 불가');
      }
    } catch (supabaseError) {
      console.log('Supabase 업데이트 실패, Prisma로 폴백:', supabaseError);
      
      // 2. Prisma 폴백 - 특정 알림 업데이트
      try {
        // 권한 확인 (같은 사용자의 알림인지 확인)
        if (userId > 0) {
          const notification = await prisma.notification.findUnique({
            where: { id: Number(notificationId) },
            select: { userId: true }
          });
          
          // 알림이 존재하고 다른 사용자의 알림인 경우 (프로덕션에서만 검사)
          if (notification && notification.userId !== userId && !isDevelopment) {
            return new NextResponse(
              JSON.stringify({ error: '이 알림을 수정할 권한이 없습니다.' }),
              { 
                status: 403,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
              }
            );
          }
        }
        
        // 알림 업데이트
        const notification = await prisma.notification.update({
          where: { id: Number(notificationId) },
          data: { isRead: true },
          select: { id: true, message: true, isRead: true }
        });
        
        console.log('Prisma로 알림 업데이트 성공:', notification);
        updated = true;
      } catch (prismaError) {
        console.error('Prisma 알림 업데이트 오류:', prismaError);
        
        if ((prismaError as any).code === 'P2025') {
          // 알림을 찾을 수 없음
          return new NextResponse(
            JSON.stringify({ error: '알림을 찾을 수 없습니다.' }),
            { 
              status: 404,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
              }
            }
          );
        }
        
        throw prismaError;
      }
    }
    
    if (!updated) {
      throw new Error('알림 업데이트 실패');
    }
    
    return new NextResponse(
      JSON.stringify({ 
        success: true, 
        message: '알림이 읽음으로 표시되었습니다.',
        id: notificationId
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  } catch (error) {
    console.error('알림 읽음 표시 중 오류:', error);
    
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        message: '알림 업데이트 중 오류가 발생했습니다.',
        error: isDevelopment ? String(error) : undefined
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  }
} 