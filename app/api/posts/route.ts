import { NextResponse } from 'next/server';
import { 
  supabase, 
  createServerSupabaseClient, 
  formatUserId
} from '@/lib/supabase';
import { validateRequestToken } from '@/lib/auth';

// 표준 응답 헤더
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// API 응답 생성 유틸리티
function createApiResponse(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

// 오류 응답 생성 유틸리티
function createErrorResponse(message: string, code: string, status = 500, details?: any) {
  return NextResponse.json({
    error: message,
    code,
    details: process.env.NODE_ENV === 'development' ? details : undefined
  }, { status, headers: CORS_HEADERS });
}

// CORS 사전 요청 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

// GET 요청 처리 - 게시물 목록 또는 특정 게시물 조회
export async function GET(req: Request) {
  try {
    console.log('[게시물 API] GET 요청 시작');
    
    const url = new URL(req.url);
    const postIdParam = url.searchParams.get('id');
    
    // ID가 제공된 경우 단일 게시물 조회
    if (postIdParam) {
      const postId = parseInt(postIdParam, 10);
      if (isNaN(postId)) {
        return createErrorResponse('유효하지 않은 게시물 ID입니다.', 'INVALID_ID', 400);
      }
      
      return await getPostById(postId);
    }
    
    // 전체 게시물 목록 조회
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('limit') || '10', 10);
    
    return await getPosts(page, pageSize);
  } catch (error) {
    console.error('[게시물 API] 조회 오류:', error);
    return createErrorResponse(
      '게시물을 조회하는 중 오류가 발생했습니다.', 
      'SERVER_ERROR', 
      500, 
      error
    );
  }
}

// 단일 게시물 조회 핸들러
async function getPostById(postId: number) {
  // 게시물 조회
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(id, name, email),
      comments(*)
    `)
    .eq('id', postId)
    .single();
  
  if (error) {
    console.error('[게시물 API] 단일 게시물 조회 오류:', error);
    
    if (error.code === 'PGRST116') {
      return createErrorResponse('게시물을 찾을 수 없습니다.', 'NOT_FOUND', 404);
    }
    
    return createErrorResponse(
      '게시물을 조회하는 중 오류가 발생했습니다.', 
      'DB_ERROR', 
      500, 
      error
    );
  }
  
  if (!post) {
    return createErrorResponse('게시물을 찾을 수 없습니다.', 'NOT_FOUND', 404);
  }
  
  // 좋아요 수 조회
  const { count: likesCount, error: likesError } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  
  if (likesError) {
    console.warn('[게시물 API] 좋아요 수 조회 오류:', likesError);
  }
  
  // 응답 데이터 구성
  const formattedPost = {
    id: post.id,
    title: post.title,
    content: post.content,
    published: post.published,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    likesCount: likesCount || 0,
    author: post.user ? {
      id: post.user.id,
      name: post.user.name,
      email: post.user.email
    } : null,
    comments: post.comments ? post.comments.map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      userId: comment.user_id
    })) : []
  };
  
  return createApiResponse({ post: formattedPost });
}

// 게시물 목록 조회 핸들러
async function getPosts(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  
  // 게시물 목록 조회
  const { data: posts, error, count } = await supabase
    .from('posts')
    .select(`
      *,
      user:users(id, name, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);
  
  if (error) {
    console.error('[게시물 API] 목록 조회 오류:', error);
    return createErrorResponse(
      '게시물 목록을 조회하는 중 오류가 발생했습니다.', 
      'DB_ERROR', 
      500, 
      error
    );
  }
  
  // 응답 데이터 구성
  const formattedPosts = posts.map(post => ({
    id: post.id,
    title: post.title,
    content: post.content.substring(0, 200) + (post.content.length > 200 ? '...' : ''),
    published: post.published,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    author: post.user ? {
      id: post.user.id,
      name: post.user.name,
      email: post.user.email
    } : null
  }));
  
  return createApiResponse({
    posts: formattedPosts,
    pagination: {
      totalCount: count || 0,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
      currentPage: page,
      pageSize,
      hasMore: (offset + posts.length) < (count || 0)
    }
  });
}

// POST 요청 처리 - 새 게시물 생성
export async function POST(req: Request) {
  try {
    console.log('[게시물 API] POST 요청 시작');
    
    // 사용자 인증
    const { userId, authenticated } = await validateRequestToken(req);
    
    if (!authenticated) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }
    
    // 요청 본문 파싱
    const body = await req.json();
    const { title, content } = body;
    
    // 필수 필드 검증
    if (!title || !content) {
      return createErrorResponse(
        '제목과 내용은 필수 항목입니다.', 
        'VALIDATION_ERROR', 
        400
      );
    }
    
    // 게시물 생성
    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        title,
        content,
        user_id: userId,
        published: true
      })
      .select()
      .single();
    
    if (error) {
      console.error('[게시물 API] 생성 오류:', error);
      return createErrorResponse(
        '게시물을 생성하는 중 오류가 발생했습니다.', 
        'DB_ERROR', 
        500, 
        error
      );
    }
    
    // 응답 데이터
    const formattedPost = {
      id: post.id,
      title: post.title,
      content: post.content,
      published: post.published,
      createdAt: post.created_at,
      userId: post.user_id
    };
    
    return createApiResponse({ post: formattedPost }, 201);
  } catch (error) {
    console.error('[게시물 API] 생성 전역 오류:', error);
    return createErrorResponse(
      '게시물을 생성하는 중 오류가 발생했습니다.', 
      'SERVER_ERROR', 
      500, 
      error
    );
  }
}

