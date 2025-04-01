import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, verifyToken, getTokenFromHeaders, getTokenFromCookies } from "@/lib/auth";
import { supabase, createServerSupabaseClient } from "@/lib/supabase";
import { z } from "zod";

// 개발 환경인지 확인하는 변수 추가
const isDevelopment = process.env.NODE_ENV === 'development';

// 기본 테스트 사용자 ID (개발 환경에서 사용)
const DEFAULT_TEST_USER_ID = 3;

// 입력 데이터 유효성 검사를 위한 zod 스키마
const postSchema = z.object({
  title: z.string().min(2, "제목은 2글자 이상이어야 합니다."),
  content: z.string().min(10, "내용은 10글자 이상이어야 합니다."),
  category: z.string().optional(),
  eventName: z.string().optional(),
  eventDate: z.string().optional(),
  eventVenue: z.string().optional(),
  ticketPrice: z.number()
    .int("가격은 정수여야 합니다.")
    .nonnegative("가격은 0 이상이어야 합니다.")
    .safe("가격이 너무 큽니다. 더 작은 값을 입력해주세요.")
    .optional(),
  contactInfo: z.string().optional(),
  type: z.string().optional(),
});

// BigInt를 문자열로 변환하는 함수
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertBigIntToString(obj[key]);
    }
    return newObj;
  }
  
  return obj;
}

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

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

