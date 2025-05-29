import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { validateRequestToken } from '@/lib/auth';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

    // 인증 확인 - Supabase 공식 방식 우선 사용
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
        // 1. Supabase 공식 인증 헬퍼 사용
        const supabase = createRouteHandlerClient({ cookies });
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (user && !error) {
          userId = user.id;
          userEmail = user.email;
          console.log('[Offers API] Supabase 인증 성공:', userEmail);
        } else {
          console.log('[Offers API] Supabase 인증 실패:', error);
        }
      } catch (supabaseError) {
        console.log('[Offers API] Supabase 인증 오류:', supabaseError);
      }

      // 2. Supabase 인증 실패 시 대체 방법들
      if (!userId) {
        try {
          // validateRequestToken 시도 (JWT)
          const authResult = await validateRequestToken(req);
          if (authResult.authenticated) {
            userId = authResult.userId;
            console.log('[Offers API] JWT 인증 성공:', userId);
          }
        } catch (authError) {
          console.log('[Offers API] JWT 인증 실패:', authError);
        }
      }

      // 3. 쿠키에서 직접 확인 (JWT는 JSON 파싱하지 않음)
      if (!userId) {
        try {
          const cookieStore = cookies();
          
          console.log('[Offers API] 사용 가능한 쿠키들:');
          cookieStore.getAll().forEach(cookie => {
            console.log(`[Offers API] - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
          });
          
          // user 쿠키에서 직접 사용자 정보 확인 (가장 확실한 방법)
          const userCookie = cookieStore.get('user');
          if (userCookie?.value) {
            console.log('[Offers API] user 쿠키 발견');
            try {
              const userData = JSON.parse(userCookie.value);
              if (userData.id) {
                userId = userData.id;
                userEmail = userData.email;
                console.log('[Offers API] user 쿠키 인증 성공:', userEmail);
              }
            } catch (parseError) {
              console.log('[Offers API] user 쿠키 파싱 실패:', parseError);
            }
          }
          
          // auth-token (JWT)은 JSON 파싱하지 않고 그대로 사용
          if (!userId) {
            const authTokenCookie = cookieStore.get('auth-token');
            if (authTokenCookie?.value) {
              console.log('[Offers API] auth-token 쿠키 발견 (JWT)');
              // JWT 토큰은 JSON이 아니므로 파싱하지 않음
              // 대신 JWT 디코딩이 필요하면 별도 라이브러리 사용
              const jwtToken = authTokenCookie.value;
              console.log('[Offers API] JWT 토큰 길이:', jwtToken.length);
              
              // 간단한 JWT 페이로드 디코딩 (검증 없이)
              try {
                const payload = JSON.parse(atob(jwtToken.split('.')[1]));
                if (payload.userId) {
                  userId = payload.userId;
                  userEmail = payload.email;
                  console.log('[Offers API] JWT 페이로드 디코딩 성공:', userEmail);
                }
              } catch (jwtError) {
                console.log('[Offers API] JWT 디코딩 실패:', jwtError);
              }
            }
          }
          
          // Supabase 세션 쿠키들 확인 (배열 형태)
          if (!userId) {
            const supabaseCookieNames = [
              'sb-jdubrjczdyqqtsppojgu-auth-token',
              'sb-auth-token',
              'supabase-auth-token'
            ];
            
            for (const cookieName of supabaseCookieNames) {
              const authCookie = cookieStore.get(cookieName);
              if (authCookie?.value) {
                console.log(`[Offers API] ${cookieName} 쿠키 발견`);
                try {
                  // Supabase 쿠키는 보통 배열 형태 ["token", "refresh_token", ...]
                  const sessionArray = JSON.parse(authCookie.value);
                  if (Array.isArray(sessionArray) && sessionArray[0]) {
                    const accessToken = sessionArray[0];
                    console.log('[Offers API] Supabase 액세스 토큰 발견');
                    
                    // 액세스 토큰으로 사용자 정보 가져오기
                    const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
                    if (tokenPayload.sub) {
                      userId = tokenPayload.sub;
                      userEmail = tokenPayload.email;
                      console.log('[Offers API] Supabase 토큰 디코딩 성공:', userEmail);
                      break;
                    }
                  }
                } catch (parseError) {
                  console.log(`[Offers API] ${cookieName} 파싱 실패:`, parseError);
                }
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
      post_id: null, // 티켓 요청이므로 post_id는 null
      offerer_id: userId,
      seller_id: null, // 아직 판매자가 정해지지 않았으므로 null
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
      console.error('[Offers API] 🔥 Supabase 삽입 오류 상세:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        insertData: offerData
      });
      return NextResponse.json({ 
        error: '티켓 요청 등록에 실패했습니다.',
        details: insertError.message 
      }, { status: 500, headers: CORS_HEADERS });
    }

    console.log('[Offers API] 새 요청 생성 성공:', newOffer.id);

    return NextResponse.json({ 
      success: true, 
      message: '티켓 요청이 등록되었습니다!',
      offer: newOffer 
    }, { status: 201, headers: CORS_HEADERS });

  } catch (error) {
    console.error('[Offers API] 🔥 POST 요청 처리 중 치명적 오류 발생:', {
      error: error,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : '스택 정보 없음',
      name: error instanceof Error ? error.name : '이름 없음'
    });
    return NextResponse.json({ 
      error: '서버 내부 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500, headers: CORS_HEADERS });
  }
} 