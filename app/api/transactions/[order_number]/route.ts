// 목적: 구매자가 거래 상태를 'CONFIRMED'로 업데이트하는 API
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { supabase, createAdminClient } from '@/lib/supabase';
import { cors } from '@/lib/cors';
import { PostgrestFilterBuilder } from '@supabase/supabase-js';

// OPTIONS 요청 처리 (CORS 지원)
export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// GET 요청 처리 - 특정 거래 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { order_number: string } }
) {
  try {
    const order_number = params.order_number;
    console.log(`거래 상세 정보 API 호출됨 - ID/주문번호: ${order_number}`);
    
    // 인증된 사용자 확인
    const user = await getAuthenticatedUser(request);
    if (!user) {
      console.log('인증된 사용자를 찾을 수 없음');
      return new NextResponse(
        JSON.stringify({ error: '인증되지 않은 사용자입니다.' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    const userId = user.id;
    console.log('인증된 사용자 ID:', userId);
    
    // 거래 ID 확인 (number 또는 string 형식 모두 지원)
    const transactionId = order_number;
    
    // 관리자 권한으로 Supabase 클라이언트 생성 (RLS 정책 우회를 위해)
    const adminSupabase = createAdminClient();
    
    // 거래 정보 조회 (purchases 테이블에서)
    let query: PostgrestFilterBuilder<any> = adminSupabase
      .from('purchases')
      .select(`
        *,
        posts!post_id (
          id,
          title,
          category,
          event_date,
          event_venue,
          ticket_price,
          is_deleted,
          author:users!author_id (
            id,
            name,
            profile_image
          )
        ),
        buyer:users!buyer_id (
          id,
          name,
          profile_image
        ),
        seller:users!seller_id (
          id,
          name,
          profile_image
        )
      `);
    
    // ID가 숫자인지 오더번호(ORDER-*)인지 확인하여 적절한 쿼리 실행
    if (/^ORDER-/.test(transactionId)) {
      console.log('오더 번호로 조회:', transactionId);
      query = query.eq('order_number', transactionId);
    } else {
      console.log('ID 번호로 조회:', transactionId);
      query = query.eq('id', Number(transactionId));
    }
    
    const { data: purchase, error } = await query.single();
    
    if (error || !purchase) {
      console.error('거래 조회 중 Supabase 오류:', error);
      return new NextResponse(
        JSON.stringify({ 
          error: '거래를 찾을 수 없습니다.',
          details: error?.message || '데이터베이스 조회 오류'
        }),
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    // 현재 사용자가 구매자 또는 판매자인지 확인
    if (purchase.buyer_id !== userId && purchase.seller_id !== userId) {
      return new NextResponse(
        JSON.stringify({ error: '이 거래에 접근할 권한이 없습니다.' }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    // 사용자의 역할 확인 (구매자 또는 판매자)
    const isBuyer = purchase.buyer_id === userId;
    
    // 타입 단언을 통해 타입 에러 해결
    const purchaseData = purchase as any;
    
    // 클라이언트에 전달할 데이터 포맷팅
    const transactionData = {
      id: purchaseData.id.toString(),
      type: isBuyer ? 'purchase' : 'sale',
      status: getStatusText(purchaseData.status),
      currentStep: getCurrentStep(purchaseData.status),
      stepDates: {
        payment: purchaseData.created_at,
        ticketing_started: purchaseData.created_at,
        ticketing_completed: purchaseData.status === 'COMPLETED' || purchaseData.status === 'CONFIRMED' 
          ? new Date().toISOString()
          : null,
        confirmed: purchaseData.status === 'CONFIRMED' 
          ? new Date().toISOString()
          : null,
      },
      ticket: {
        title: purchaseData.ticket_title || (purchaseData.posts?.[0]?.title || ''),
        date: purchaseData.event_date || (purchaseData.posts?.[0]?.event_date || ''),
        time: '',
        venue: purchaseData.event_venue || (purchaseData.posts?.[0]?.event_venue || ''),
        seat: purchaseData.selected_seats || '',
        image: purchaseData.image_url || '/placeholder.svg'
      },
      price: Number(purchaseData.total_price) || 0,
      paymentMethod: purchaseData.payment_method || '신용카드',
      paymentStatus: '결제 완료',
      ticketingStatus: getTicketingStatusText(purchaseData.status),
      ticketingInfo: '취소표 발생 시 알림을 보내드립니다. 취소표 발생 시 빠르게 예매를 진행해 드립니다.',
      seller: !isBuyer ? null : {
        id: Array.isArray(purchaseData.seller) 
            ? purchaseData.seller[0]?.id?.toString() || ''
            : purchaseData.seller?.id?.toString() || '',
        name: Array.isArray(purchaseData.seller)
            ? purchaseData.seller[0]?.name || '판매자 정보 없음'
            : purchaseData.seller?.name || '판매자 정보 없음',
        profileImage: Array.isArray(purchaseData.seller)
            ? purchaseData.seller[0]?.profile_image || '/placeholder.svg'
            : purchaseData.seller?.profile_image || '/placeholder.svg',
      },
      buyer: isBuyer ? null : {
        id: Array.isArray(purchaseData.buyer)
            ? purchaseData.buyer[0]?.id?.toString() || ''
            : purchaseData.buyer?.id?.toString() || '',
        name: Array.isArray(purchaseData.buyer)
            ? purchaseData.buyer[0]?.name || '구매자 정보 없음'
            : purchaseData.buyer?.name || '구매자 정보 없음',
        profileImage: Array.isArray(purchaseData.buyer)
            ? purchaseData.buyer[0]?.profile_image || '/placeholder.svg'
            : purchaseData.buyer?.profile_image || '/placeholder.svg',
      },
    };
    
    return new NextResponse(
      JSON.stringify(transactionData),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      }
    );
  } catch (error) {
    console.error('거래 정보 조회 중 오류:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: '거래 정보를 조회하는 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      }
    );
  }
}

// PUT 요청 처리 - 거래 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { order_number: string } }
) {
  try {
    const order_number = params.order_number;
    console.log(`거래 정보 업데이트 API 호출됨 - ID/주문번호: ${order_number}`);
    
    // 요청 본문 파싱
    const bodyText = await request.text();
    const body = JSON.parse(bodyText);
    console.log('업데이트 요청 내용:', body);
    
    // 인증된 사용자 확인
    const user = await getAuthenticatedUser(request);
    if (!user) {
      console.log('인증된 사용자를 찾을 수 없음');
      return new NextResponse(
        JSON.stringify({ error: '인증되지 않은 사용자입니다.' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    const userId = user.id;
    console.log('인증된 사용자 ID:', userId);
    
    // 관리자 권한으로 Supabase 클라이언트 생성
    const adminSupabase = createAdminClient();
    
    // 거래 정보 조회
    let query: PostgrestFilterBuilder<any> = adminSupabase.from('purchases');
    
    // ID가 숫자인지 오더번호(ORDER-*)인지 확인하여 적절한 쿼리 실행
    if (/^ORDER-/.test(order_number)) {
      query = query.select('*').eq('order_number', order_number);
    } else {
      query = query.select('*').eq('id', Number(order_number));
    }
    
    const { data: purchase, error: queryError } = await query.single();
    
    if (queryError || !purchase) {
      console.error('거래 조회 중 Supabase 오류:', queryError);
      return new NextResponse(
        JSON.stringify({ 
          error: '거래를 찾을 수 없습니다.',
          details: queryError?.message || '데이터베이스 조회 오류'
        }),
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    // 사용자가 구매자인지 확인 (판매자는 일부 필드만 수정 가능)
    const isBuyer = purchase.buyer_id === userId;
    const isSeller = purchase.seller_id === userId;
    
    if (!isBuyer && !isSeller) {
      return new NextResponse(
        JSON.stringify({ error: '이 거래를 수정할 권한이 없습니다.' }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    // 업데이트할 필드 준비
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    
    // 구매 확정 (currentStep = confirmed인 경우)
    if (body.currentStep === 'confirmed' && purchase.status === 'COMPLETED' && isBuyer) {
      updateData.status = 'CONFIRMED';
    }
    
    // 판매자가 취켓팅 완료 처리
    if (body.currentStep === 'ticketing_completed' && ['PENDING', 'PROCESSING'].includes(purchase.status) && isSeller) {
      updateData.status = 'COMPLETED';
    }
    
    // 변경할 내용이 없으면 조기 반환
    if (Object.keys(updateData).length <= 1) { // updated_at만 있는 경우
      return new NextResponse(
        JSON.stringify({ 
          message: '변경할 내용이 없습니다.',
          transaction: purchase
        }),
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    // 거래 정보 업데이트
    let updateQuery: PostgrestFilterBuilder<any> = adminSupabase.from('purchases');
    
    if (/^ORDER-/.test(order_number)) {
      updateQuery = updateQuery.update(updateData).eq('order_number', order_number);
    } else {
      updateQuery = updateQuery.update(updateData).eq('id', Number(order_number));
    }
    
    const { data: updatedPurchase, error: updateError } = await updateQuery.select().single();
    
    if (updateError) {
      console.error('거래 업데이트 중 Supabase 오류:', updateError);
      return new NextResponse(
        JSON.stringify({ 
          error: '거래 정보를 업데이트하는 중 오류가 발생했습니다.',
          details: updateError.message
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...cors
          }
        }
      );
    }
    
    return new NextResponse(
      JSON.stringify({ 
        message: '거래 정보가 성공적으로 업데이트되었습니다.',
        transaction: updatedPurchase
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      }
    );
  } catch (error) {
    console.error('거래 정보 업데이트 중 오류:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: '거래 정보를 업데이트하는 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      }
    );
  }
}

// PATCH 요청 처리 - 구매자가 거래 상태를 'CONFIRMED'로 업데이트
export async function PATCH(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  const { order_number } = params;

  if (!order_number) {
    return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { status: 400 });
  }

  const body = await req.json();
  const newStatus = body.currentStep === "confirmed" ? "CONFIRMED" : null;

  if (!newStatus) {
    return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("purchases")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("order_number", order_number);

  if (error) {
    console.error("거래 상태 업데이트 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// 상태 변환 유틸리티 함수
function getStatusText(status: string): string {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return '취켓팅 진행중';
    case 'COMPLETED':
      return '취켓팅 완료';
    case 'CONFIRMED':
      return '구매 확정';
    case 'CANCELLED':
      return '거래 취소';
    default:
      return '알 수 없음';
  }
}

function getCurrentStep(status: string): string {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return 'ticketing_started';
    case 'COMPLETED':
      return 'ticketing_completed';
    case 'CONFIRMED':
      return 'confirmed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return '';
  }
}

function getTicketingStatusText(status: string): string {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return '취켓팅 진행중';
    case 'COMPLETED':
      return '취켓팅 완료';
    case 'CONFIRMED':
      return '구매 확정';
    case 'CANCELLED':
      return '거래 취소';
    default:
      return '알 수 없음';
  }
} 