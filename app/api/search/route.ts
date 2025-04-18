import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

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

export async function GET(req: NextRequest) {
  try {
    console.log("[검색 API] GET 요청 시작");
    
    // URL 쿼리 파라미터 추출
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    console.log(`[검색 API] 요청 파라미터: query=${query}, page=${page}, limit=${limit}`);
    
    // 페이지네이션 계산
    const offset = (page - 1) * limit;
    
    // Supabase Admin 클라이언트 생성
    const supabase = createAdminClient();
    
    // 쿼리 빌더 시작
    let query_builder = supabase
      .from('posts')
      .select(`
        *,
        users!posts_author_id_fkey (id, name, email)
      `)
      .eq('is_deleted', false)
      .eq('status', 'ACTIVE');
    
    // 검색어 필터링 적용
    if (query) {
      query_builder = query_builder.ilike('title', `%${query}%`);
    }
    
    // 실제 쿼리 실행
    const { data, error, count } = await query_builder
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .limit(limit);
    
    if (error) {
      console.error("[검색 API] 쿼리 실행 오류:", error);
      return addCorsHeaders(NextResponse.json({
        success: false,
        message: '검색 결과를 조회하는 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      }, { status: 500 }));
    }
    
    // 전체 결과 개수를 얻기 위한 카운트 쿼리
    let countQuery = supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('status', 'ACTIVE')
      .ilike('title', `%${query}%`);
    
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.warn("[검색 API] 카운트 쿼리 오류:", countError);
    }
    
    console.log(`[검색 API] 조회 성공: ${data?.length || 0}개 게시물 발견`);
    
    // 응답 데이터 구성
    const formattedPosts = data?.map((post: any) => ({
      id: post.id,
      title: post.title,
      content: post.content?.substring(0, 100) + (post.content && post.content.length > 100 ? '...' : ''),
      category: post.category || 'GENERAL',
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      ticketPrice: post.ticket_price || 0,
      eventName: post.event_name || post.title,
      eventDate: post.event_date || null,
      eventVenue: post.event_venue || null,
      imageUrl: post.image_url || null,
      authorId: post.author_id,
      author: post.users ? {
        id: post.users.id,
        name: post.users.name,
        email: post.users.email
      } : null
    })) || [];
    
    return addCorsHeaders(NextResponse.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        totalCount: totalCount || formattedPosts.length,
        totalPages: Math.ceil((totalCount || formattedPosts.length) / limit),
        currentPage: page,
        hasMore: offset + (data?.length || 0) < (totalCount || 0)
      },
      filters: {
        search: query || null
      },
      source: 'search_api'
    }, { status: 200 }));
  } catch (error) {
    console.error("[검색 API] 오류:", error);
    
    return addCorsHeaders(NextResponse.json({
      success: false,
      message: '검색 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 }));
  }
}

// OPTIONS 메서드 처리 (CORS 프리플라이트 요청을 위한)
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
} 