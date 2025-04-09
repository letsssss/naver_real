import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { supabase, createAdminClient } from '@/lib/supabase';
import { cors } from '@/lib/cors';

// OPTIONS 요청 처리 (CORS 지원)
export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// GET 요청 처리 - 특정 거래 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Next.js 15에서는 params를 사용하기 전에 await 필요
    const id = await params.id;
    console.log(`거래 상세 정보 API 호출됨 - ID: ${id}`);
    
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
    const transactionId = id;
    
    // 관리자 권한으로 Supabase 클라이언트 생성 (RLS 정책 우회를 위해)
    const adminSupabase = createAdminClient();
    
    // 거래 정보 조회 (purchases 테이블에서)
    let query = adminSupabase
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
    
    // 디버깅을 위해 purchase 객체 출력
    console.log('Purchase 데이터:', JSON.stringify(purchase, null, 2));
    
    // 판매자와 구매자 정보가 올바른지 확인
    console.log('판매자 정보:', JSON.stringify(purchase.seller, null, 2));
    console.log('구매자 정보:', JSON.stringify(purchase.buyer, null, 2));
    
    // seller가 배열인지 단일 객체인지 확인
    console.log('seller 타입:', Array.isArray(purchase.seller) ? '배열' : typeof purchase.seller);
    if (Array.isArray(purchase.seller)) {
      console.log('seller 배열 길이:', purchase.seller.length);
      console.log('seller[0]:', purchase.seller[0]);
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
    
    console.log('거래 정보 조회 성공:', purchase.id);
    
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
    console.error('거래 조회 중 오류:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: '거래 조회 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
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

// PUT 요청 처리 - 거래 상태 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Next.js 15에서는 params를 사용하기 전에 await 필요
    const id = await params.id;
    console.log(`거래 상태 업데이트 API 호출됨 - ID: ${id}`);
    
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
    
    // 요청 바디 파싱
    const body = await request.json();
    const { currentStep } = body;
    
    // 거래 ID 확인
    const transactionId = id;
    
    // 관리자 권한으로 Supabase 클라이언트 생성
    const adminSupabase = createAdminClient();
    
    // 거래 정보 조회
    let query = adminSupabase
      .from('purchases')
      .select(`
        *,
        buyer:users!buyer_id (
          id, 
          name
        ),
        seller:users!seller_id (
          id, 
          name
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
    
    const { data: purchase, error: fetchError } = await query.single();
    
    if (fetchError || !purchase) {
      console.error('거래 조회 중 Supabase 오류:', fetchError);
      return new NextResponse(
        JSON.stringify({ 
          error: '거래를 찾을 수 없습니다.',
          details: fetchError?.message || '데이터베이스 조회 오류'
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
    
    // 현재 단계에 따른 새 상태 계산
    let newStatus = purchase.status;
    if (currentStep === 'ticketing_completed' && purchase.status === 'PROCESSING') {
      newStatus = 'COMPLETED';
    } else if (currentStep === 'confirmed' && 
              (purchase.status === 'COMPLETED' || purchase.status === 'PROCESSING')) {
      newStatus = 'CONFIRMED';
    }
    
    // 거래 상태 업데이트
    const { data: updatedPurchase, error: updateError } = await adminSupabase
      .from('purchases')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', Number(transactionId))
      .select()
      .single();
    
    if (updateError) {
      console.error('거래 상태 업데이트 중 Supabase 오류:', updateError);
      return new NextResponse(
        JSON.stringify({ 
          error: '거래 상태를 업데이트하는 중 오류가 발생했습니다.',
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
    
    // 응답 생성
    const responseData = {
      id: updatedPurchase.id.toString(),
      status: getStatusText(updatedPurchase.status),
      currentStep: getCurrentStep(updatedPurchase.status),
      message: '거래 상태가 성공적으로 업데이트되었습니다.'
    };
    
    console.log('거래 상태 업데이트 성공:', updatedPurchase.id, updatedPurchase.status);
    
    return new NextResponse(
      JSON.stringify(responseData),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...cors
        }
      }
    );
  } catch (error) {
    console.error('거래 상태 업데이트 중 오류:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: '거래 상태 업데이트 중 오류가 발생했습니다.',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
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

// 상태 텍스트 변환 함수
function getStatusText(status: string): string {
  switch (status) {
    case 'PENDING':
      return '결제 완료';
    case 'PROCESSING':
      return '취켓팅 시작';
    case 'COMPLETED':
      return '취켓팅 완료';
    case 'CONFIRMED':
      return '구매 확정';
    case 'CANCELLED':
      return '취소됨';
    default:
      return '진행 중';
  }
}

// 현재 단계 변환 함수
function getCurrentStep(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'payment';
    case 'PROCESSING':
      return 'ticketing_started';
    case 'COMPLETED':
      return 'ticketing_completed';
    case 'CONFIRMED':
      return 'confirmed';
    default:
      return 'payment';
  }
}

// 취켓팅 상태 텍스트 변환 함수
function getTicketingStatusText(status: string): string {
  switch (status) {
    case 'PENDING':
      return '결제 완료';
    case 'PROCESSING':
      return '취켓팅 진행중';
    case 'COMPLETED':
      return '취켓팅 완료';
    case 'CONFIRMED':
      return '구매 확정';
    case 'CANCELLED':
      return '취소됨';
    default:
      return '진행 중';
  }
} 