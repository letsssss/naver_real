import { NextResponse, NextRequest } from "next/server";
import { adminSupabase, supabase } from "@/lib/supabase";

// available_posts 뷰에 대한 타입 정의
type AvailablePost = {
  id: number;
  title: string;
  content?: string;
  created_at: string;
  updated_at?: string | null;
  status?: string;
  user_id?: string;
  category?: string;
  price?: number;
  is_deleted?: boolean;
  ticket_price?: number;
  event_name?: string;
  event_date?: string;
  event_venue?: string;
  image_url?: string;
  published?: boolean;
};

// CORS 헤더 설정을 위한 함수
function addCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 캐시 방지 헤더 강화
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

/**
 * 구매 가능한 상품 목록을 제공하는 API
 * available_posts 뷰를 사용하여 이미 구매된 상품은 자동으로 제외됨
 */
export async function GET(req: NextRequest) {
  try {
    // URL 쿼리 파라미터 추출
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const category = url.searchParams.get('category');
    const searchQuery = url.searchParams.get('search');
    // 캐시 방지를 위한 타임스탬프
    const timestamp = Date.now();

    console.log(`[Available Posts API] 요청 받음: page=${page}, limit=${limit}, category=${category}, search=${searchQuery}, t=${timestamp}`);

    // ----- available_posts 뷰 조회 -----
    console.log("[Available Posts API] available_posts 뷰 데이터 확인 중...");
    
    // 💡 available_posts 뷰 직접 사용: 타입 오류 우회를 위해 as any 사용
    let query = (adminSupabase
      .from('available_posts') as any)  // ✅ 반드시 뷰 사용!
      .select('*', { count: 'exact' });

    // 활성 상태이고 삭제되지 않은 상품만 선택
    query = query.eq('status', 'ACTIVE')
      .eq('is_deleted', false);

    // 카테고리 필터링
    if (category) {
      query = query.eq('category', category);
    }

    // 검색어 필터링
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    // 페이지네이션 적용
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 최종 쿼리 실행
    query = query.order('created_at', { ascending: false })
      .range(from, to);
      
    const { data: posts, error, count } = await query;
    
    if (error) {
      console.error('[Available Posts API] 데이터 조회 오류:', error);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: '구매 가능한 상품 목록을 조회하는 중 오류가 발생했습니다.' },
        { status: 500 }
      ));
    }

    // 각 게시물의 ID 출력 (디버깅용)
    if (posts) {
      console.log("반환되는 게시물 ID 목록:", posts.map((post: AvailablePost) => post.id));
      
      // 구매 여부 체크 (디버깅용)
      console.log("반환되는 게시물 상세 정보:");
      posts.forEach((post: AvailablePost) => {
        console.log(`- 상품 ID: ${post.id}, 제목: ${post.title}, 구매됨: 아니오(available_posts 뷰에서 가져옴)`);
      });
    }
    
    console.log(`[Available Posts API] 응답: ${posts?.length || 0}개 항목, 총 ${count || 0}개`);

    // 총 개수 별도 조회 (available_posts 뷰 count가 정확하지 않을 경우를 대비)
    let totalCount = count;  // 기본적으로 쿼리 결과의 count 사용

    // count가 없거나 부정확한 경우, 별도로 count 쿼리 실행
    if (!count) {
      try {
        const countResult = await (adminSupabase
          .from('available_posts') as any)
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ACTIVE')
          .eq('is_deleted', false);
        
        if (countResult && countResult.count !== undefined) {
          totalCount = countResult.count;
          console.log(`[Available Posts API] 별도 count 쿼리 결과: ${totalCount}개`);
        }
      } catch (countError) {
        console.error('[Available Posts API] count 조회 오류:', countError);
      }
    }

    // 응답 데이터 구성
    return addCorsHeaders(NextResponse.json({
      success: true,
      posts: posts || [],
      pagination: {
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        currentPage: page,
        pageSize: limit,
        hasMore: (from + (posts?.length || 0)) < (totalCount || 0)
      },
      timestamp,
      filteredBy: {
        using_view: 'available_posts', // ✅ 뷰 사용 명시
        category,
        searchQuery
      }
    }));
  } catch (error) {
    console.error('[Available Posts API] 처리 중 오류 발생:', error);
    return addCorsHeaders(NextResponse.json(
      { success: false, message: '요청을 처리하는 중 오류가 발생했습니다.' },
      { status: 500 }
    ));
  }
}