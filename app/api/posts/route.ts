import { NextResponse } from 'next/server';
import { 
  supabase, 
  createServerSupabaseClient, 
  formatUserId
} from '@/lib/supabase';
import { validateRequestToken } from '@/lib/auth';
import { logDetailedError, getUserFriendlyErrorMessage, isSchemaError } from '@/lib/error-utils';
import type { Post } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';

// 하드코딩된 Supabase 설정 사용
const supabaseUrl = 'https://jdubrjczdyqqtsppojgu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU';

// Supabase 어드민 클라이언트 생성 (서비스 롤 키 사용)
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
    
    // 전체 게시물 목록 조회
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('limit') || '10', 10);
    const category = url.searchParams.get('category');
    
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
  
  // 쿼리 빌더 준비 (adminSupabase 사용)
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
    const { userId, authenticated } = await validateRequestToken(req);
    console.log('[게시물 API] 인증 결과:', { userId, authenticated });
    
    if (!authenticated) {
      return createErrorResponse('로그인이 필요합니다.', 'AUTH_ERROR', 401);
    }
    
    // 인증된 사용자가 실제로 데이터베이스에 존재하는지 확인
    try {
      console.log(`[게시물 API] 사용자 확인 중: ${userId}`);
      const { data: userData, error: userError } = await adminSupabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();
        
      if (userError || !userData) {
        console.error('[게시물 API] 사용자 조회 오류:', userError);
        console.log('[게시물 API] 인증된 사용자가 데이터베이스에 존재하지 않습니다. 새 사용자 생성 시도...');
        
        // 사용자 생성 시도
        const { error: createUserError } = await adminSupabase
          .from('users')
          .insert([
            { 
              id: userId,
              name: 'User', // 기본값
              email: 'user@example.com' // 기본값, 실제 앱에서는 세션에서 가져오는 것이 좋음
            }
          ]);
          
        if (createUserError) {
          console.error('[게시물 API] 사용자 생성 실패:', createUserError);
          return createErrorResponse(
            '사용자 정보를 찾을 수 없어 게시물을 등록할 수 없습니다.',
            'USER_NOT_FOUND',
            400
          );
        }
      }
    } catch (userCheckError) {
      console.error('[게시물 API] 사용자 확인 중 오류:', userCheckError);
    }
    
    // 요청 본문 파싱
    const body = await req.json();
    console.log('[게시물 API] 요청 본문:', JSON.stringify(body, null, 2));
    
    // 기본 데이터 준비
    const title = body.title || body.concertTitle || '제목 없음';
    let content = body.content || '';
    
    // 판매 페이지에서 온 요청인 경우 추가 데이터 포맷팅
    if (body.concertDates || body.sections || body.concertVenue) {
      try {
        content = JSON.stringify({
          description: body.ticketDescription || '',
          dates: body.concertDates || [],
          venue: body.concertVenue || '',
          time: body.concertTime || '',
          sections: body.sections || [],
          additionalInfo: body.additionalInfo || ''
        });
        console.log('[게시물 API] 포맷팅된 콘텐츠:', content.substring(0, 100) + '...');
      } catch (jsonError) {
        console.error('[게시물 API] JSON 직렬화 오류:', jsonError);
        content = `티켓 판매: ${title}`;
      }
    }
    
    // 필수 필드 검증
    if (!title) {
      return createErrorResponse(
        '제목은 필수 항목입니다.', 
        'VALIDATION_ERROR', 
        400
      );
    }
    
    // 가격 처리
    let ticketPrice = 0;
    try {
      // body에서 직접 ticketPrice 필드를 먼저 확인
      if (body.ticketPrice) {
        console.log('[게시물 API] 직접 전달된 ticketPrice 사용:', body.ticketPrice);
        const priceStr = String(body.ticketPrice).replace(/[^0-9]/g, '');
        ticketPrice = parseInt(priceStr, 10);
      } 
      // sections 배열에서 가격 정보 찾기
      else if (body.sections && body.sections.length > 0 && body.sections[0].price) {
        console.log('[게시물 API] sections[0].price에서 가격 추출:', body.sections[0].price);
        const priceStr = String(body.sections[0].price).replace(/[^0-9]/g, '');
        ticketPrice = parseInt(priceStr, 10);
      }
      
      // NaN인 경우 0으로 처리
      if (isNaN(ticketPrice)) {
        console.log('[게시물 API] 유효하지 않은 가격, 기본값 0 사용');
        ticketPrice = 0;
      } else {
        console.log('[게시물 API] 최종 처리된 가격:', ticketPrice);
      }
    } catch (priceError) {
      console.error('[게시물 API] 가격 처리 오류:', priceError);
    }
    
    // 가용 컬럼에 맞게 데이터 구성
    // 단계적 접근: 없는 필드는 제외하고 있는 필드만 포함
    const safePostData: any = {
      title,
      content
    };
    
    // 사용자 ID 필드 - 우선순위 결정
    if (availableColumns.includes('user_id')) {
      console.log('[게시물 API] user_id 필드 사용');
      safePostData.user_id = userId;
    } else if (availableColumns.includes('author_id')) {
      console.log('[게시물 API] author_id 필드 사용');
      safePostData.author_id = userId;
    } else if (availableColumns.includes('userid')) {
      console.log('[게시물 API] userid 필드 사용');
      safePostData.userid = userId;
    } else {
      console.log('[게시물 API] 사용자 ID 필드를 찾을 수 없습니다. 시스템 값 사용');
      safePostData.created_by = 'system';
    }
    
    if (availableColumns.includes('category')) safePostData.category = body.category || 'TICKET';
    if (availableColumns.includes('status')) safePostData.status = body.status || 'ACTIVE';
    if (availableColumns.includes('event_name')) safePostData.event_name = body.concertTitle || title;
    if (availableColumns.includes('event_venue')) safePostData.event_venue = body.concertVenue || null;
    
    // 날짜 처리
    if (availableColumns.includes('event_date') && body.concertDates && body.concertDates.length > 0) {
      safePostData.event_date = body.concertDates[0].date;
    }
    
    // 가격 처리 - 항상 정수형으로 변환해서 저장
    if (availableColumns.includes('ticket_price') && ticketPrice > 0) {
      console.log('[게시물 API] ticket_price 필드에 가격 저장:', ticketPrice);
      safePostData.ticket_price = ticketPrice;
      
      // ticketPrice 필드도 추가 (일부 API에서 사용할 수 있음)
      if (availableColumns.includes('ticketPrice')) {
        safePostData.ticketPrice = ticketPrice;
      }
    }
    
    // 소프트 삭제 플래그
    if (availableColumns.includes('is_deleted')) safePostData.is_deleted = false;
    
    console.log('[게시물 API] Supabase에 저장할 데이터:', JSON.stringify(safePostData, null, 2));
    
    // 게시물 생성 (safePostData 사용)
    try {
      console.log('[게시물 API] Supabase 삽입 시도...');
      
      console.log('[게시물 API] 관리자 권한으로 데이터 삽입 시도');
      let { data: post, error } = await adminSupabase
        .from('posts')
        .insert(safePostData as any)
        .select('*')
        .single();
      
      if (error) {
        console.error('[게시물 API] 관리자 권한 삽입 오류:', error);
        console.error('[게시물 API] 오류 세부 정보:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // 문제 컬럼 식별
        if (error.message && error.message.includes('column')) {
          const columnMatch = error.message.match(/column ['"]([^'"]+)['"]/);
          if (columnMatch && columnMatch[1]) {
            const problematicColumn = columnMatch[1];
            console.error(`[게시물 API] 문제 발생 필드: ${problematicColumn}`);
            
            // 문제가 되는 필드 제거 후 다시 시도
            if (safePostData[problematicColumn]) {
              delete safePostData[problematicColumn];
              console.log(`[게시물 API] 문제 필드 제거 후 데이터:`, safePostData);
              
              // 필드를 제거하고 다시 시도 (관리자 권한으로)
              const retryResult = await adminSupabase
                .from('posts')
                .insert(safePostData as any)
                .select('*')
                .single();
              
              if (retryResult.error) {
                console.error('[게시물 API] 재시도 실패:', retryResult.error);
                throw retryResult.error;
              } else {
                console.log('[게시물 API] 재시도 성공:', retryResult.data);
                post = retryResult.data;
              }
            }
          }
        } else {
          throw error;
        }
      }
      
      if (post) {
        console.log('[게시물 API] 삽입 성공:', post);
        
        // 응답 데이터 (동적으로 구성)
        const formattedPost: Record<string, any> = {
          id: post.id,
          title: post.title,
          content: typeof post.content === 'string' ? 
            (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content) : 
            post.content
        };
        
        // 존재하는 필드만 포함
        if ('created_at' in post) formattedPost.createdAt = post.created_at;
        if ('user_id' in post) formattedPost.userId = post.user_id;
        if ('author_id' in post) formattedPost.authorId = post.author_id;
        
        return createApiResponse({ post: formattedPost }, 201);
      } else {
        throw new Error('게시물 생성에 실패했지만 구체적인 오류가 없습니다.');
      }
    } catch (insertError: any) {
      console.error('[게시물 API] 삽입 처리 중 오류:', insertError);
      
      // Supabase 오류 처리
      let errorCode = 'DB_ERROR';
      let statusCode = 500;
      let errorMessage = insertError.message || '데이터베이스 오류가 발생했습니다.';
      
      if (insertError.code) {
        switch (insertError.code) {
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
            errorMessage = '데이터 구조가 일치하지 않습니다: ' + insertError.message;
            statusCode = 400;
            break;
        }
      }
      
      return createErrorResponse(
        errorMessage,
        errorCode,
        statusCode,
        insertError
      );
    }
  } catch (error: any) {
    console.error('[게시물 API] 전역 오류:', error);
    
    const errorDetails = {
      message: error.message || '알 수 없는 오류',
      name: error.name || 'UnknownError',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    let userMessage = '게시물을 생성하는 중 오류가 발생했습니다.';
    if (error.message && error.message.includes('column')) {
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