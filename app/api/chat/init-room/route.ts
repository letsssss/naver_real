// 목적: 거래(order_number) 기반으로 채팅방을 자동 생성하거나 반환합니다.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase.types';

// 관리자 클라이언트 생성
const adminSupabase = createAdminClient();

// ⚡ 하드코딩된 환경 변수 - 환경 변수 로딩 문제 해결
const SUPABASE_URL = 'https://jdubrjczdyqqtsppojgu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwNTE5NzcsImV4cCI6MjA1ODYyNzk3N30.rnmejhT40bzQ2sFl-XbBrme_eSLnxNBGe2SSt-R_3Ww';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdWJyamN6ZHlxcXRzcHBvamd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzA1MTk3NywiZXhwIjoyMDU4NjI3OTc3fQ.zsS91TzGsaInXzIdj3uY-2JSc7672nNipNvzCVANMkU';

// 디버깅을 위한 상수
const API_NAME = '[API:init-room]';

// 프로젝트 레퍼런스와 쿠키명 정의
const SUPABASE_PROJECT_REF = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF || 'jdubrjczdyqqtsppojgu';
const SUPABASE_AUTH_COOKIE_NAME = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const ACCESS_TOKEN_COOKIE = `sb-${SUPABASE_PROJECT_REF}-access-token`;
const REFRESH_TOKEN_COOKIE = `sb-${SUPABASE_PROJECT_REF}-refresh-token`;
const AUTH_STATUS_COOKIE = 'auth-status';

/**
 * 요청 헤더에서 토큰을 추출합니다.
 */
function getTokenFromHeaders(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  // Bearer 토큰 추출
  const match = authHeader.match(/Bearer (.+)/);
  if (!match || !match[1]) return null;

  return match[1];
}

/**
 * 요청에서 인증 토큰을 추출합니다.
 * 우선순위:
 * 1. Authorization 헤더
 * 2. 쿠키 (다양한 쿠키 이름 지원)
 */
function getTokenFromRequest(request: NextRequest): string | null {
  // 1. 헤더에서 토큰 확인
  const headerToken = getTokenFromHeaders(request);
  if (headerToken) {
    console.log(`${API_NAME} 헤더에서 토큰 발견`);
    return headerToken;
  }

  // 2. 쿠키에서 토큰 확인 (여러 가능한 쿠키 이름 시도)
  const cookieStore = request.cookies;
  
  // 각 쿠키를 확인하고 첫 번째 유효한 것을 사용
  const authToken = cookieStore.get(SUPABASE_AUTH_COOKIE_NAME)?.value;
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const authStatus = cookieStore.get(AUTH_STATUS_COOKIE)?.value;
  
  console.log(`${API_NAME} 쿠키 확인 결과:`);
  console.log(`- 인증 토큰: ${authToken ? '✅ 존재' : '❌ 없음'}`);
  console.log(`- 액세스 토큰: ${accessToken ? '✅ 존재' : '❌ 없음'}`);
  console.log(`- 인증 상태: ${authStatus || '❌ 없음'}`);
  
  if (accessToken) {
    console.log(`${API_NAME} 액세스 토큰 쿠키 발견`);
    return accessToken;
  }
  
  if (authToken) {
    console.log(`${API_NAME} 인증 토큰 쿠키 발견`);
    return authToken;
  }

  console.log(`${API_NAME} 토큰을 찾을 수 없음`);
  return null;
}

/**
 * 세션 유효성을 확인합니다.
 * 1. 서버 클라이언트로 세션 확인 시도
 * 2. 토큰이 있으면 직접 검증
 */
