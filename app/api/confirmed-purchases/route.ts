import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';

// CORS 헤더 설정
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ISO 문자열을 "YYYY-MM-DD HH:mm" 형식으로 변환하는 함수
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    
    // 날짜가 유효하지 않은 경우
    if (isNaN(date.getTime())) {
      return isoString;
    }
    
    // 년, 월, 일 추출
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // 시간, 분 추출 (한국 시간으로 변환)
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // "YYYY-MM-DD HH:mm" 형식으로 반환
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    console.error('날짜 포맷팅 오류:', error);
    return isoString; // 오류 발생 시 원본 반환
  }
}

export async function GET(request: NextRequest) {
  try {
    // API 라우트에 특화된 Supabase 클라이언트 생성
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // 세션 확인
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('인증 세션 오류: 세션 없음');
      return new NextResponse(
        JSON.stringify({ success: false, error: '인증되지 않은 사용자입니다.' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    const userId = session.user.id;

    // 개선된 쿼리: EXISTS 서브쿼리를 사용하여 리뷰 제출 여부 직접 확인
    const { data, error } = await supabase.rpc('get_confirmed_purchases_with_review_status', {
      user_id: userId
    });

    if (error) {
      console.error('구매 내역 조회 오류:', error);
      
      // 저장 프로시저가 없는 경우 대체 쿼리로 시도
      console.log('저장 프로시저 실패, 직접 쿼리로 시도합니다.');
      
      // 기존 방식으로 다시 시도
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("purchases")
        .select(`
          id,
          total_price,
          status,
          updated_at,
          ticket_title,
          post:post_id (
            title,
            event_date,
            event_venue
          ),
          seller:seller_id (
            name
          ),
          ratings(id),
          order_number
        `)
        .eq("buyer_id", userId)
        .eq("status", "CONFIRMED")
        .order("updated_at", { ascending: false });
      
      if (fallbackError) {
        console.error('대체 쿼리 실패:', fallbackError);
        return new NextResponse(
          JSON.stringify({ success: false, error: '구매 내역을 가져오는 중 오류가 발생했습니다.' }),
          { 
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
      
      // 대체 쿼리의 데이터 사용
      const mapped = fallbackData.map((purchase) => {
        // 타입 단언으로 post 타입 명시
        const post = purchase.post as {
          title?: string;
          event_date?: string;
          event_venue?: string;
        };
        
        // 타입 단언으로 seller 타입 명시
        const seller = purchase.seller as {
          name?: string;
        };

        // reviewSubmitted 값 확실하게 boolean으로 처리 (명시적 변환)
        const hasReview = Array.isArray(purchase.ratings) ? purchase.ratings.length > 0 : false;

        return {
          id: purchase.id,
          title: purchase.ticket_title || post?.title || "제목 없음",
          date: post?.event_date || '날짜 정보 없음',
          venue: post?.event_venue || '장소 정보 없음',
          price: purchase.total_price ? `${purchase.total_price.toLocaleString()}원` : '가격 정보 없음',
          status: purchase.status,
          seller: seller?.name || "판매자 없음",
          completedAt: purchase.updated_at ? formatDate(purchase.updated_at) : '시간 정보 없음',
          reviewSubmitted: hasReview,
          order_number: purchase.order_number || `ORDER-${purchase.id}`
        };
      });
      
      return new NextResponse(
        JSON.stringify({ success: true, purchases: mapped }),
        { 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    // 콘솔에 디버깅 정보 출력 (개발 시에만 활성화)
    console.log('구매 내역 샘플:', data && data.length > 0 ? JSON.stringify(data[0], null, 2) : '데이터 없음');

    // RPC 결과 매핑
    const mapped = data.map((purchase) => {
      return {
        id: purchase.id,
        title: purchase.ticket_title || purchase.post_title || "제목 없음",
        date: purchase.event_date || '날짜 정보 없음',
        venue: purchase.event_venue || '장소 정보 없음',
        price: purchase.total_price ? `${purchase.total_price.toLocaleString()}원` : '가격 정보 없음',
        status: purchase.status,
        seller: purchase.seller_name || "판매자 없음",
        completedAt: purchase.updated_at ? formatDate(purchase.updated_at) : '시간 정보 없음',
        reviewSubmitted: purchase.review_submitted, // 서버에서 직접 계산된 리뷰 제출 여부
        order_number: purchase.order_number || `ORDER-${purchase.id}`
      };
    });

    return new NextResponse(
      JSON.stringify({ success: true, purchases: mapped }),
      { 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error) {
    console.error('API 오류:', error);
    return new NextResponse(
      JSON.stringify({ success: false, error: '서버 오류가 발생했습니다.' }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
} 