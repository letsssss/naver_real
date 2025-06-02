import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase-admin';

// verifyToken 반환 타입 정의
interface DecodedToken {
  userId: string | number;
  name?: string;
  email?: string;
}

// CORS 헤더 추가 함수
const addCorsHeaders = (response: NextResponse) => {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
};

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return addCorsHeaders(
    NextResponse.json({}, { status: 200 })
  );
}

/**
 * 현재 로그인한 사용자 정보를 조회하는 API
 */
export async function GET(req: NextRequest) {
  try {
    // 요청 헤더에서 토큰 추출
    const authHeader = req.headers.get('authorization');
    let token;

    // 헤더로부터 토큰 확인
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } 
    // 쿠키에서 토큰 확인
    else {
      const cookieStore = cookies();
      token = cookieStore.get('token')?.value;
    }

    // 토큰이 없으면 401 에러
    if (!token) {
      return NextResponse.json(
        { error: '인증 토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    // 토큰 검증
    const decoded = await verifyToken(token) as DecodedToken;
    
    // 토큰이 유효하지 않으면 401 에러
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 사용자 정보 조회
    const userId = decoded.userId;
    
    // Supabase에서 사용자 정보 조회
    const { data: user, error } = await createAdminClient()
      .from('users')
      .select('id, email, name, role, profileImage, phoneNumber, createdAt')
      .eq('id', Number(userId))
      .single();

    // 오류가 있거나 사용자 정보가 없으면 404 에러
    if (error || !user) {
      console.error('사용자 조회 실패:', error);
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용자 정보 반환
    return NextResponse.json({
      user: {
        ...user,
        // createdAt이 이미 문자열일 수 있으므로 타입 체크
        createdAt: typeof user.createdAt === 'string' 
          ? user.createdAt 
          : new Date(user.createdAt).toISOString()
      }
    });
  } catch (error: any) {
    // 서버 에러 처리
    console.error('사용자 정보 조회 오류:', error);
    return NextResponse.json(
      { error: '사용자 정보를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 