async function validateSession(request: NextRequest) {
  console.log(`${API_NAME} 세션 검증 시작`);
  
  try {
    // 1. 서버 컴포넌트 클라이언트로 세션 확인 (쿠키 기반)
    console.log(`${API_NAME} 서버 클라이언트로 세션 확인 시도`);
    const cookieStore = cookies();
    
    // 중요: 세션 및 쿠키 정보 출력
    console.log(`${API_NAME} 쿠키 저장소 내용:`);
    const allCookies = cookieStore.getAll();
    allCookies.forEach(cookie => {
      const valuePreview = cookie.value.substring(0, 15) + '...';
      console.log(`- ${cookie.name}: ${valuePreview}`);
    });
    
    // Supabase 인증 쿠키 확인
    const authCookie = cookieStore.get(SUPABASE_AUTH_COOKIE_NAME);
    if (authCookie) {
      try {
        const supabase = createServerClient();
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn(`${API_NAME} 세션 조회 실패:`, error.message);
        } else if (data.session) {
          console.log(`${API_NAME} ✅ 유효한 세션 확인: ${data.session.user.id}`);
          return {
            success: true,
            user: data.session.user,
            session: data.session
          };
        }
      } catch (error) {
        console.error(`${API_NAME} 세션 검증 중 오류:`, error);
      }
    }
    
    // 2. 토큰이 있으면 직접 검증 (헤더 또는 쿠키에서)
    const token = getTokenFromRequest(request);
    if (!token) {
      console.warn(`${API_NAME} ❌ 토큰 및 세션 없음 - 인증 실패`);
      return { success: false, error: "인증 정보가 없습니다." };
    }
    
    // 토큰으로 직접 검증 (개발 환경 또는 테스트 토큰 처리)
    if (process.env.NODE_ENV === 'development' && token === 'dev-test-token') {
      console.log(`${API_NAME} ✅ 개발 환경 테스트 토큰 인정`);
      return {
        success: true,
        user: { id: 'test-user-id', email: 'test@example.com' },
        devMode: true
      };
    }
    
    // 실제 토큰 검증 시도
    try {
      console.log(`${API_NAME} JWT 토큰 직접 검증 시도`);
      const directSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jdubrjczdyqqtsppojgu.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { 
          auth: { 
            persistSession: false,
            autoRefreshToken: false
          } 
        }
      );
      
      // 직접 토큰으로 세션 설정
      const { data: userData, error: userError } = await directSupabase.auth.getUser(token);
      
      if (userError || !userData.user) {
        console.warn(`${API_NAME} ❌ 토큰 검증 실패:`, userError?.message);
        return { success: false, error: "토큰이 유효하지 않습니다." };
      }
      
      console.log(`${API_NAME} ✅ 토큰 검증 성공: ${userData.user.id}`);
      return { success: true, user: userData.user };
    } catch (error) {
      console.error(`${API_NAME} 토큰 검증 중 오류:`, error);
      return { success: false, error: "토큰 검증 중 오류 발생" };
    }
  } catch (error) {
    console.error(`${API_NAME} 세션 검증 중 예외 발생:`, error);
    return { success: false, error: "인증 검증 중 오류 발생" };
  }
}

/**
 * 채팅방 초기화 API
 * 주문번호로 채팅방을 초기화하고 참여자를 추가합니다.
 */