// 글 작성 API
export async function POST(request: NextRequest) {
  try {
    console.log("글 작성 API 호출됨");
    
    // JWT 토큰 확인
    const token = getTokenFromHeaders(request.headers) || getTokenFromCookies(request);
    console.log('토큰 정보:', token ? '토큰 있음' : '토큰 없음');
    
    // 사용자 ID 결정
    let userId: number;
    
    // 개발 환경에서는 항상 기본 테스트 사용자 ID 사용
    if (isDevelopment) {
      userId = DEFAULT_TEST_USER_ID;
      console.log(`개발 환경에서 기본 사용자 ID(${DEFAULT_TEST_USER_ID}) 사용`);
      
      // 옵션: 개발 환경에서도 Supabase 토큰 확인 (필요한 경우)
      if (token) {
        try {
          const supabaseServerClient = createServerSupabaseClient(token);
          console.log('개발 환경: Supabase 클라이언트 생성 성공');
        } catch (err) {
          console.log('개발 환경: Supabase 클라이언트 생성 실패, 기본 구현으로 진행');
        }
      }
    } else {
      // 프로덕션 환경에서는 인증 필요
      // 현재 인증된 사용자 정보 가져오기
      const authUser = await getAuthenticatedUser(request);
      
      if (!authUser) {
        console.log("인증된 사용자를 찾을 수 없음");
        return addCorsHeaders(NextResponse.json(
          { success: false, message: "인증되지 않은 사용자입니다." },
          { status: 401 }
        ));
      }
      
      userId = Number(authUser.id);
      console.log("인증된 사용자 ID:", userId);
    }

    // 요청 본문 파싱
    const body = await request.json();
    
    // 입력 데이터 유효성 검사
    const validationResult = postSchema.safeParse(body);
    
    if (!validationResult.success) {
      return addCorsHeaders(NextResponse.json(
        { 
          success: false, 
          message: "유효하지 않은 입력 데이터입니다.", 
          errors: validationResult.error.errors 
        },
        { status: 400 }
      ));
    }

    // 글 저장 - Supabase 사용
    try {
      // 개발 환경에서 ID 필드 문제 해결을 위해 임의의 ID 생성
      const randomId = isDevelopment ? Math.floor(Math.random() * 9000000000000) + 1000000000000 : undefined;
      
      // Supabase 데이터 형식
      const postData = {
        id: randomId,
        title: body.title,
        content: body.content,
        category: body.category || "GENERAL",
        author_id: userId,
        event_name: body.eventName || null,
        event_date: body.eventDate || null,
        event_venue: body.eventVenue || null,
        ticket_price: body.ticketPrice && body.ticketPrice > 0 ? Math.min(body.ticketPrice, Number.MAX_SAFE_INTEGER) : null,
        contact_info: body.contactInfo || null,
        status: "ACTIVE",
        is_deleted: false
      };
      
      const { data: post, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();
      
      if (error) {
        console.error("Supabase 글 생성 오류:", error);
        throw error;
      }

      console.log("글 작성 성공:", post.id);

      return addCorsHeaders(NextResponse.json(
        { 
          success: true, 
          message: "글이 성공적으로 작성되었습니다.", 
          post: post
        },
        { status: 201 }
      ));
    } catch (createError) {
      console.error("글 생성 실패 (상세 오류):", createError);
      return addCorsHeaders(NextResponse.json(
        { 
          success: false, 
          message: "글 저장 중 오류가 발생했습니다.", 
          error: isDevelopment ? String(createError) : undefined 
        },
        { status: 500 }
      ));
    }
  } catch (error) {
    console.error("글 작성 오류:", error);
    return addCorsHeaders(NextResponse.json(
      { success: false, message: "글 작성 중 오류가 발생했습니다." },
      { status: 500 }
    ));
  } finally {
    console.log("Posts API 요청 처리 완료");
  }
}

// GET 요청 핸들러 - 글 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    console.log("글 목록 API 호출됨");
    
    // JWT 토큰 확인 (알림 API와 유사하게 구현)
    const token = getTokenFromHeaders(request.headers) || getTokenFromCookies(request);
    console.log('토큰 정보:', token ? '토큰 있음' : '토큰 없음');
    
    // 개발 환경에서는 모의 Supabase 검증 시도
    if (isDevelopment && token) {
      console.log("개발 환경에서 Supabase 검증 시도 중...");
      
      try {
        const supabaseServerClient = createServerSupabaseClient(token);
        console.log('개발 환경: Supabase 클라이언트 생성 성공');
      } catch (err) {
        console.log('개발 환경: Supabase 클라이언트 생성 실패, 기본 구현으로 진행');
      }
    }
    
    // 페이지네이션 파라미터 (search 파라미터로 전달됨)
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const category = searchParams.get('category') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const searchQuery = searchParams.get('searchQuery') || '';
    
    console.log("API 요청 파라미터:", { page, limit, category, userId, searchQuery });
    
    // 페이지네이션 계산
    const skip = (page - 1) * limit;
    
    try {
      // 개발 환경에서 DB 연결 테스트
      if (isDevelopment) {
        try {
          const { data: testConnection, error: connectionError } = await supabase
            .from('posts')
            .select('count(*)', { count: 'exact', head: true });
            
          if (connectionError) throw connectionError;
          console.log("데이터베이스 연결 테스트 성공");
        } catch (dbConnectionError) {
          console.error("데이터베이스 연결 오류:", dbConnectionError);
          return addCorsHeaders(
            NextResponse.json({ 
              success: false, 
              message: "데이터베이스 연결에 실패했습니다." 
            }, { status: 500 })
          );
        }
      }
      
      // Supabase 필터 조건 구성
      let query = supabase
        .from('posts')
        .select('*, author:users!author_id(id, name, email)', { count: 'exact' });
      
      // 기본 필터: 삭제되지 않은 글만
      query = query.eq('is_deleted', false);
      
      // 카테고리 필터
      if (category) {
        query = query.eq('category', category);
        console.log(`카테고리 필터 적용: ${category}`);
      }
      
      // 사용자 ID 필터
      if (userId) {
        if (isDevelopment) {
          console.log(`개발 환경: 기본 사용자 ID(${DEFAULT_TEST_USER_ID})로 필터링`);
          query = query.eq('author_id', DEFAULT_TEST_USER_ID);
        } else {
          query = query.eq('author_id', userId);
          console.log(`사용자 ID로 필터링: ${userId}`);
        }
      }
      
      // 검색어 필터 - 모의 클라이언트에서는 or 메서드가 제한될 수 있음
      if (searchQuery) {
        // 모의 환경에서는 단순화된 검색을 사용
        query = query.eq('title', searchQuery); // 간소화된 검색 (실제로는 ilike 사용)
        console.log(`검색어로 필터링: ${searchQuery}`);
      }
      
      // 데이터 조회 실행
      let { data: posts, error, count } = await query;
      
      // 정렬 및 페이지네이션 - 모의 환경에서는 자바스크립트로 처리
      if (posts) {
        // 정렬
        posts = posts.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA; // 내림차순 정렬
        });
        
        // 페이지네이션
        posts = posts.slice(skip, skip + limit);
      }
      
      if (error) {
        console.error("Supabase 조회 오류:", error);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "데이터 조회 중 오류가 발생했습니다." 
          }, { status: 500 })
        );
      }
      
      // 조회 결과가 없어도 빈 배열 반환
      const safePostsList = posts || [];
      console.log(`${safePostsList.length}개의 게시글을 찾았습니다.`);
      const totalCount = count || 0;
      
      // 성공 응답 반환
      return addCorsHeaders(NextResponse.json({
        success: true,
        posts: safePostsList,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          hasMore: skip + safePostsList.length < totalCount
        }
      }, { status: 200 }));
    } catch (dbError) {
      console.error("데이터베이스 조회 오류:", dbError instanceof Error ? dbError.message : String(dbError));
      console.error("상세 오류:", dbError);
      
      return addCorsHeaders(
        NextResponse.json({ 
          success: false, 
          message: "데이터베이스 조회 중 오류가 발생했습니다.",
          error: process.env.NODE_ENV === 'development' ? String(dbError) : undefined
        }, { status: 500 })
      );
    }
  } catch (error) {
    console.error("글 목록 조회 오류:", error instanceof Error ? error.message : String(error));
    console.error("상세 오류 스택:", error);
    
    // 오류 응답
    const errorResponse = { 
      success: false, 
      message: error instanceof Error ? error.message : "글 목록을 가져오는 중 오류가 발생했습니다.",
      // 개발 환경에서만 자세한 오류 정보 포함
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    };
    
    return addCorsHeaders(
      NextResponse.json(errorResponse, { status: 500 })
    );
  } finally {
    console.log("Posts API 요청 처리 완료");
  }
} 