import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { supabase, createServerSupabaseClient } from '@/lib/supabase';
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

// 모든 알림을 읽음으로 표시
export async function POST(req: Request) {
  try {
    console.log('모든 알림 읽음 표시 API 호출됨');
    
    // JWT 토큰 확인
    const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
    console.log('토큰 정보:', token ? '토큰 있음' : '토큰 없음');
    
    // 사용자 ID 결정
    let userId: number = 0;
    
    if (isDevelopment) {
      // 개발 환경에서는 기본 사용자 ID 사용
      userId = 3; // 기본 테스트 사용자 ID
      console.log(`개발 환경에서 기본 사용자 ID(${userId}) 사용`);
    } else {
      // 프로덕션 환경에서는 토큰 검증 필요
      if (!token) {
        return new NextResponse(
          JSON.stringify({ error: '인증 토큰이 필요합니다.' }),
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
    }
    
    console.log(`사용자 ID(${userId})의 모든 알림을 읽음으로 표시합니다.`);
    
    // Supabase로 알림 업데이트 시도, 실패 시 Prisma로 폴백
    let updated = false;
    
    // 1. Supabase 업데이트 시도
    try {
      if (supabase) {
        console.log('Supabase로 알림 업데이트 시도...');
        
        const { data, error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId.toString())
          .select();
        
        if (error) {
          console.error('Supabase 알림 업데이트 오류:', error);
          throw error; // Prisma 폴백으로 진행
        }
        
        console.log(`Supabase로 ${data?.length || 0}개 알림 업데이트 성공`);
        updated = true;
      } else {
        throw new Error('Supabase 클라이언트 사용 불가');
      }
    } catch (supabaseError) {
      console.log('Supabase 업데이트 실패, Prisma로 폴백:', supabaseError);
      
      // 2. Prisma 폴백 - 모든 알림 업데이트
      try {
        const result = await prisma.notification.updateMany({
          where: { userId },
          data: { isRead: true }
        });
        
        console.log(`Prisma로 ${result.count}개 알림 업데이트 성공`);
        updated = true;
      } catch (prismaError) {
        console.error('Prisma 알림 업데이트 오류:', prismaError);
        throw prismaError;
      }
    }
    
    if (!updated) {
      throw new Error('알림 업데이트 실패');
    }
    
    return new NextResponse(
      JSON.stringify({ 
        success: true, 
        message: '모든 알림이 읽음으로 표시되었습니다.' 
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
    console.error('모든 알림 읽음 표시 중 오류:', error);
    
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