export async function POST(request: NextRequest) {
  console.log("---------");
  console.log("채팅방 초기화 시작");
  console.log("---------");

  try {
    // 1. 세션 검증
    const sessionResult = await validateSession(request);
    if (!sessionResult.success) {
      console.warn(`${API_NAME} ❌ 인증 실패:`, sessionResult.error);
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.', code: 'auth/unauthorized' },
        { status: 401 }
      );
    }

    const user = sessionResult.user;
    if (!user) {
      console.warn(`${API_NAME} ❌ 사용자 정보 없음`);
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.', code: 'auth/invalid-user' },
        { status: 401 }
      );
    }
    
    console.log(`${API_NAME} ✅ 인증 성공: 사용자 ID ${user.id}`);

    // 2. 요청 본문 파싱
    let reqBody;
    try {
      reqBody = await request.json();
    } catch (error) {
      console.error(`${API_NAME} 요청 본문 파싱 오류:`, error);
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400 }
      );
    }

    const { order_number } = reqBody;
    if (!order_number) {
      console.warn(`${API_NAME} 요청에 주문번호가 없음`);
      return NextResponse.json(
        { error: '주문번호가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`${API_NAME} 주문번호:`, order_number);

    // 3. 주문 정보로 채팅방 처리
    let result;
    // 개발 환경에서 테스트 토큰 사용 시 직접 처리
    if (sessionResult.devMode) {
      console.log(`${API_NAME} 개발 모드: 직접 클라이언트로 처리`);
      result = await handleOrderWithDirectClient(request);
    } else {
      // 일반 처리
      result = await handleOrder(request, user, adminSupabase);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`${API_NAME} 처리 중 최상위 오류:`, error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 개발 환경에서 직접 클라이언트를 사용해 주문 처리 (테스트용)
 */
async function handleOrderWithDirectClient(req: NextRequest) {
  try {
    const { order_number } = await req.json();
    console.log(`${API_NAME} 직접 클라이언트로 주문번호 처리:`, order_number);
    
    // 테스트 사용자 ID
    const testBuyerId = 'test-buyer-id';
    const testSellerId = 'test-seller-id';
    
    // 주문 데이터 조회 (또는 가상 데이터 생성)
    console.log(`${API_NAME} 주문번호로 조회:`, order_number);
    
    // 기존 채팅방 확인
    const { data: existingRoom, error: roomError } = await adminSupabase
      .from('rooms')
      .select('id, name')
      .eq('order_number', order_number)
      .single();
    
    if (roomError && roomError.code !== 'PGRST116') {
      console.error(`${API_NAME} 채팅방 조회 오류:`, roomError);
      return {
        error: '채팅방 정보를 조회하는 중 오류가 발생했습니다.',
        status: 500
      };
    }
    
    if (existingRoom) {
      console.log(`${API_NAME} 기존 채팅방 발견: ID=${existingRoom.id}`);
      return {
        room_id: existingRoom.id,
        room_name: existingRoom.name,
        message: '기존 채팅방이 사용됩니다.',
        status: 200
      };
    }
    
    // 새 채팅방 생성
    console.log(`${API_NAME} 새 채팅방 생성 시도`);
    const roomName = `주문 ${order_number} - 테스트 상품`;
    
    const { data: newRoom, error: createRoomError } = await adminSupabase
      .from('rooms')
      .insert([{
        name: roomName,
        order_number: order_number,
        last_message: '채팅이 시작되었습니다.',
        last_message_time: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (createRoomError || !newRoom) {
      console.error(`${API_NAME} 채팅방 생성 오류:`, createRoomError);
      return {
        error: '채팅방 생성에 실패했습니다.',
        status: 500
      };
    }
    
    // 참가자 추가
    console.log(`${API_NAME} 참가자 추가 시도`);
    const participantsData = [
      { room_id: newRoom.id, user_id: testBuyerId },
      { room_id: newRoom.id, user_id: testSellerId }
    ];
    
    const { error: participantError } = await adminSupabase
      .from('room_participants')
      .insert(participantsData);
    
    if (participantError) {
      console.error(`${API_NAME} 참가자 추가 오류:`, participantError);
    }
    
    console.log(`${API_NAME} 채팅방 생성 완료: ID=${newRoom.id}`);
    return {
      room_id: newRoom.id,
      room_name: newRoom.name,
      message: '새 채팅방이 생성되었습니다.',
      status: 201
    };
  } catch (error) {
    console.error(`${API_NAME} 직접 클라이언트 처리 오류:`, error);
    return {
      error: '주문 처리 중 오류가 발생했습니다.',
      status: 500
    };
  }
}

/**
 * 일반 주문 처리 로직
 */
async function handleOrder(req: NextRequest, user: any, supabase: any) {
  try {
    const { order_number } = await req.json();
    const userId = user.id;
    
    // order_number로 구매 정보 조회
    console.log(`${API_NAME} 주문번호로 조회:`, order_number);
    const { data: orderData, error: orderError } = await supabase
      .from('purchases')
      .select('id, order_number, buyer_id, seller_id, product_name')
      .eq('order_number', order_number)
      .single();
    
    if (orderError || !orderData) {
      console.error(`${API_NAME} 주문 정보 조회 실패:`, orderError);
      return {
        error: '주문 정보를 찾을 수 없습니다.',
        status: 404
      };
    }
    
    const { id: purchaseId, buyer_id, seller_id, product_name } = orderData;
    
    // 사용자 권한 확인 (구매자 또는 판매자여야 함)
    console.log(`${API_NAME} 사용자 권한 확인 - 구매자:${buyer_id}, 판매자:${seller_id}, 현재 사용자:${userId}`);
    
    const isDevEnv = process.env.NODE_ENV === 'development';
    if (!isDevEnv && buyer_id !== userId && seller_id !== userId) {
      console.warn(`${API_NAME} 권한 없음: 사용자(${userId})는 해당 주문의 구매자나 판매자가 아님`);
      return {
        error: '이 주문에 대한 권한이 없습니다.',
        status: 403
      };
    }
    
    // 채팅방 이름 설정
    const roomName = `주문 ${order_number} - ${product_name}`;
    
    // 기존 채팅방 확인
    const { data: existingRoom, error: roomError } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('purchase_id', purchaseId)
      .single();
    
    if (roomError && roomError.code !== 'PGRST116') {
      console.error(`${API_NAME} 채팅방 조회 오류:`, roomError);
      return {
        error: '채팅방 정보를 조회하는 중 오류가 발생했습니다.',
        status: 500
      };
    }
    
    if (existingRoom) {
      console.log(`${API_NAME} 기존 채팅방 발견: ID=${existingRoom.id}`);
      return {
        room_id: existingRoom.id,
        room_name: existingRoom.name,
        message: '기존 채팅방이 사용됩니다.',
        status: 200
      };
    }
    
    // 새 채팅방 생성
    console.log(`${API_NAME} 새 채팅방 생성 시도 - 구매ID:${purchaseId}`);
    
    const { data: newRoom, error: createRoomError } = await supabase
      .from('rooms')
      .insert([{
        name: roomName,
        purchase_id: purchaseId,
        last_message: '채팅이 시작되었습니다.',
        last_message_time: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (createRoomError || !newRoom) {
      console.error(`${API_NAME} 채팅방 생성 오류:`, createRoomError);
      return {
        error: '채팅방 생성에 실패했습니다.',
        status: 500
      };
    }
    
    // 참가자 추가
    console.log(`${API_NAME} 참가자 추가 시도`);
    const participantsData = [
      { room_id: newRoom.id, user_id: buyer_id },
      { room_id: newRoom.id, user_id: seller_id }
    ];
    
    const { error: participantError } = await supabase
      .from('room_participants')
      .insert(participantsData);
    
    if (participantError) {
      console.error(`${API_NAME} 참가자 추가 오류:`, participantError);
    }
    
    console.log(`${API_NAME} 채팅방 생성 완료: ID=${newRoom.id}`);
    return {
      room_id: newRoom.id,
      room_name: newRoom.name,
      message: '새 채팅방이 생성되었습니다.',
      status: 201
    };
  } catch (error) {
    console.error(`${API_NAME} 주문 처리 오류:`, error);
    return {
      error: '주문 처리 중 오류가 발생했습니다.',
      status: 500
    };
  }
} 