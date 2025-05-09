// 목적: 구매자가 거래 상태를 'CONFIRMED'로 업데이트하는 API
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase.types';
import { cors } from '@/lib/cors';

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
    const supabase = createRouteHandlerClient<Database>({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log('인증된 사용자 ID:', userId);
    
    const orderNumber = params.order_number;
    console.log(`거래 상세 정보 API 호출됨 - ID/주문번호: ${orderNumber}`);

    // 거래 정보 조회 (purchases 테이블에서)
    let query = supabase
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
        buyer:users!purchases_buyer_id_fkey (
          id,
          name,
          profile_image
        ),
        seller:users!purchases_seller_id_fkey (
          id,
          name,
          profile_image
        )
      `);
    
    // ID가 숫자인지 오더번호(ORDER-*)인지 확인하여 적절한 쿼리 실행
    if (/^ORDER-/.test(orderNumber)) {
      console.log('오더 번호로 조회:', orderNumber);
      query = query.eq('order_number', orderNumber);
    } else {
      console.log('ID 번호로 조회:', orderNumber);
      query = query.eq('id', Number(orderNumber));
    }
    
    const { data: purchase, error } = await query.maybeSingle();
    
    if (error || !purchase) {
      console.error('거래 조회 중 Supabase 오류:', error);
      return NextResponse.json({ 
        success: false,
        error: '거래를 찾을 수 없습니다.',
        details: error?.message || '데이터베이스 조회 오류'
      }, { 
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      });
    }
    
    // 현재 사용자가 구매자 또는 판매자인지 확인
    if (purchase.buyer_id !== userId && purchase.seller_id !== userId) {
      return NextResponse.json({ 
        success: false, 
        error: '이 거래에 접근할 권한이 없습니다.' 
      }, { 
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      });
    }
    
    // 사용자의 역할 확인 (구매자 또는 판매자)
    const isBuyer = purchase.buyer_id === userId;
    
    // 타입 단언을 통해 타입 에러 해결
    const purchaseData = purchase as any;
    
    // 디버깅: posts 및 title 값 확인
    console.log('DEBUG - ticket_title 원본:', purchaseData.ticket_title);
    console.log('DEBUG - ticket_title 타입:', typeof purchaseData.ticket_title);
    console.log('DEBUG - posts 타입:', typeof purchaseData.posts);
    console.log('DEBUG - posts 내용:', purchaseData.posts);
    console.log('DEBUG - posts[0]?.title:', purchaseData.posts?.[0]?.title);
    console.log('DEBUG - 배열 여부:', Array.isArray(purchaseData.posts));
    
    // 더 안전하게 제목 값 처리 - 객체 구조 다양성 고려
    const titleValue =
      (typeof purchaseData.ticket_title === 'string' && purchaseData.ticket_title.trim()) ||
      (Array.isArray(purchaseData.posts) && purchaseData.posts[0]?.title?.trim()) ||
      (typeof purchaseData.posts?.title === 'string' && purchaseData.posts?.title.trim()) ||  // 객체인 경우도 커버
      "제목 없음";
    
    console.log('DEBUG - 최종 선택된 제목:', titleValue);
    
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
        title: titleValue,
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
    
    return NextResponse.json({
      success: true, 
      transaction: transactionData
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...cors
      }
    });
  } catch (error) {
    console.error('거래 정보 조회 중 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: '거래 정보를 조회하는 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...cors
      }
    });
  }
}

// PUT 요청 처리 - 거래 상태 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { order_number: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const userId = session.user.id;
    const orderNumber = params.order_number;
    
    // 요청 본문 파싱
    const requestData = await request.json();
    const { status, reason } = requestData;
    
    if (!status) {
      return NextResponse.json({ 
        success: false, 
        error: '상태값이 누락되었습니다.' 
      }, { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      });
    }
    
    // 거래 조회
    let query = supabase
      .from('purchases')
      .select('id, status, buyer_id, seller_id')
      
    if (/^ORDER-/.test(orderNumber)) {
      query = query.eq('order_number', orderNumber);
    } else {
      query = query.eq('id', Number(orderNumber));
    }
    
    const { data: purchase, error: queryError } = await query.maybeSingle();
    
    if (queryError || !purchase) {
      console.error('거래 조회 오류:', queryError);
      return NextResponse.json({ 
        success: false, 
        error: '거래를 찾을 수 없습니다.' 
      }, { 
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      });
    }
    
    // 권한 확인
    if (purchase.buyer_id !== userId) {
      return NextResponse.json({ 
        success: false, 
        error: '이 거래의 구매자만 상태를 변경할 수 있습니다.' 
      }, { 
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      });
    }
    
    // 현재 상태 확인
    if (purchase.status !== 'COMPLETED') {
      return NextResponse.json({ 
        success: false, 
        error: '티켓팅 완료 상태의 거래만 구매확정할 수 있습니다.' 
      }, { 
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      });
    }
    
    // 상태 업데이트
    const { error: updateError } = await supabase
      .from('purchases')
      .update({
        status: status,
        updated_at: new Date().toISOString(),
        notes: reason || '구매자 확인 완료'
      })
      .eq('id', purchase.id);
    
    if (updateError) {
      console.error('거래 상태 업데이트 오류:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: '거래 상태 업데이트에 실패했습니다.' 
      }, { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '거래 상태가 업데이트되었습니다.',
      status: status
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...cors
      }
    });
  } catch (error) {
    console.error('거래 업데이트 중 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '거래 업데이트 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...cors
      }
    });
  }
}

// PATCH 요청 처리
export async function PATCH(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ success: false, error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const userId = session.user.id;
    const orderNumber = params.order_number;
    
    // 요청 본문 파싱
    const requestData = await req.json();
    
    // 동일한 방식으로 PUT 처리 로직을 따라가면 됩니다
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'PENDING': return '결제 대기중';
    case 'PROCESSING': return '취켓팅 진행중';
    case 'COMPLETED': return '취켓팅 완료';
    case 'CONFIRMED': return '거래 완료';
    case 'CANCELLED': return '거래 취소';
    case 'REFUNDED': return '환불 완료';
    default: return '알 수 없음';
  }
}

function getCurrentStep(status: string): string {
  switch (status) {
    case 'PENDING': return 'payment';
    case 'PROCESSING': return 'ticketing_in_progress';
    case 'COMPLETED': return 'ticketing_completed';
    case 'CONFIRMED': return 'confirmed';
    case 'CANCELLED': return 'cancelled';
    case 'REFUNDED': return 'refunded';
    default: return 'unknown';
  }
}

function getTicketingStatusText(status: string): string {
  switch (status) {
    case 'PENDING': return '대기중';
    case 'PROCESSING': return '취켓팅 진행중';
    case 'COMPLETED': return '취켓팅 완료';
    case 'CONFIRMED': return '거래 완료';
    case 'CANCELLED': return '취소됨';
    case 'REFUNDED': return '환불됨';
    default: return '알 수 없음';
  }
} 