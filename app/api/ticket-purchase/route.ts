import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { z } from "zod";
import { convertBigIntToString } from "@/lib/utils";
import { adminSupabase, createAdminClient } from "@/lib/supabase-admin";
import { getSupabaseClient } from '@/lib/supabase';
import { verifyToken } from "@/lib/auth";
import { sendPurchaseCompletedNotification } from '@/services/kakao-notification-service';
import { headers } from 'next/headers';

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

// 구매 요청 스키마
const purchaseSchema = z.object({
  postId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  selectedSeats: z.string().optional(),
  phoneNumber: z.string().optional(),
  paymentMethod: z.string().optional(),
});

// 간단한 주문 번호 생성 함수
async function createSimpleOrderNumber() {
  const timestamp = new Date().getTime().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORDER-${timestamp}-${random}`;
}

// POST 요청 핸들러 - 티켓 구매 신청
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    
    console.log("티켓 구매 API 호출됨");
    
    // 현재 인증된 사용자 정보 가져오기
    let authUser = await getAuthenticatedUser(request);
    
    // 개발 환경에서 URL 쿼리 파라미터로 인증 지원 (다른 API와 동일한 패턴)
    if (!authUser && process.env.NODE_ENV === 'development') {
      // URL에서 userId 쿼리 파라미터 확인
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId');
      console.log("개발 환경 - 쿼리 파라미터 userId 확인:", userId);
      
      if (userId) {
        console.log("개발 환경 - 쿼리 파라미터 userId 사용:", userId);
        
        // 테스트 사용자 객체 생성
        authUser = {
          id: userId,
          email: 'dev@example.com',
          role: 'USER'
        } as any; // 타입 체크 우회
        console.log("개발 환경 - 테스트 사용자 생성:", authUser);
      }
    }
    
    // 인증 실패 시 추가 디버깅
    if (!authUser) {
      // 직접 세션 확인
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (!sessionError && sessionData.session?.user) {
          console.log("세션은 존재하지만 getAuthenticatedUser에서 인식하지 못함:", 
            sessionData.session.user.id);
          
          // 세션이 있으면 인증 사용자로 사용
          authUser = sessionData.session.user;
          console.log("세션에서 사용자 정보 복구 성공");
        } else {
          console.log("세션 확인 결과: 세션 없음", sessionError?.message);
        }
      } catch (e) {
        console.error("세션 확인 중 오류:", e);
      }
    }
    
    // 쿠키 디버깅
    try {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        console.log("요청에 포함된 쿠키 헤더:", cookieHeader.substring(0, 100) + "...");
      } else {
        console.log("요청에 쿠키 헤더가 없음");
      }
    } catch (e) {
      console.error("쿠키 디버깅 중 오류:", e);
    }
    
    // 인증 헤더 디버깅
    try {
      const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
      if (authHeader) {
        console.log("Authorization 헤더 발견:", authHeader.substring(0, 20) + "...");
        
        // 헤더에서 토큰을 추출하여 직접 사용자 정보 가져오기 시도
        if (!authUser && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const { data, error } = await supabase.auth.getUser(token);
            if (!error && data.user) {
              console.log("Authorization 헤더에서 사용자 인증 성공:", data.user.id);
              authUser = data.user;
            } else {
              console.log("Authorization 헤더 토큰으로 사용자 조회 실패:", error?.message);
            }
          } catch (e) {
            console.error("토큰으로 사용자 조회 중 오류:", e);
          }
        }
      } else {
        console.log("Authorization 헤더가 없음");
      }
    } catch (e) {
      console.error("인증 헤더 디버깅 중 오류:", e);
    }
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 사용자 정보:", authUser);

    // 요청 본문 파싱
    let body;
    try {
      body = await request.json();
      console.log("요청 본문:", body);
    } catch (error) {
      console.error("요청 본문 파싱 오류:", error);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "잘못된 요청 형식입니다." },
        { status: 400 }
      ));
    }
    
    // 입력 데이터 유효성 검사
    const validationResult = purchaseSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("입력 데이터 유효성 검사 실패:", validationResult.error.errors);
      return addCorsHeaders(NextResponse.json(
        { 
          success: false, 
          message: "유효하지 않은 입력 데이터입니다.", 
          errors: validationResult.error.errors 
        },
        { status: 400 }
      ));
    }

    const { postId, quantity, selectedSeats, phoneNumber, paymentMethod } = validationResult.data;
    console.log("유효성 검사 통과 후 데이터:", { postId, quantity, selectedSeats, phoneNumber, paymentMethod });

    // 게시글 조회 - 타입 문제를 피하기 위해 any 타입 사용
    const { data: post, error: postError } = await adminSupabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      console.log(`게시글 ID ${postId}를 찾을 수 없음:`, postError);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "해당하는 게시글을 찾을 수 없습니다." },
        { status: 404 }
      ));
    }

    console.log("게시글 데이터:", post);

    // 게시글의 작성자 ID와 현재 사용자 ID 비교
    // any 타입으로 처리하여 TypeScript 오류 회피
    const postData = post as any;
    const authorId = postData.author_id || postData.user_id;
    
    if (String(authorId) === String(authUser.id)) {
      console.log("자신의 게시글은 구매할 수 없습니다");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "자신의 게시글은 구매할 수 없습니다." },
        { status: 400 }
      ));
    }

    // 게시글 상태 확인
    if (postData.status && postData.status !== "ACTIVE") {
      console.log(`게시글 상태가 ${postData.status}입니다. ACTIVE 상태만 구매 가능합니다.`);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "이미 판매 진행 중이거나 판매 완료된 게시글입니다." },
        { status: 400 }
      ));
    }

    // 이미 구매 진행 중인지 확인
    const { data: existingPurchases, error: purchaseError } = await adminSupabase
      .from('purchases')
      .select('*')
      .eq('post_id', postId)
      .in('status', ['PENDING', 'PROCESSING', 'COMPLETED']);

    if (purchaseError) {
      console.error("구매 정보 조회 오류:", purchaseError);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "구매 정보 조회 중 오류가 발생했습니다." },
        { status: 500 }
      ));
    }

    if (existingPurchases && existingPurchases.length > 0) {
      console.log(`게시글 ID ${postId}는 이미 구매가 진행 중입니다.`);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "이미 다른 사용자가 구매 중인 게시글입니다." },
        { status: 400 }
      ));
    }

    // 주문 번호 생성
    const orderNumber = await createSimpleOrderNumber();
    
    // 구매 데이터 준비
    const purchaseData: any = {
      buyer_id: authUser.id,
      post_id: postId,
      seller_id: authorId,
      status: "PROCESSING",
      quantity,
      created_at: new Date().toISOString()
    };
    
    // 추가 필드 (데이터베이스에 존재하는 경우에만)
    if (orderNumber) purchaseData.order_number = orderNumber;
    if (phoneNumber) purchaseData.phone_number = phoneNumber;
    if (selectedSeats) purchaseData.selected_seats = selectedSeats;
    if (paymentMethod) purchaseData.payment_method = paymentMethod;
    
    // 가격 정보 설정 (total_price는 NOT NULL 필드)
    let totalPrice = 0;
    
    // 1. 게시글에 ticket_price 필드가 있으면 사용
    if (postData.ticket_price) {
      totalPrice = postData.ticket_price * quantity;
    } 
    // 2. content 필드에서 가격 정보 추출 시도 (JSON 형식인 경우)
    else if (postData.content) {
      try {
        const contentData = JSON.parse(postData.content);
        if (contentData.price) {
          totalPrice = contentData.price * quantity;
        } else if (contentData.sections && contentData.sections.length > 0) {
          // sections 배열의 첫 번째 항목의 price 사용
          totalPrice = contentData.sections[0].price * quantity;
        }
      } catch (e) {
        console.log("게시글 content 파싱 실패 (JSON 아님):", e);
      }
    }
    
    // 3. 최소한의 기본값 설정 (0원은 안전하지 않을 수 있으나 필드는 채워야 함)
    purchaseData.total_price = totalPrice;
    
    console.log("구매 데이터:", purchaseData);

    // 구매 정보 생성
    const { data: purchase, error: createError } = await adminSupabase
      .from('purchases')
      .insert(purchaseData)
      .select()
      .single();

    if (createError) {
      console.error("구매 정보 생성 오류:", createError);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "구매 정보 생성 중 오류가 발생했습니다." },
        { status: 500 }
      ));
    }

    // 전화번호가 제공된 경우 사용자 프로필에 저장
    if (phoneNumber) {
      try {
        // 하이픈 제거
        const cleanPhoneNumber = phoneNumber.replace(/-/g, '');
        
        console.log(`사용자 ID ${authUser.id}의 프로필에 전화번호 ${cleanPhoneNumber} 저장 시도`);
        
        // 프로필 업데이트
        const { error: profileUpdateError } = await adminSupabase
          .from('users')
          .update({ phone_number: cleanPhoneNumber })
          .eq('id', authUser.id);
        
        if (profileUpdateError) {
          console.error("프로필 전화번호 업데이트 오류:", profileUpdateError);
          // 프로필 업데이트 실패해도 구매 프로세스는 계속 진행
        } else {
          console.log(`사용자 ID ${authUser.id}의 프로필 전화번호 업데이트 성공`);
        }
      } catch (phoneUpdateError) {
        console.error("전화번호 저장 중 오류:", phoneUpdateError);
        // 오류가 발생해도 구매는 계속 진행
      }
    }

    // 게시물 상태 업데이트
    const updateData: any = { status: "PROCESSING" };
    const { error: updateError } = await adminSupabase
      .from('posts')
      .update(updateData)
      .eq('id', postId);

    if (updateError) {
      console.error("게시글 상태 업데이트 오류:", updateError);
      // 실패해도 구매는 성공했으므로 계속 진행
    } else {
      console.log(`게시글 ID ${postId}의 상태가 'PROCESSING'으로 업데이트되었습니다.`);
    }

    // 판매자에게 알림 생성
    try {
      const notificationMessage = `구매자님이 "${postData.title || postData.event_name || '게시글'}"의 결제를 완료하여 취켓팅이 시작되었습니다. (${quantity}매)`;
      
      const notificationData: any = {
        user_id: authorId,
        post_id: postId,
        message: notificationMessage,
        type: "TICKET_REQUEST",
        created_at: new Date().toISOString()
      };
      
      const { error: notificationError } = await adminSupabase
        .from('notifications')
        .insert(notificationData);

      if (notificationError) {
        console.error("알림 생성 오류:", notificationError);
        // 알림 생성 실패는 전체 프로세스에 영향을 주지 않음
      }
    } catch (notificationError) {
      console.error("알림 생성 과정에서 오류 발생:", notificationError);
      // 오류가 발생해도 계속 진행
    }

    // 🔔 구매 완료 솔라피 알림톡 발송
    try {
      console.log("📱 구매 완료 알림톡 발송 시작");
      
      // 구매자와 판매자 정보 조회
      const { data: buyerData, error: buyerError } = await adminSupabase
        .from('users')
        .select('name, phone_number')
        .eq('id', authUser.id)
        .single();
      
      const { data: sellerData, error: sellerError } = await adminSupabase
        .from('users')
        .select('name, phone_number')
        .eq('id', authorId)
        .single();
      
      const productName = postData.title || postData.event_name || '티켓';
      const priceText = totalPrice > 0 ? `${totalPrice.toLocaleString()}원` : '가격 미정';
      
      // 구매자에게 구매 완료 알림톡 발송
      if (buyerData && buyerData.phone_number) {
        console.log(`📞 구매자 ${buyerData.name}(${buyerData.phone_number})에게 구매 완료 알림톡 발송`);
        
        const buyerResult = await sendPurchaseCompletedNotification(
          buyerData.phone_number,
          buyerData.name || '구매자',
          orderNumber || purchase.id.toString(),
          productName,
          priceText
        );
        
        if (buyerResult.success) {
          console.log("✅ 구매자 알림톡 발송 성공");
        } else {
          console.error("❌ 구매자 알림톡 발송 실패:", buyerResult.error);
        }
      } else {
        console.log("⚠️ 구매자 전화번호 없음: 구매자 알림톡 발송 건너뜀");
      }
      
      // 판매자에게 새 주문 알림톡 발송
      if (sellerData && sellerData.phone_number) {
        console.log(`📞 판매자 ${sellerData.name}(${sellerData.phone_number})에게 새 주문 알림톡 발송`);
        
        const sellerResult = await sendPurchaseCompletedNotification(
          sellerData.phone_number,
          sellerData.name || '판매자',
          orderNumber || purchase.id.toString(),
          `[새 주문] ${productName}`,
          priceText
        );
        
        if (sellerResult.success) {
          console.log("✅ 판매자 알림톡 발송 성공");
        } else {
          console.error("❌ 판매자 알림톡 발송 실패:", sellerResult.error);
        }
      } else {
        console.log("⚠️ 판매자 전화번호 없음: 판매자 알림톡 발송 건너뜀");
      }
      
    } catch (kakaoError) {
      console.error("❌ 솔라피 알림톡 발송 중 오류:", kakaoError);
      // 알림톡 발송 실패해도 구매 프로세스는 계속 진행
    }

    // 구매 정보 응답
    return addCorsHeaders(NextResponse.json({
      success: true,
      message: "구매 신청이 성공적으로 처리되었습니다.",
      purchase
    }, { status: 201 }));
    
  } catch (error) {
    console.error("구매 처리 오류:", error);
    let errorMessage = "구매 처리 중 오류가 발생했습니다.";
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("오류 스택:", error.stack);
      
      // 사용자 입력 관련 오류는 400 응답
      if (
        error.message.includes("이미 다른 사용자가 구매 중인 게시글입니다") ||
        error.message.includes("이미 판매 진행 중이거나 판매 완료된 게시글입니다") ||
        error.message.includes("자신의 게시글은 구매할 수 없습니다")
      ) {
        statusCode = 400;
      }
    }
    
    return addCorsHeaders(NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        // 개발 환경에서만 상세 오류 정보 포함
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined 
      },
      { status: statusCode }
    ));
  }
} 