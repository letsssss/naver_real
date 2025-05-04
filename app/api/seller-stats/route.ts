import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

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
    
    // Supabase 클라이언트 생성
    const supabase = createAdminClient();
    
    // 1. 판매자 프로필 정보 조회
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(`
        id,
        name,
        email,
        profile_image,
        rating,
        response_rate
      `)
      .eq("id", sellerId)
      .single();
    
    if (profileError) {
      console.error("판매자 프로필 조회 오류:", profileError);
      return NextResponse.json(
        { error: "판매자 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    
    // 2. 판매자 판매 통계 조회
    const { data: salesData, error: salesError } = await supabase
      .from("posts")
      .select("id, status")
      .eq("author_id", sellerId);
    
    if (salesError) {
      console.error("판매 통계 조회 오류:", salesError);
    }
    
    // 3. 판매자의 구매(취켓팅) 통계 조회
    const { data: purchasesData, error: purchasesError } = await supabase
      .from("purchases")
      .select("id, status, post_id")
      .eq("seller_id", sellerId);
    
    if (purchasesError) {
      console.error("구매 통계 조회 오류:", purchasesError);
    }
    
    // 4. 판매 완료 수 계산
    const completedSales = (salesData || []).filter(sale => 
      sale.status === 'completed' || sale.status === 'COMPLETED'
    ).length;
    
    // 5. 취켓팅 완료 수 계산
    const completedTicketing = (purchasesData || []).filter(purchase => 
      purchase.status === 'completed' || purchase.status === 'COMPLETED'
    ).length;
    
    // 6. 전체 거래 완료 수 계산
    const totalCompletedTransactions = completedSales + completedTicketing;
    
    // 7. 응답률 가져오기 (프로필에서)
    const responseRate = profileData.response_rate || 98; // 기본값 98%
    
    // 8. 결과 반환
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