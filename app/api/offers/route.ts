import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { validateRequestToken } from '@/lib/auth';

const adminSupabase = createAdminClient();

// CORS 헤더
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// CORS 사전 요청 처리
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

// GET: 활성화된 티켓 요청 목록 조회
export async function GET(req: Request) {
  try {
    console.log('[Offers API] GET 요청 시작');

    const { data: offers, error } = await adminSupabase
      .from('offers')
      .select(`
        *,
        posts (
          id,
          title,
          event_name,
          event_date,
          event_venue,
          category
        ),
        users!offerer_id (
          id,
          name,
          email
        )
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Offers API] 조회 오류:', error);
      return NextResponse.json({ 
        error: '티켓 요청을 불러올 수 없습니다.' 
      }, { status: 500, headers: CORS_HEADERS });
    }

    console.log(`[Offers API] ${offers?.length || 0}개의 요청 조회 성공`);

    return NextResponse.json({ 
      success: true, 
      offers: offers || [] 
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error('[Offers API] GET 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500, headers: CORS_HEADERS });
  }
}

// POST: 새 티켓 요청 생성
export async function POST(req: Request) {
  try {
    console.log('[Offers API] POST 요청 시작');

    // 인증 확인
    const authResult = await validateRequestToken(req);
    if (!authResult.authenticated) {
      return NextResponse.json({ 
        error: '로그인이 필요합니다.' 
      }, { status: 401, headers: CORS_HEADERS });
    }

    const body = await req.json();
    const { 
      concertTitle, 
      concertDate, 
      concertVenue, 
      quantity, 
      maxPrice, 
      description 
    } = body;

    console.log('[Offers API] 요청 데이터:', {
      concertTitle, concertDate, concertVenue, quantity, maxPrice
    });

    // 유효성 검사
    if (!concertTitle || !concertDate || !maxPrice || !description) {
      return NextResponse.json({ 
        error: '필수 정보가 누락되었습니다.' 
      }, { status: 400, headers: CORS_HEADERS });
    }

    if (maxPrice < 1000) {
      return NextResponse.json({ 
        error: '가격은 최소 1,000원 이상이어야 합니다.' 
      }, { status: 400, headers: CORS_HEADERS });
    }

    // offers 테이블에 데이터 삽입
    const offerData = {
      offerer_id: authResult.userId,
      price: parseInt(maxPrice),
      original_price: parseInt(maxPrice),
      message: `${concertTitle} - ${description}${concertVenue ? ` (장소: ${concertVenue})` : ''}`,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7일 후 만료
      created_at: new Date().toISOString()
    };

    const { data: newOffer, error: insertError } = await adminSupabase
      .from('offers')
      .insert(offerData)
      .select()
      .single();

    if (insertError) {
      console.error('[Offers API] 삽입 오류:', insertError);
      return NextResponse.json({ 
        error: '티켓 요청 등록에 실패했습니다.' 
      }, { status: 500, headers: CORS_HEADERS });
    }

    console.log('[Offers API] 새 요청 생성 성공:', newOffer.id);

    return NextResponse.json({ 
      success: true, 
      message: '티켓 요청이 등록되었습니다!',
      offer: newOffer 
    }, { status: 201, headers: CORS_HEADERS });

  } catch (error) {
    console.error('[Offers API] POST 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500, headers: CORS_HEADERS });
  }
} 