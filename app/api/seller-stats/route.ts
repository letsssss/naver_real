import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// 사용자 인증 확인 함수 
const verifyAuth = async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return { isAuthenticated: false, userId: null };
  }
  
  try {
    const supabase = createAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error("인증 오류:", error);
      return { isAuthenticated: false, userId: null };
    }
    
    return { isAuthenticated: true, userId: user.id };
  } catch (error) {
    console.error("토큰 검증 오류:", error);
    return { isAuthenticated: false, userId: null };
  }
};

export async function GET(req: NextRequest) {
  try {
    // 쿼리 파라미터에서 판매자 ID 가져오기
    const url = new URL(req.url);
    const sellerId = url.searchParams.get('sellerId');
    
    if (!sellerId) {
      return NextResponse.json(
        { error: "판매자 ID가 필요합니다" },
        { status: 400 }
      );
    }
    
    // Supabase 클라이언트 생성 (한 번만)
    const supabase = createAdminClient();
    
    // 🚀 성능 최적화: 모든 쿼리를 병렬 처리
    const [profileResult, salesResult, purchasesResult] = await Promise.allSettled([
      // 1. 판매자 프로필 정보 조회
      supabase
        .from("profiles")
        .select("id, name, email, profile_image, rating, response_rate")
        .eq("id", sellerId)
        .single(),
      
      // 2. 판매자 판매 통계 조회 (완료된 것만)
      supabase
        .from("posts")
        .select("id", { count: 'exact' })
        .eq("author_id", sellerId)
        .in("status", ['completed', 'COMPLETED']),
      
      // 3. 판매자의 구매(취켓팅) 통계 조회 (완료된 것만)
      supabase
        .from("purchases")
        .select("id", { count: 'exact' })
        .eq("seller_id", sellerId)
        .in("status", ['completed', 'COMPLETED'])
    ]);
    
    // 결과 처리 - 실패한 요청도 안전하게 처리
    let profileData = null;
    let completedSales = 0;
    let completedTicketing = 0;
    
    // 프로필 데이터 처리
    if (profileResult.status === 'fulfilled' && profileResult.value.data) {
      profileData = profileResult.value.data;
    } else {
      console.error("판매자 프로필 조회 실패:", profileResult.status === 'rejected' ? profileResult.reason : 'No data');
      return NextResponse.json(
        { error: "판매자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    
    // 판매 통계 처리
    if (salesResult.status === 'fulfilled') {
      completedSales = salesResult.value.count || 0;
    } else {
      console.error("판매 통계 조회 실패:", salesResult.reason);
    }
    
    // 구매 통계 처리
    if (purchasesResult.status === 'fulfilled') {
      completedTicketing = purchasesResult.value.count || 0;
    } else {
      console.error("구매 통계 조회 실패:", purchasesResult.reason);
    }
    
    // 전체 거래 완료 수 계산
    const totalCompletedTransactions = completedSales + completedTicketing;
    
    // 응답률 가져오기 (프로필에서)
    const responseRate = profileData.response_rate || 98; // 기본값 98%
    
    // 결과 반환
    return NextResponse.json({
      seller: {
        id: sellerId,
        name: profileData.name,
        profileImage: profileData.profile_image,
        rating: profileData.rating || 4.5,
        responseRate: responseRate,
        successfulSales: totalCompletedTransactions
      }
    });
    
  } catch (error) {
    console.error("판매자 통계 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
} 