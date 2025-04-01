import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Database } from "@/types/supabase.types";
import { createClient } from "@supabase/supabase-js";

// 하드코딩된 값으로 설정
const SUPABASE_URL = 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';

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

// GET 요청 핸들러 - 판매자의 상품에 대한 구매 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    console.log("판매자 구매 목록 API 호출됨");
    
    // 현재 인증된 사용자 정보 가져오기
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 판매자 ID:", authUser.id);

    // 디버깅: 환경 출력
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("Supabase 클라이언트 있음:", !!supabase);
    
    // 타입 문제를 해결하기 위해 any 타입으로 캐스팅된 supabase 클라이언트 생성
    const supabaseAny = supabase as any;
    
    try {
      // Supabase에서 판매자 ID로 판매 중인 게시글 ID 목록 조회
      const { data: posts, error: postsError } = await supabaseAny
        .from('posts')
        .select('id')
        .eq('author_id', authUser.id)
        .eq('is_deleted', false);
      
      if (postsError) {
        console.error("게시글 조회 오류:", postsError);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "데이터베이스 조회 중 오류가 발생했습니다." 
          }, { status: 500 })
        );
      }
      
      const postIds = posts?.map((post: any) => post.id) || [];
      
      if (postIds.length === 0) {
        console.log("판매자의 게시글이 없습니다.");
        return addCorsHeaders(NextResponse.json({
          success: true,
          purchases: []
        }, { status: 200 }));
      }
      
      // 판매자의 게시글에 대한 모든 구매 목록 조회
      const { data: purchases, error: purchasesError } = await supabaseAny
        .from('purchases')
        .select(`
          *,
          post:posts(*),
          buyer:users(*)
        `)
        .in('post_id', postIds)
        .in('status', ['PENDING', 'COMPLETED', 'PROCESSING', 'CONFIRMED'])
        .order('updated_at', { ascending: false });
      
      if (purchasesError) {
        console.error("구매 목록 조회 오류:", purchasesError);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "데이터베이스 조회 중 오류가 발생했습니다." 
          }, { status: 500 })
        );
      }
      
      console.log(`판매자 ${authUser.id}의 판매 상품에 대한 구매 ${purchases?.length || 0}개 조회됨`);
      
      // 조회 결과가 없어도 빈 배열 반환
      const safePurchasesList = purchases || [];
      
      // 성공 응답 반환
      return addCorsHeaders(NextResponse.json({
        success: true,
        purchases: safePurchasesList
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
    console.error("판매자 구매 목록 조회 오류:", error instanceof Error ? error.message : String(error));
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
        message: "판매자 구매 목록 조회 중 오류가 발생했습니다.",
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }, { status: 500 })
    );
  }
} 