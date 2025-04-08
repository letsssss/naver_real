import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from '@/lib/supabase';

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

// 상태 업데이트 함수: PATCH 요청 처리
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 파라미터 검증
    if (!params || !params.id) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "유효하지 않은 요청: ID가 제공되지 않았습니다." },
        { status: 400 }
      ));
    }
    
    const id = params.id;
    console.log(`거래 상태 업데이트 API 호출됨 - ID: ${id}`);
    
    // 2. 인증된 사용자 확인
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }
    
    console.log("인증된 사용자 ID:", authUser.id);
    
    // 3. 요청 바디에서 새 상태 가져오기
    const body = await request.json();
    const { status } = body;
    
    console.log(`요청된 상태 업데이트: ${status}`);
    
    if (!status || !['PENDING', 'PROCESSING', 'COMPLETED', 'CONFIRMED'].includes(status)) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "유효하지 않은 상태값입니다." },
        { status: 400 }
      ));
    }
    
    // 4. Supabase 클라이언트 생성 및 기존 구매 정보 조회
    const supabase = createAdminClient();
    
    // ID가 숫자인지 확인하고 적절한 형태로 변환
    const numericId = Number(id);

    const { data: existingPurchase, error: queryError } = await supabase
      .from('purchases')
      .select(`
        *,
        post:posts(*),
        buyer:users!buyer_id(*),
        seller:users!seller_id(*)
      `)
      .eq('id', numericId)
      .single();
    
    if (queryError || !existingPurchase) {
      console.error("구매 정보 조회 실패:", queryError?.message);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "해당 구매 정보를 찾을 수 없습니다." },
        { status: 404 }
      ));
    }
    
    // 5. 권한 확인: 상태에 따른 업데이트 권한 확인
    let isAuthorized = false;
    
    if (status === 'PROCESSING' || status === 'COMPLETED') {
      // 취켓팅 시작과 취켓팅 완료는 판매자만 가능
      isAuthorized = existingPurchase.seller_id === authUser.id;
    } else if (status === 'CONFIRMED') {
      // 구매 확정은 구매자 또는 판매자 모두 가능
      isAuthorized = existingPurchase.buyer_id === authUser.id || existingPurchase.seller_id === authUser.id;
    } else {
      // 기타 상태는 판매자나 구매자 모두 가능
      isAuthorized = existingPurchase.seller_id === authUser.id || existingPurchase.buyer_id === authUser.id;
    }
    
    if (!isAuthorized) {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "이 거래 상태를 업데이트할 권한이 없습니다." },
        { status: 403 }
      ));
    }
    
    // 6. 상태 변경 로직: 순서 체크
    if (status === 'PROCESSING' && existingPurchase.status !== 'PENDING') {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "결제 완료 상태에서만 취켓팅을 시작할 수 있습니다." },
        { status: 400 }
      ));
    }
    
    if (status === 'COMPLETED' && existingPurchase.status !== 'PROCESSING') {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "취켓팅 시작 상태에서만 취켓팅 완료 처리할 수 있습니다." },
        { status: 400 }
      ));
    }
    
    if (status === 'CONFIRMED' && existingPurchase.status !== 'COMPLETED') {
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "취켓팅 완료 상태에서만 구매 확정할 수 있습니다." },
        { status: 400 }
      ));
    }
    
    // 7. 구매 정보 업데이트
    const { data: updatedPurchase, error: updateError } = await supabase
      .from('purchases')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', numericId)
      .select(`
        *,
        post:posts(*),
        buyer:users!buyer_id(*),
        seller:users!seller_id(*)
      `)
      .single();
    
    if (updateError || !updatedPurchase) {
      console.error("구매 정보 업데이트 실패:", updateError?.message);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "구매 정보 업데이트에 실패했습니다." },
        { status: 500 }
      ));
    }
    
    // 8. 구매 확정 시 게시물 상태를 SOLD로 변경
    if (status === 'CONFIRMED' && updatedPurchase.post_id) {
      console.log(`구매 확정: 게시물 ID ${updatedPurchase.post_id}의 상태를 'SOLD'로 업데이트합니다.`);
      
      const { error: postUpdateError } = await supabase
        .from('posts')
        .update({ 
          status: 'SOLD'  // 타입 문제가 있지만 posts 테이블에는 status 필드가 존재함
        } as any)
        .eq('id', updatedPurchase.post_id);
      
      if (postUpdateError) {
        console.error("게시물 상태 업데이트 실패:", postUpdateError.message);
        // 게시물 업데이트 실패는 전체 트랜잭션을 실패시키지 않음
      }
    }
    
    // 9. 알림 생성
    let notificationMessage = "";
    let recipientId = null;
    
    switch (status) {
      case 'PROCESSING':
        notificationMessage = `${updatedPurchase.post?.title || '티켓'} 취켓팅이 시작되었습니다.`;
        recipientId = updatedPurchase.buyer_id;
        break;
      case 'COMPLETED':
        notificationMessage = `${updatedPurchase.post?.title || '티켓'} 취켓팅이 완료되었습니다. 구매 확정을 진행해주세요.`;
        recipientId = updatedPurchase.buyer_id;
        break;
      case 'CONFIRMED':
        notificationMessage = `${updatedPurchase.post?.title || '티켓'} 구매가 확정되었습니다.`;
        recipientId = updatedPurchase.seller_id;
        break;
    }
    
    if (notificationMessage && recipientId) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: recipientId,
          post_id: updatedPurchase.post_id,
          message: notificationMessage,
          type: 'PURCHASE_STATUS',
          is_read: false,
        });
      
      if (notificationError) {
        console.error("알림 생성 실패:", notificationError.message);
        // 알림 생성 실패는 전체 트랜잭션을 실패시키지 않음
      }
    }
    
    // 10. 성공 응답 반환
    return addCorsHeaders(NextResponse.json({
      success: true,
      message: "거래 상태가 성공적으로 업데이트되었습니다.",
      purchase: updatedPurchase
    }, { status: 200 }));
      
  } catch (error) {
    console.error("구매 상태 업데이트 오류:", error instanceof Error ? error.message : String(error));
    console.error("상세 오류 스택:", error);
    
    return addCorsHeaders(
      NextResponse.json({ 
        success: false, 
        message: "구매 상태 업데이트 중 오류가 발생했습니다." 
      }, { status: 500 })
    );
  }
} 