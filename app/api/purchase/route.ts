import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { convertBigIntToString } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/supabase.types";
import { createClient } from "@supabase/supabase-js";

// 하드코딩된 값으로 설정
const SUPABASE_URL = 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

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
    const authUser = await getAuthenticatedUser(request);
    
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

    // 디버깅: 환경 출력
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("Supabase 클라이언트 있음:", !!supabase);
    
    // 타입 문제를 해결하기 위해 any 타입으로 캐스팅된 supabase 클라이언트 생성
    const supabaseAny = supabase as any;
    
    try {
      // Supabase에서 구매 목록 조회
      let { data: purchases, error, count } = await supabaseAny
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