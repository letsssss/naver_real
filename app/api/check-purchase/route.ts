import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 캐시 방지 헤더
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

/**
 * 특정 게시물이 이미 구매되었는지 확인하는 API
 * 
 * 주요 기능:
 * 1. post_id로 purchases 테이블을 검색
 * 2. 구매 기록이 있다면 이미 구매된 것으로 판단
 */
export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터 추출
    const searchParams = new URL(req.url).searchParams;
    const postId = searchParams.get('postId');
    
    if (!postId) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "게시글 ID가 필요합니다." },
        { status: 400 }
      ));
    }
    
    // 현재 인증된 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증이 필요합니다.", isPurchased: false },
        { status: 401 }
      ));
    }
    
    // 해당 게시물의 구매 내역 확인
    const { data: purchases, error: purchaseError } = await supabase
      .from('purchases')
      .select('id')
      .eq('post_id', parseInt(postId, 10));
    
    if (purchaseError) {
      console.error("구매 내역 조회 오류:", purchaseError);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "구매 내역 조회 중 오류가 발생했습니다.", isPurchased: false },
        { status: 500 }
      ));
    }
    
    // 구매 내역이 있으면 이미 구매된 것으로 응답
    const isPurchased = purchases && purchases.length > 0;
    
    return addCorsHeaders(NextResponse.json(
      { 
        success: true, 
        isPurchased,
        message: isPurchased ? "이미 구매된 상품입니다." : "구매 가능한 상품입니다."
      },
      { status: 200 }
    ));
    
  } catch (error) {
    console.error("구매 확인 API 오류:", error);
    return addCorsHeaders(NextResponse.json(
      { 
        success: false, 
        message: "구매 확인 중 오류가 발생했습니다.",
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        isPurchased: false
      },
      { status: 500 }
    ));
  }
} 