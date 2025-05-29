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
    console.log('[Offers API] Request headers:', Object.fromEntries(req.headers.entries()));

    // 인증 확인 - 더 자세한 디버깅 추가
    let userId = null;
    let userEmail = null;

    // 개발 환경에서는 우선 허용하고 나중에 검증
    if (process.env.NODE_ENV === 'development') {
      console.log('[Offers API] 개발 환경 감지 - 기본 사용자 허용');
      userId = '123e4567-e89b-12d3-a456-426614174000';
      userEmail = 'dev@example.com';
    } else {
      // 프로덕션에서만 엄격한 인증 적용
      try {
        // 1. validateRequestToken 시도
        const authResult = await validateRequestToken(req);
        if (authResult.authenticated) {
          userId = authResult.userId;
          console.log('[Offers API] JWT 인증 성공:', userId);
        }
      } catch (authError) {
        console.log('[Offers API] JWT 인증 실패:', authError);
      }

      // 2. JWT 인증 실패 시 쿠키에서 직접 확인
      if (!userId) {
        try {
          const { cookies } = await import('next/headers');
          const cookieStore = cookies();
          
          console.log('[Offers API] 사용 가능한 쿠키들:');
          cookieStore.getAll().forEach(cookie => {
            console.log(`[Offers API] - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
          });
          
          // 여러 가능한 Supabase 쿠키 이름 시도
          const possibleCookieNames = [
            'sb-jdubrjczdyqqtsppojgu-auth-token',
            'sb-auth-token',
            'supabase-auth-token',
            'auth-token'
          ];
          
          for (const cookieName of possibleCookieNames) {
            const authCookie = cookieStore.get(cookieName);
            if (authCookie?.value) {
              console.log(`[Offers API] ${cookieName} 쿠키 발견`);
              try {
                const sessionData = JSON.parse(authCookie.value);
                if (sessionData.user?.id) {
                  userId = sessionData.user.id;
                  userEmail = sessionData.user.email;
                  console.log('[Offers API] 쿠키 인증 성공:', userEmail);
                  break;
                } else if (sessionData.access_token) {
                  // access_token만 있는 경우
                  console.log('[Offers API] access_token 발견, 사용자 정보 추출 시도');
                  // 여기서 추가 로직 필요시 구현
                }
              } catch (parseError) {
                console.log(`[Offers API] ${cookieName} 파싱 실패:`, parseError);
              }
            }
          }
        } catch (cookieError) {
          console.log('[Offers API] 쿠키 인증 실패:', cookieError);
        }
      }

      // 최종 인증 실패 시에만 오류 반환
      if (!userId) {
        console.log('[Offers API] 프로덕션 환경에서 인증 실패');
        return NextResponse.json({ 
          error: '로그인이 필요합니다.' 
        }, { status: 401, headers: CORS_HEADERS });
      }
    }

    console.log('[Offers API] 최종 사용자 ID:', userId);

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
      concertTitle, concertDate, concertVenue, quantity, maxPrice, userId
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
      offerer_id: userId,
      price: parseInt(maxPrice),
      original_price: parseInt(maxPrice),
      message: `${concertTitle} - ${description}${concertVenue ? ` (장소: ${concertVenue})` : ''}`,
      status: 'PENDING',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7일 후 만료
      created_at: new Date().toISOString()
    };

    console.log('[Offers API] 삽입할 데이터:', offerData);

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