import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { convertBigIntToString } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase";
import { Database } from "@/types/supabase.types";

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

// GET 요청 핸들러 - 구매 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    console.log("구매 목록 API 호출됨");
    
    // 현재 인증된 사용자 정보 가져오기
    let authUser = await getAuthenticatedUser(request);
    
    // 개발 환경에서 userId 쿼리 파라미터를 사용한 인증 처리
    if (!authUser && process.env.NODE_ENV === 'development') {
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId');
      
      console.log("개발 환경 - 쿼리 파라미터 userId 확인:", userId);
      
      if (userId) {
        console.log("개발 환경 - 쿼리 파라미터에서 userId 발견:", userId);
        
        // 개발 환경에서는 쿼리 파라미터의 userId로 mock 사용자 생성
        authUser = {
          id: userId,
          name: 'Dev User',
          email: 'dev-user@example.com',
          role: 'user'
        };
      }
    }
    
    // 인증된 사용자가 없으면 401 에러 반환
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 사용자 ID:", authUser.id);
    
    // 쿼리 파라미터 처리
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log("API 요청 파라미터:", { page, limit, userId: authUser.id });
    
    // 페이지네이션 계산
    const skip = (page - 1) * limit;

    // 싱글톤 Supabase 클라이언트 인스턴스 가져오기
    const supabase = getSupabaseClient();
    console.log("Supabase 클라이언트 있음:", !!supabase);
    
    try {
      // Supabase에서 구매 목록 조회
      let { data: purchases, error, count } = await supabase
        .from('purchases')
        .select(`
          *,
          post:posts(*),
          seller:users!seller_id(id, name, email)
        `, { count: 'exact' })
        .eq('buyer_id', authUser.id);
      
      if (error) {
        console.error("구매 목록 조회 오류:", error);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "데이터베이스 조회 중 오류가 발생했습니다." 
          }, { status: 500 })
        );
      }
      
      // 페이지네이션 적용
      if (purchases) {
        // 수동으로 페이지네이션 처리
        purchases = purchases.slice(skip, skip + limit);
      }
      
      // 총 구매 수 조회
      const totalCount = count || 0;
      console.log("조회된 총 구매 수:", totalCount);
      
      // 조회 결과가 없어도 빈 배열 반환
      const safePurchasesList = purchases || [];
      console.log(`${safePurchasesList.length}개의 구매를 찾았습니다.`);
      
      // 성공 응답 반환
      return addCorsHeaders(NextResponse.json({
        success: true,
        purchases: safePurchasesList,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          hasMore: skip + safePurchasesList.length < totalCount
        }
      }, { status: 200 }));
    } catch (dbError) {
      console.error("데이터베이스 조회 오류:", dbError);
      console.error("오류 타입:", typeof dbError);
      
      if (dbError instanceof Error) {
        console.error("오류 이름:", dbError.name);
        console.error("오류 메시지:", dbError.message);
      }
      
      return addCorsHeaders(
        NextResponse.json({ 
          success: false, 
          message: "데이터베이스 조회 중 오류가 발생했습니다.",
          error: process.env.NODE_ENV === 'development' ? String(dbError) : undefined
        }, { status: 500 })
      );
    }
  } catch (error) {
    console.error("구매 목록 조회 오류:", error instanceof Error ? error.message : String(error));
    console.error("상세 오류 스택:", error);
    console.error("오류 타입:", typeof error);
    
    if (error instanceof Error) {
      console.error("오류 이름:", error.name);
      console.error("오류 메시지:", error.message);
      console.error("오류 스택:", error.stack);
    }
    
    return addCorsHeaders(
      NextResponse.json({ 
        success: false, 
        message: "구매 목록 조회 중 오류가 발생했습니다.",
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }, { status: 500 })
    );
  } finally {
    console.log("Purchase API 요청 처리 완료");
  }
} 