import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 캐시 방지 헤더
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

/**
 * 사용자 ID 배열을 받아 해당 사용자들의 정보를 일괄 조회하는 API
 * 작성자 정보를 효율적으로 가져오기 위해 사용됩니다.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userIds } = body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: '유효한 사용자 ID 목록이 필요합니다.' },
        { status: 400 }
      ));
    }
    
    // 중복 제거 및 유효한 ID만 필터링
    const validUserIds = [...new Set(userIds)].filter(id => id && id !== 'undefined' && id !== 'null');
    
    // 유효한 ID가 없는 경우 빈 배열 반환
    if (validUserIds.length === 0) {
      return addCorsHeaders(NextResponse.json({
        success: true,
        users: []
      }));
    }
    
    // Supabase Admin 클라이언트 생성
    const adminSupabase = createAdminClient();
    
    // 먼저 users 테이블에서 조회 시도
    const { data: usersData, error: usersError } = await adminSupabase
      .from('users')
      .select('id, name, email, profile_image, rating')
      .in('id', validUserIds);
    
    if (usersError) {
      // users 테이블 조회 실패 시 profiles 테이블에서 시도
      const { data: profilesData, error: profilesError } = await adminSupabase
        .from('profiles')
        .select('id, name, email, avatar_url, rating')
        .in('id', validUserIds);
      
      if (profilesError) {
        return addCorsHeaders(NextResponse.json(
          { success: false, message: '사용자 정보 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        ));
      }
      
      // profiles 테이블 데이터 형식 통일
      const formattedProfiles = profilesData.map(profile => ({
        id: profile.id,
        name: profile.name || '판매자 정보 없음',
        email: profile.email || '',
        profile_image: profile.avatar_url || '',
        rating: profile.rating || 4.5
      }));
      
      return addCorsHeaders(NextResponse.json({
        success: true,
        users: formattedProfiles
      }));
    }
    
    return addCorsHeaders(NextResponse.json({
      success: true,
      users: usersData
    }));
  } catch (error) {
    return addCorsHeaders(NextResponse.json(
      { success: false, message: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    ));
  }
}

// OPTIONS 메서드 처리 (CORS 프리플라이트 요청)
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
} 