// PUT 요청 처리 - 게시물 수정
export async function PUT(req: Request) {
  try {
    console.log('[게시물 API] PUT 요청 시작');
    
    // 사용자 인증
    const { userId, authenticated } = await validateRequestToken(req);
    
    if (!authenticated) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }
    
    // 요청 본문 파싱
    const body = await req.json();
    const { id, title, content, published } = body;
    
    // 필수 필드 검증
    if (!id || (!title && !content && published === undefined)) {
      return createErrorResponse(
        '게시물 ID와 수정할 내용은 필수 항목입니다.', 
        'VALIDATION_ERROR', 
        400
      );
    }
    
    // 게시물 소유자 확인
    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingPost) {
      console.error('[게시물 API] 조회 오류:', fetchError);
      return createErrorResponse(
        '게시물을 찾을 수 없습니다.', 
        'NOT_FOUND', 
        404, 
        fetchError
      );
    }
    
    // 권한 확인
    if (existingPost.user_id !== userId) {
      return createErrorResponse(
        '이 게시물을 수정할 권한이 없습니다.', 
        'FORBIDDEN', 
        403
      );
    }
    
    // 업데이트할 필드 구성
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (published !== undefined) updateData.published = published;
    updateData.updated_at = new Date().toISOString();
    
    // 게시물 업데이트
    const { data: updatedPost, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[게시물 API] 업데이트 오류:', error);
      return createErrorResponse(
        '게시물을 업데이트하는 중 오류가 발생했습니다.', 
        'DB_ERROR', 
        500, 
        error
      );
    }
    
    // 응답 데이터
    const formattedPost = {
      id: updatedPost.id,
      title: updatedPost.title,
      content: updatedPost.content,
      published: updatedPost.published,
      createdAt: updatedPost.created_at,
      updatedAt: updatedPost.updated_at,
      userId: updatedPost.user_id
    };
    
    return createApiResponse({ post: formattedPost });
  } catch (error) {
    console.error('[게시물 API] 업데이트 전역 오류:', error);
    return createErrorResponse(
      '게시물을 업데이트하는 중 오류가 발생했습니다.', 
      'SERVER_ERROR', 
      500, 
      error
    );
  }
}

// DELETE 요청 처리 - 게시물 삭제
export async function DELETE(req: Request) {
  try {
    console.log('[게시물 API] DELETE 요청 시작');
    
    // 사용자 인증
    const { userId, authenticated } = await validateRequestToken(req);
    
    if (!authenticated) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }
    
    // 요청 파라미터 파싱
    const url = new URL(req.url);
    const postIdParam = url.searchParams.get('id');
    
    if (!postIdParam) {
      return createErrorResponse(
        '게시물 ID는 필수 항목입니다.', 
        'VALIDATION_ERROR', 
        400
      );
    }
    
    const postId = parseInt(postIdParam, 10);
    if (isNaN(postId)) {
      return createErrorResponse(
        '유효하지 않은 게시물 ID입니다.', 
        'VALIDATION_ERROR', 
        400
      );
    }
    
    // 게시물 소유자 확인
    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single();
    
    if (fetchError || !existingPost) {
      console.error('[게시물 API] 조회 오류:', fetchError);
      return createErrorResponse(
        '게시물을 찾을 수 없습니다.', 
        'NOT_FOUND', 
        404, 
        fetchError
      );
    }
    
    // 권한 확인
    if (existingPost.user_id !== userId) {
      return createErrorResponse(
        '이 게시물을 삭제할 권한이 없습니다.', 
        'FORBIDDEN', 
        403
      );
    }
    
    // 게시물 삭제 (관련 댓글과 좋아요는 CASCADE로 자동 삭제)
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    
    if (error) {
      console.error('[게시물 API] 삭제 오류:', error);
      return createErrorResponse(
        '게시물을 삭제하는 중 오류가 발생했습니다.', 
        'DB_ERROR', 
        500, 
        error
      );
    }
    
    return createApiResponse({ 
      success: true, 
      message: '게시물이 성공적으로 삭제되었습니다.' 
    });
  } catch (error) {
    console.error('[게시물 API] 삭제 전역 오류:', error);
    return createErrorResponse(
      '게시물을 삭제하는 중 오류가 발생했습니다.', 
      'SERVER_ERROR', 
      500, 
      error
    );
  }
} 