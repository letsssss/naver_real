import { NextResponse } from 'next/server';
import { 
  supabase, 
  createLegacyServerClient, 
  formatUserId,
  createAdminClient
} from '@/lib/supabase';
import { validateRequestToken } from '@/lib/auth';
import { logDetailedError, getUserFriendlyErrorMessage, isSchemaError } from '@/lib/error-utils';
import type { Post } from '@/types/supabase';

// 관리자 클라이언트 생성
const adminSupabase = createAdminClient();

// 어드민 클라이언트가 올바르게 작동하는지 테스트
(async () => {
  try {
    console.log('[Supabase 테스트] 어드민 클라이언트 테스트 중...');
    const { data, error } = await adminSupabase.from('users').select('id').limit(1);
    
    if (error) {
      console.error('[Supabase 테스트] 오류:', error);
    } else {
      console.log('[Supabase 테스트] 성공! 사용자 조회 결과:', data);
    }
  } catch (err) {
    console.error('[Supabase 테스트] 예외 발생:', err);
  }
})();

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
  // 개발 환경에서는 항상 세부 정보 포함, 프로덕션에서는 선택적 포함
  const includeDetails = process.env.NODE_ENV === 'development' || status >= 500;
  
  // Supabase 에러 객체를 더 사용자 친화적인 형태로 변환
  let formattedDetails = details;
  if (details && details.code && details.message) { // Supabase 오류 형식인 경우
    formattedDetails = {
      provider: 'Supabase',
      code: details.code,
      message: details.message,
      hint: details.hint || '없음',
      details: details.details || '추가 정보 없음'
    };
  }
  
  const errorResponse = {
    error: message,
    code,
    status,
    timestamp: new Date().toISOString(),
    details: includeDetails ? formattedDetails : undefined,
    userMessage: getUserFriendlyErrorMessage(details || { code, message, status }) 
  };
  
  console.error(`[API 오류] ${status} ${code}: ${message}`, includeDetails ? details : '세부 정보 생략됨');
  
  return NextResponse.json(errorResponse, { 
    status, 
    headers: CORS_HEADERS 
  });
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
    
    // 전체 게시물 목록 조회를 위한 파라미터 추출
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('limit') || '10', 10);
    const category = url.searchParams.get('category');
    const searchQuery = url.searchParams.get('search');
    
    // 검색 요청인 경우 로그 출력
    if (searchQuery) {
      console.log(`[게시물 API] 검색 요청: "${searchQuery}"`);
    }
    
    return await getPosts(req, page, pageSize, category);
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
  // 게시물 조회 (adminSupabase 사용)
  const { data: post, error } = await adminSupabase
    .from('posts')
    .select(`
      *,
      users (id, name, email)
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
  const { count: likesCount, error: likesError } = await adminSupabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);
  
  if (likesError) {
    console.warn('[게시물 API] 좋아요 수 조회 오류:', likesError);
  }
  
  // 타입 안전하게 처리
  const postData = post as any;
  
  // 응답 데이터 구성
  const formattedPost = {
    id: postData.id,
    title: postData.title,
    content: postData.content,
    published: postData.published,
    createdAt: postData.created_at,
    updatedAt: postData.updated_at,
    likesCount: likesCount || 0,
    author: postData.users ? {
      id: postData.users.id,
      name: postData.users.name,
      email: postData.users.email
    } : null,
    comments: postData.comments ? postData.comments.map((comment: any) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      userId: comment.user_id
    })) : []
  };
  
  return createApiResponse({ post: formattedPost });
}

// 게시물 목록 조회 핸들러
async function getPosts(req: Request, page: number, pageSize: number, category?: string | null) {
  const offset = (page - 1) * pageSize;
  
  // URL에서 userId 파라미터 추출
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const authorId = url.searchParams.get('author_id'); // author_id 파라미터 추가
  const searchQuery = url.searchParams.get('search');  // 검색어 파라미터 추가
  
  console.log(`[게시물 API] 쿼리 파라미터: page=${page}, limit=${pageSize}, category=${category}, author_id=${authorId}, search=${searchQuery}`);
  
  // 티켓 요청 목록인 경우 제안 수도 함께 조회
  if (category === 'TICKET_REQUEST') {
    console.log('[게시물 API] 티켓 요청 목록 - 제안 수 포함하여 조회');
    
    // 제안 수를 포함한 쿼리
    let query = adminSupabase
      .from('posts')
      .select(`
        *,
        users (id, name, email),
        proposals (id)
      `, { count: 'exact' })
      .is('is_deleted', false)
      .eq('category', 'TICKET_REQUEST');
    
    // 사용자 ID로 필터링 (author_id 또는 userId 모두 지원)
    if (authorId || userId) {
      const filterUserId = authorId || userId;
      console.log(`[게시물 API] 작성자 ID 필터링: ${filterUserId}`);
      query = query.eq('author_id', filterUserId);
    }
    
    // 검색어 필터링 추가
    if (searchQuery && searchQuery.trim()) {
      console.log(`[게시물 API] 검색어 필터링: ${searchQuery}`);
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }
    
    // 최종 쿼리 실행
    const { data: posts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      console.error('[게시물 API] 티켓 요청 목록 조회 오류:', error);
      return createErrorResponse(
        '게시물 목록을 조회하는 중 오류가 발생했습니다.', 
        'DB_ERROR', 
        500, 
        error
      );
    }
    
    // 응답 데이터 구성 (제안 수 포함)
    const formattedPosts = posts.map(post => {
      const postData = post as any;
      
      return {
        id: postData.id,
        title: postData.title,
        content: postData.content.substring(0, 200) + (postData.content.length > 200 ? '...' : ''),
        published: postData.published,
        createdAt: postData.created_at,
        updatedAt: postData.updated_at,
        category: postData.category || null,
        status: postData.status || 'ACTIVE',
        eventName: postData.event_name || postData.title,
        eventDate: postData.event_date || null,
        eventVenue: postData.event_venue || null,
        ticketPrice: postData.ticket_price || 0,
        proposalCount: postData.proposals ? postData.proposals.length : 0, // 제안 수 추가
        author: postData.users ? {
          id: postData.users.id,
          name: postData.users.name,
          email: postData.users.email
        } : null
      };
    });
    
    return createApiResponse({
      success: true,
      posts: formattedPosts,
      pagination: {
        totalCount: count || 0,
        totalPages: count ? Math.ceil(count / pageSize) : 0,
        currentPage: page,
        pageSize,
        hasMore: (offset + posts.length) < (count || 0)
      },
      filters: {
        category,
        search: searchQuery || null
      }
    });
  }
  
  // 일반 게시물 목록 조회 (기존 로직)
  let query = adminSupabase
    .from('posts')
    .select(`
      *,
      users (id, name, email)
    `, { count: 'exact' })
    .is('is_deleted', false);
  
  // 카테고리 필터링 추가
  if (category) {
    console.log(`[게시물 API] 카테고리 필터링: ${category}`);
    query = query.eq('category', category);
  }
  
  // 사용자 ID로 필터링 (마이페이지에서 사용자 본인의 게시글만 표시)
  if (userId) {
    console.log(`[게시물 API] 작성자 ID 필터링: ${userId}`);
    query = query.eq('author_id', userId);
  }
  
  // 검색어 필터링 추가
  if (searchQuery && searchQuery.trim()) {
    console.log(`[게시물 API] 검색어 필터링: ${searchQuery}`);
    // 제목이나 내용에 검색어가 포함된 게시물 검색
    query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
  }
  
  // 최종 쿼리 실행
  const { data: posts, error, count } = await query
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
  const formattedPosts = posts.map(post => {
    // 게시물 데이터를 any 타입으로 변환하여 추가 속성에 접근
    const postData = post as any;
    
    return {
      id: postData.id,
      title: postData.title,
      content: postData.content.substring(0, 200) + (postData.content.length > 200 ? '...' : ''),
      published: postData.published,
      createdAt: postData.created_at,
      updatedAt: postData.updated_at,
      // 추가 필드 안전하게 접근
      category: postData.category || null,
      status: postData.status || 'ACTIVE',
      eventName: postData.event_name || postData.title,
      eventDate: postData.event_date || null,
      eventVenue: postData.event_venue || null,
      author: postData.users ? {
        id: postData.users.id,
        name: postData.users.name,
        email: postData.users.email
      } : null
    };
  });
  
  return createApiResponse({
    success: true,
    posts: formattedPosts,
    pagination: {
      totalCount: count || 0,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
      currentPage: page,
      pageSize,
      hasMore: (offset + posts.length) < (count || 0)
    },
    filters: {
      category,
      search: searchQuery || null
    }
  });
}

// POST 요청 처리 - 새 게시물 생성
export async function POST(req: Request) {
  try {
    console.log('[게시물 API] POST 요청 시작');
    
    // 1. 사용자 인증
    const { userId, authenticated, message } = await validateRequestToken(req);
    console.log('[게시물 API] 인증 결과:', { 
      userId, 
      authenticated, 
      message, 
      userIdType: typeof userId 
    });
    
    if (!authenticated) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }
    
    // 1-1. 미납 수수료 확인 (추가)
    try {
      const { checkUnpaidFees } = await import('@/lib/fee-utils');
      const unpaidFeesData = await checkUnpaidFees(userId.toString());
      
      if (unpaidFeesData.hasUnpaidFees) {
        console.log(`[게시물 API] 사용자 ${userId}에게 미납 수수료가 있어 요청 거부`);
        return createErrorResponse(
          '미납 수수료가 있어 판매 글을 등록할 수 없습니다.',
          'UNPAID_FEES', 
          403,
          {
            unpaidCount: unpaidFeesData.unpaidFees.length,
            totalAmount: unpaidFeesData.totalAmount,
            oldestDueDate: unpaidFeesData.oldestDueDate
          }
        );
      }
    } catch (feeCheckError) {
      console.error('[게시물 API] 수수료 확인 중 오류:', feeCheckError);
      // 수수료 확인 실패 시에도 계속 진행 (장애 방지)
    }
    
    // 2. 요청 본문 파싱
    const body = await req.json();
    console.log('[게시물 API] 요청 본문 요약:', { 
      title: body.title, 
      contentLength: body.content ? body.content.length : 0,
      category: body.category 
    });
    
    // 3. 필수 필드 검증
    if (!body.title) {
      return createErrorResponse('제목은 필수 항목입니다.', 'VALIDATION_ERROR', 400);
    }
    
    // 4. 간소화된 데이터 구성
    
    // 테이블 구조 확인 (시간 절약을 위해 간소화된 접근법 사용)
    // 실제 컬럼 확인하여 author_id 또는 user_id 사용
    console.log('[게시물 API] 테이블 구조 확인 중...');
    let availableColumns: string[] = [];
    
    try {
      const { data: tableInfo, error: tableError } = await adminSupabase
        .from('posts')
        .select('*')
        .limit(1);
      
      if (tableInfo && tableInfo.length > 0) {
        availableColumns = Object.keys(tableInfo[0]);
        console.log('[게시물 API] 테이블 컬럼 목록:', availableColumns);
      }
    } catch (error) {
      console.error('[게시물 API] 테이블 구조 확인 오류:', error);
    }
    
    // 데이터 객체 구성 (모든 필드 포함)
    const postData: any = {
      title: body.title,
      content: body.content || '',
      category: body.category || 'GENERAL',
      status: 'ACTIVE'
    };
    
    // 실제 컬럼 이름에 따라 사용자 ID 필드 추가
    if (availableColumns.includes('author_id')) {
      postData.author_id = userId;
      console.log('[게시물 API] author_id 필드 사용');
    } else if (availableColumns.includes('user_id')) {
      postData.user_id = userId;
      console.log('[게시물 API] user_id 필드 사용 (대체)');
    } else {
      console.warn('[게시물 API] 사용자 ID 필드를 찾을 수 없음');
      // 기본값으로 author_id 사용
      postData.author_id = userId;
    }
    
    console.log('[게시물 API] 저장할 데이터:', postData);
    
    // 5. 데이터베이스 작업 시도
    try {
      console.log('[게시물 API] 데이터베이스 삽입 시도...');
      
      // adminSupabase 클라이언트로 게시물 생성
      const { data: post, error } = await adminSupabase
        .from('posts')
        .insert(postData)
        .select()
        .single();
      
      if (error) {
        console.error('[게시물 API] 삽입 오류:', error);
        console.error('[게시물 API] 오류 세부 정보:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // 데이터베이스 오류 세부 정보와 함께 오류 응답 생성
        return createErrorResponse(
          '게시물을 생성하는 중 데이터베이스 오류가 발생했습니다.',
          'DB_ERROR', 
          500, 
          error
        );
      }
      
      if (!post) {
        console.error('[게시물 API] 게시물 데이터가 없습니다.');
        return createErrorResponse(
          '게시물이 생성되었으나 데이터를 반환받지 못했습니다.',
          'NO_DATA',
          500
        );
      }
      
      // 6. 성공 응답 구성
      console.log('[게시물 API] 게시물 생성 성공:', post.id);
      
      return createApiResponse({
        success: true,
        post: {
          id: post.id,
          title: post.title,
          createdAt: post.created_at
        }
      }, 201);
      
    } catch (dbError: any) {
      // 데이터베이스 작업 예외 처리
      console.error('[게시물 API] 데이터베이스 작업 중 예외 발생:', dbError);
      console.error('[게시물 API] 예외 세부 정보:', {
        name: dbError.name,
        message: dbError.message,
        stack: dbError.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      return createErrorResponse(
        '게시물 생성 중 서버 오류가 발생했습니다.',
        'SERVER_ERROR',
        500,
        dbError
      );
    }
  } catch (error: any) {
    // 전역 예외 처리
    console.error('[게시물 API] 전역 예외 발생:', error);
    console.error('[게시물 API] 예외 세부 정보:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    
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
    
    // 테이블 구조 확인
    console.log('[게시물 API] Supabase 테이블 구조 확인 중...');
    let availableColumns: string[] = [];
    
    try {
      const { data: tableInfo, error: tableError } = await adminSupabase
        .from('posts')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error('[게시물 API] 테이블 정보 조회 오류:', tableError);
      } else if (tableInfo && tableInfo.length > 0) {
        availableColumns = Object.keys(tableInfo[0]);
        console.log('[게시물 API] 테이블 컬럼 목록:', availableColumns);
      } else {
        console.log('[게시물 API] 테이블에 데이터가 없거나 접근 권한이 없습니다.');
      }
    } catch (tableCheckError) {
      console.error('[게시물 API] 테이블 확인 중 오류:', tableCheckError);
    }
    
    // 사용자 인증
    const { userId, authenticated, message } = await validateRequestToken(req);
    console.log('[게시물 API] 인증 결과:', { userId, authenticated, message });
    
    if (!authenticated) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }
    
    // 요청 본문 파싱
    const body = await req.json();
    console.log('[게시물 API] 요청 본문:', JSON.stringify(body, null, 2));
    
    const { id, title, content } = body;
    
    // 필수 필드 검증
    if (!id) {
      return createErrorResponse(
        '게시물 ID는 필수 항목입니다.',
        'VALIDATION_ERROR',
        400
      );
    }
    
    if (!title && !content) {
      return createErrorResponse(
        '수정할 내용이 없습니다. 제목 또는 내용을 입력해주세요.',
        'VALIDATION_ERROR',
        400
      );
    }
    
    // 게시물 소유자 확인 (관리자 권한으로 조회)
    const { data: existingPost, error: fetchError } = await adminSupabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existingPost) {
      logDetailedError('게시물 조회', fetchError || new Error('게시물을 찾을 수 없음'), { postId: id });
      return createErrorResponse(
        '게시물을 찾을 수 없습니다.',
        'NOT_FOUND',
        404,
        fetchError
      );
    }
    
    // 권한 확인 (author_id로 변경)
    const authorIdField = availableColumns.includes('author_id') ? 'author_id' : 
                         availableColumns.includes('user_id') ? 'user_id' : null;
                          
    if (!authorIdField) {
      logDetailedError('사용자 ID 필드 확인', new Error('사용자 ID 컬럼을 찾을 수 없음'), { availableColumns });
      return createErrorResponse(
        '데이터베이스 스키마 오류: 사용자 ID 필드를 찾을 수 없습니다.',
        'SCHEMA_ERROR',
        500
      );
    }
    
    // TypeScript 오류 수정 - any 타입 사용
    const postAuthorId = (existingPost as any)[authorIdField];
    if (postAuthorId !== userId) {
      return createErrorResponse(
        '이 게시물을 수정할 권한이 없습니다.', 
        'FORBIDDEN', 
        403
      );
    }
    
    // 업데이트할 필드 구성 (존재하는 컬럼만 포함)
    const updateData: any = {};
    
    if (title !== undefined && availableColumns.includes('title')) {
      updateData.title = title;
    }
    
    if (content !== undefined && availableColumns.includes('content')) {
      updateData.content = content;
    }
    
    // 커스텀 필드 처리
    if (body.category && availableColumns.includes('category')) {
      updateData.category = body.category;
    }
    
    if (body.status && availableColumns.includes('status')) {
      updateData.status = body.status;
    }
    
    if (body.ticketPrice && availableColumns.includes('ticket_price')) {
      const ticketPrice = typeof body.ticketPrice === 'string' ? 
        parseInt(body.ticketPrice.replace(/[^0-9]/g, ''), 10) : 
        Number(body.ticketPrice);
      
      if (!isNaN(ticketPrice)) {
        updateData.ticket_price = ticketPrice;
      }
    }
    
    // updated_at 필드 추가 (존재하는 경우만)
    if (availableColumns.includes('updated_at')) {
      updateData.updated_at = new Date().toISOString();
    }
    
    // 데이터가 비어있으면 오류 반환
    if (Object.keys(updateData).length === 0) {
      return createErrorResponse(
        '업데이트할 데이터가 없습니다.',
        'VALIDATION_ERROR',
        400
      );
    }
    
    console.log('[게시물 API] 업데이트할 데이터:', JSON.stringify(updateData, null, 2));
    
    // 게시물 업데이트 (관리자 권한으로 실행)
    try {
      console.log('[게시물 API] 관리자 권한으로 데이터 업데이트 시도');
      const { data: updatedPost, error } = await adminSupabase
        .from('posts')
        .update(updateData as any)
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) {
        logDetailedError('게시물 업데이트', error, { id, updateData });
        
        // 문제 컬럼 식별
        if (error.message && error.message.includes('column')) {
          const columnMatch = error.message.match(/column ['"]([^'"]+)['"]/);
          if (columnMatch && columnMatch[1]) {
            const problematicColumn = columnMatch[1];
            console.error(`[게시물 API] 문제 발생 필드: ${problematicColumn}`);
            
            // 문제가 되는 필드 제거 후 다시 시도
            if (updateData[problematicColumn]) {
              delete updateData[problematicColumn];
              console.log(`[게시물 API] 문제 필드 제거 후 데이터:`, updateData);
              
              // 필드를 제거하고 다시 시도 (남은 데이터가 있는 경우)
              if (Object.keys(updateData).length > 0) {
                const retryResult = await adminSupabase
                  .from('posts')
                  .update(updateData as any)
                  .eq('id', id)
                  .select('*')
                  .single();
                
                if (retryResult.error) {
                  console.error('[게시물 API] 재시도 실패:', retryResult.error);
                  throw retryResult.error;
                } else {
                  console.log('[게시물 API] 재시도 성공:', retryResult.data);
                  return formatPostResponse(retryResult.data);
                }
              } else {
                return createErrorResponse(
                  '모든 업데이트 필드가 유효하지 않습니다.',
                  'VALIDATION_ERROR',
                  400
                );
              }
            }
          }
        }
        
        throw error;
      }
      
      console.log('[게시물 API] 업데이트 성공:', updatedPost);
      return formatPostResponse(updatedPost);
    } catch (updateError: any) {
      console.error('[게시물 API] 업데이트 처리 중 오류:', updateError);
      
      // Supabase 오류 처리
      let errorCode = 'DB_ERROR';
      let statusCode = 500;
      let errorMessage = updateError.message || '데이터베이스 오류가 발생했습니다.';
      
      if (updateError.code) {
        switch (updateError.code) {
          case '23505': // 중복 키
            errorCode = 'DUPLICATE_ENTRY';
            errorMessage = '이미 동일한 내용의 게시물이 존재합니다.';
            statusCode = 409;
            break;
          case '23503': // 외래 키
            errorCode = 'INVALID_REFERENCE';
            errorMessage = '참조하는 데이터가 존재하지 않습니다.';
            statusCode = 400;
            break;
          case '42703': // 정의되지 않은 열
            errorCode = 'SCHEMA_ERROR';
            errorMessage = '데이터 구조가 일치하지 않습니다: ' + updateError.message;
            statusCode = 400;
            break;
        }
      }
      
      return createErrorResponse(
        errorMessage,
        errorCode,
        statusCode,
        updateError
      );
    }
  } catch (error: any) {
    logDetailedError('게시물 수정 중 전역 오류', error);
    
    const errorDetails = {
      message: error.message || '알 수 없는 오류',
      name: error.name || 'UnknownError',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    let userMessage = '게시물을 수정하는 중 오류가 발생했습니다.';
    if (isSchemaError(error)) {
      userMessage = '데이터베이스 구조 문제가 발생했습니다. 관리자에게 문의하세요.';
    }
    
    return createErrorResponse(
      userMessage,
      'SERVER_ERROR',
      500,
      errorDetails
    );
  }
}

/**
 * 게시물 응답 포맷팅 헬퍼 함수
 */
function formatPostResponse(post: any) {
  // 응답 데이터 동적 구성
  const formattedPost: Record<string, any> = {
    id: post.id,
    title: post.title,
    content: typeof post.content === 'string' ? 
      (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content) : 
      post.content
  };
  
  // 존재하는 필드만 포함
  if ('created_at' in post) formattedPost.createdAt = post.created_at;
  if ('updated_at' in post) formattedPost.updatedAt = post.updated_at;
  if ('author_id' in post) formattedPost.authorId = post.author_id;
  if ('user_id' in post) formattedPost.userId = post.user_id;
  if ('category' in post) formattedPost.category = post.category;
  if ('status' in post) formattedPost.status = post.status;
  if ('ticket_price' in post) formattedPost.ticketPrice = post.ticket_price;
  if ('event_name' in post) formattedPost.eventName = post.event_name;
  if ('event_date' in post) formattedPost.eventDate = post.event_date;
  if ('event_venue' in post) formattedPost.eventVenue = post.event_venue;
  
  return createApiResponse({ post: formattedPost });
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
    
    // 게시물 소유자 확인 (관리자 권한으로 조회)
    const { data: existingPost, error: fetchError } = await adminSupabase
      .from('posts')
      .select('*')
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
    
    // 권한 확인 - 관리자는 모든 게시물 삭제 가능
    const authorIdField = 'author_id' in existingPost ? 'author_id' : 
                          'user_id' in existingPost ? 'user_id' : null;
                          
    if (authorIdField && (existingPost as any)[authorIdField] !== userId) {
      return createErrorResponse(
        '이 게시물을 삭제할 권한이 없습니다.', 
        'FORBIDDEN', 
        403
      );
    }
    
    // 게시물 삭제 (관련 댓글과 좋아요는 CASCADE로 자동 삭제)
    console.log('[게시물 API] 관리자 권한으로 데이터 삭제 시도');
    const { error } = await adminSupabase
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