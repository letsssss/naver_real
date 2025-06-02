import { NextResponse, NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

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

// GET 요청 핸들러 - 어드민 권한으로 모든 구매 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    console.log("어드민 구매 목록 API 호출됨");
    
    // 개발 환경에서만 허용
    if (process.env.NODE_ENV !== 'development') {
      console.log("이 API는 개발 환경에서만 사용 가능합니다.");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "이 API는 개발 환경에서만 사용 가능합니다." },
        { status: 403 }
      ));
    }

    // 쿼리 파라미터 처리
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log("API 요청 파라미터:", { page, limit, userId });
    
    // 페이지네이션 계산
    const skip = (page - 1) * limit;

    // Supabase 클라이언트 인스턴스 가져오기
    const supabase = createAdminClient();
    console.log("Supabase 클라이언트 있음:", !!supabase);
    
    try {
      console.log("구매 목록 테이블 조회 시작");
      
      // 단순하게 구매 테이블만 조회
      const { data: allPurchases, error: allError, count: totalCount } = await supabase
        .from('purchases')
        .select('*', { count: 'exact' });
      
      if (allError) {
        console.error("구매 목록 조회 오류:", allError);
        return addCorsHeaders(NextResponse.json(
          { success: false, message: "구매 목록 조회 중 오류가 발생했습니다.", error: allError.message },
          { status: 500 }
        ));
      }
      
      console.log("전체 구매 데이터:", allPurchases);
      console.log("총 구매 수:", totalCount);
      
      // 특정 사용자 구매만 필터링 (요청에 userId가 포함된 경우)
      let filteredPurchases = allPurchases || [];
      if (userId) {
        console.log(`사용자 ID(${userId})로 필터링 중...`);
        filteredPurchases = filteredPurchases.filter(p => 
          String(p.buyer_id) === userId || 
          String(p.buyer_id).toLowerCase() === String(userId).toLowerCase()
        );
        console.log(`${filteredPurchases.length}개의 사용자 구매 내역 찾음`);
      }
      
      // 페이지네이션 적용
      const paginatedPurchases = filteredPurchases.slice(skip, skip + limit);
      console.log(`페이지네이션 적용 후 ${paginatedPurchases.length}개의 구매 내역 반환`);
      
      // 성공 응답 반환
      return addCorsHeaders(NextResponse.json({
        success: true,
        purchases: paginatedPurchases,
        pagination: {
          totalCount: filteredPurchases.length,
          totalPages: Math.ceil(filteredPurchases.length / limit),
          currentPage: page,
          hasMore: skip + paginatedPurchases.length < filteredPurchases.length
        }
      }, { status: 200 }));
    } catch (dbError) {
      console.error("데이터베이스 조회 오류:", dbError);
      
      return addCorsHeaders(
        NextResponse.json({ 
          success: false, 
          message: "데이터베이스 조회 중 오류가 발생했습니다.",
          error: String(dbError)
        }, { status: 500 })
      );
    }
  } catch (error) {
    console.error("구매 목록 조회 오류:", error instanceof Error ? error.message : String(error));
    
    return addCorsHeaders(
      NextResponse.json({ 
        success: false, 
        message: "구매 목록 조회 중 오류가 발생했습니다.",
        error: String(error)
      }, { status: 500 })
    );
  }
} 