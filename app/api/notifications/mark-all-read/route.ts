import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken, getTokenFromHeaders, getTokenFromCookies } from '@/lib/auth';
import { supabase, createServerSupabaseClient } from '@/lib/supabase';

// OPTIONS 요청 처리
export async function OPTIONS(request: Request) {
  return new NextResponse(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// 모든 알림 읽음 표시
export async function POST(req: Request) {
  try {
    console.log('모든 알림 읽음 처리 API 호출됨');
    
    // 토큰 확인
    const token = getTokenFromHeaders(req.headers) || getTokenFromCookies(req);
    console.log('토큰 정보:', token ? '토큰 있음' : '토큰 없음');
    
    if (!token) {
      console.log('토큰이 없음');
      return new NextResponse(
        JSON.stringify({ 
          error: '로그인이 필요합니다.', 
          code: 'AUTH_ERROR' 
        }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

    // Supabase 토큰 검증 시도
    let userId: number | null = null;
    
    try {
      // 1. 먼저 Supabase 토큰 검증 시도
      const supabaseClient = createServerSupabaseClient(token);
      const { data: { user }, error: supabaseError } = await supabaseClient.auth.getUser();
      
      if (supabaseError) {
        console.log('Supabase 토큰 검증 실패:', supabaseError.message);
        // Supabase 인증 실패하면 기존 JWT 검증 시도
        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
          console.log('기존 JWT 토큰도 유효하지 않음');
          throw new Error('유효하지 않은 인증 정보');
        }
        userId = decoded.userId;
      } else if (user) {
        console.log('Supabase 사용자 확인됨:', user.email);
        // Supabase 사용자의 메타데이터에서 userId 가져오기
        // 또는 이메일로 Prisma DB에서 사용자 조회
        const prismaUser = await prisma.user.findUnique({
          where: { email: user.email || '' },
          select: { id: true }
        });
        
        if (!prismaUser) {
          console.log('DB에서 사용자를 찾을 수 없음:', user.email);
          throw new Error('사용자 정보를 찾을 수 없습니다');
        }
        
        userId = prismaUser.id;
      }
    } catch (authError) {
      console.error('인증 오류:', authError);
      return new NextResponse(
        JSON.stringify({ 
          error: '유효하지 않은 인증 정보입니다.', 
          code: 'AUTH_ERROR' 
        }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

    if (!userId) {
      console.log('유효한 사용자 ID를 확인할 수 없음');
      return new NextResponse(
        JSON.stringify({ 
          error: '유효하지 않은 인증 정보입니다.', 
          code: 'AUTH_ERROR' 
        }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

    // 해당 사용자의 모든 알림을 읽음 상태로 업데이트
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId: userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });

      console.log(`${result.count}개의 알림이 읽음 처리되었습니다.`);
      
      return new NextResponse(
        JSON.stringify({ 
          success: true, 
          message: `${result.count}개의 알림이 읽음 처리되었습니다.`,
          count: result.count
        }),
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    } catch (dbError) {
      console.error('알림 업데이트 오류:', dbError);
      return new NextResponse(
        JSON.stringify({ 
          error: '알림 처리 중 오류가 발생했습니다.', 
          code: 'DB_ERROR' 
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }
  } catch (error) {
    console.error('알림 읽음 처리 API 오류:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: '서버에서 오류가 발생했습니다.', 
        code: 'SERVER_ERROR' 
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  }
} 