import { NextResponse, NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

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

// 사용 가능한 게시물을 위한 타입 정의
type AvailablePost = {
  id: number;
  title: string;
  content?: string;
  author_id?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_deleted?: boolean;
  ticket_price?: number;
  event_name?: string;
  event_date?: string;
  event_venue?: string;
  image_url?: string;
  user_id?: string;
};

// 포맷된 게시물 타입 정의
interface FormattedPost {
  id: number;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string | null;
  ticketPrice: number;
  eventName: string;
  eventDate: string | null;
  eventVenue: string | null;
  imageUrl: string | null;
  authorId: string | null;
}

// 작성자 정보 타입 정의
interface AuthorInfo {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  rating?: number;
}

// 작성자 맵 타입 정의
interface AuthorsMap {
  [key: string]: AuthorInfo;
}

// 작성자 정보가 포함된 게시물 타입 정의
interface PostWithAuthor extends FormattedPost {
  author: {
    id: string;
    name: string;
    email: string;
    profileImage: string | null;
    rating: number;
  } | null;
}

/**
 * 구매 가능한 상품 목록을 제공하는 API
 * get_available_posts() 함수를 사용하여 이미 구매된 상품은 자동으로 제외됨
 */
export async function GET(req: NextRequest) {
  try {
    // URL 쿼리 파라미터 추출
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    // 카테고리 파라미터 비활성화
    // const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    
    // 페이지네이션 계산
    const offset = (page - 1) * limit;
    
    // Supabase Admin 클라이언트 생성
    const adminSupabase = createAdminClient();
    
    // RPC 함수 호출로 구매 가능한 게시물 가져오기
    // from('available_posts') 대신 rpc('get_available_posts') 사용
    // 먼저 rpc 함수 실행하여 구매 가능한 게시물 가져오기
    const { data: availablePosts, error: rpcError } = await adminSupabase
      .from('available_posts_with_author')
      .select('*');
    
    if (rpcError) {
      return addCorsHeaders(NextResponse.json({
        success: false,
        message: '구매 가능한 게시물 목록을 조회하는 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? rpcError : undefined
      }, { status: 500 }));
    }
    
    // 함수에서 반환된 게시물에 필터 적용
    let filteredPosts = availablePosts || [];
    
    // 카테고리 필터링 비활성화
    /*
    // 카테고리 필터링 추가
    if (category) {
      filteredPosts = filteredPosts.filter((post: any) => post.category === category);
    }
    */
    
    // 검색어 필터링 추가
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPosts = filteredPosts.filter((post: any) => 
        (post.title && post.title.toLowerCase().includes(searchLower)) || 
        (post.content && post.content.toLowerCase().includes(searchLower))
      );
    }
    
    // 생성 날짜 기준 정렬 (내림차순)
    filteredPosts.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // 내림차순
    });
    
    // 페이지네이션 적용
    const totalCount = filteredPosts.length;
    const posts = filteredPosts.slice(offset, offset + limit);
    
    // 응답 데이터 구성 - 결과를 명시적인 타입으로 변환하여 처리
    const formattedPosts: PostWithAuthor[] = posts?.map((post: any) => ({
      id: post.id,
      title: post.title || '',
      content: post.content?.substring(0, 100) + (post.content && post.content.length > 100 ? '...' : '') || '',
      category: post.category || 'GENERAL',
      createdAt: post.created_at || new Date().toISOString(),
      updatedAt: post.updated_at || null,
      ticketPrice: post.ticket_price || 0,
      eventName: post.event_name || post.title || '',
      eventDate: post.event_date || null,
      eventVenue: post.event_venue || null,
      imageUrl: post.image_url || null,
      authorId: post.author_id || post.user_id || null,
      author: {
        id: post.author_id || post.user_id || null,
        name: post.author_name || '',
        email: post.author_email || '',
        profileImage: post.author_image || null,
        rating: post.author_rating || 4.5
      }
    })) || [];

    // 작성자 정보가 포함된 데이터를 클라이언트에 직접 반환
    return addCorsHeaders(NextResponse.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      },
      source: 'available_posts_with_author'
    }));
  } catch (error) {
    return addCorsHeaders(NextResponse.json({
      success: false,
      message: '게시물 목록을 조회하는 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 }));
  }
}

// OPTIONS 메서드 처리 (CORS 프리플라이트 요청을 위한)
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}