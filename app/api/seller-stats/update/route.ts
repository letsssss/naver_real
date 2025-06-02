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

export async function POST(req: NextRequest) {
  try {
    // 1. 사용자 인증 확인
    const { isAuthenticated, userId } = await verifyAuth(req);
    
    if (!isAuthenticated || !userId) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }
    
    // 2. 요청 본문 파싱
    const body = await req.json();
    const { sellerId, successfulSales, responseRate } = body;
    
    // 3. 필수 파라미터 검증
    if (!sellerId) {
      return NextResponse.json(
        { error: "판매자 ID가 필요합니다" },
        { status: 400 }
      );
    }
    
    // 4. 요청 파라미터 검증
    if (userId !== sellerId) {
      return NextResponse.json(
        { error: "자신의 통계 정보만 업데이트할 수 있습니다" },
        { status: 403 }
      );
    }
    
    // 5. Supabase 클라이언트 생성
    const supabase = createAdminClient();
    
    // 6. 판매자 통계 정보 업데이트
    const updates: any = {};
    
    // 응답률이 제공된 경우에만 업데이트
    if (responseRate !== undefined) {
      updates.response_rate = responseRate;
    }
    
    // 판매자 프로필 정보 업데이트
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", sellerId)
      .select()
      .single();
    
    if (updateError) {
      console.error("프로필 업데이트 오류:", updateError);
      return NextResponse.json(
        { error: "통계 정보 업데이트에 실패했습니다" },
        { status: 500 }
      );
    }
    
    // 7. 거래 완료 수 기록
    // 판매자 통계 정보 테이블이 있는 경우, 해당 테이블에 거래 완료 수 업데이트
    if (successfulSales !== undefined) {
      try {
        // seller_stats 테이블 존재 여부 확인
        const { data: tableExists } = await supabase
          .from("seller_stats")
          .select("seller_id")
          .eq("seller_id", sellerId)
          .limit(1);
        
        if (tableExists && tableExists.length > 0) {
          // 기존 레코드 업데이트
          await supabase
            .from("seller_stats")
            .update({
              successful_sales: successfulSales,
              updated_at: new Date().toISOString()
            })
            .eq("seller_id", sellerId);
        } else {
          // 새 레코드 생성
          await supabase
            .from("seller_stats")
            .insert({
              seller_id: sellerId,
              successful_sales: successfulSales,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
      } catch (error) {
        console.error("판매자 통계 테이블 업데이트 오류:", error);
        // 이 오류는 무시하고 프로필 업데이트 결과 반환
      }
    }
    
    // 8. 결과 반환
    return NextResponse.json({
      success: true,
      seller: {
        id: sellerId,
        name: updatedProfile.name,
        profileImage: updatedProfile.profile_image,
        rating: updatedProfile.rating || 4.5,
        responseRate: updatedProfile.response_rate || 98,
        successfulSales: successfulSales
      }
    });
    
  } catch (error) {
    console.error("판매자 통계 업데이트 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
} 