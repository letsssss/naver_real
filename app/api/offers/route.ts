import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { validateRequestToken } from '@/lib/auth';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase.types';

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
export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, '', ...options, maxAge: 0 });
        },
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('*')
      .eq('user_id', user.id);

    if (offersError) {
      return NextResponse.json({ error: '제안 목록을 가져오는데 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(offers);
  } catch (error) {
    console.error('제안 목록 조회 중 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST: 새 티켓 요청 생성
export async function POST(req: Request) {
  try {
    console.log('[Offers API] POST 요청 시작');

    // 1. Supabase 인증으로 사용자 확인
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (!user || sessionError) {
      console.error('[Offers API] 인증 실패:', sessionError);
      return NextResponse.json({ 
        error: '로그인이 필요합니다.' 
      }, { status: 401, headers: CORS_HEADERS });
    }

    // 2. 요청 데이터 파싱 및 검증
    const { 
      concertTitle, 
      concertDate, 
      concertVenue, 
      quantity, 
      maxPrice, 
      sections,  // ✅ sections 데이터 추가
      description 
    } = await req.json();

    console.log('[Offers API] 요청 데이터:', {
      concertTitle, concertDate, concertVenue, quantity, maxPrice, sections,
      userId: user.id
    });

    // 3. 필수 필드 검증
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

    if (!quantity || isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
      return NextResponse.json({ 
        error: '수량은 1개 이상이어야 합니다.' 
      }, { status: 400, headers: CORS_HEADERS });
    }

    // ✅ sections 검증 추가
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ 
        error: '최소 하나의 구역 정보가 필요합니다.' 
      }, { status: 400, headers: CORS_HEADERS });
    }

    // 각 구역의 유효성 검증
    const invalidSection = sections.find(section => 
      !section.name || !section.price || parseInt(section.price) < 1000
    );
    if (invalidSection) {
      return NextResponse.json({ 
        error: '모든 구역의 이름과 가격을 올바르게 입력해주세요 (최소 1,000원).' 
      }, { status: 400, headers: CORS_HEADERS });
    }

    // 4. posts 테이블에 글 등록
    console.log('[Offers API] 1단계: posts 테이블에 티켓 요청 글 생성');
    
    // ✅ 구조화된 content 데이터 생성 (sections 포함)
    const structuredContent = {
      description: description,
      sections: sections.map(section => ({
        id: section.id,
        label: section.name,
        price: parseInt(section.price),
        available: true
      })),
      venue: concertVenue || null,
      date: concertDate,
      requestType: 'TICKET_REQUEST',
      quantity: parseInt(quantity)
    };

    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert({
        title: concertTitle,
        content: JSON.stringify(structuredContent),  // ✅ 구조화된 JSON으로 저장
        category: 'TICKET_REQUEST',
        status: 'ACTIVE',
        author_id: user.id,
        event_name: concertTitle,
        event_date: concertDate,
        event_venue: concertVenue || null,
        ticket_price: parseInt(maxPrice),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (postError || !postData) {
      console.error('[Offers API] ❌ 게시물 등록 실패:', {
        error: postError,
        userId: user.id,
        concertTitle
      });
      return NextResponse.json({ 
        error: '게시물 등록에 실패했습니다.',
        details: postError?.message
      }, { status: 500, headers: CORS_HEADERS });
    }

    console.log('[Offers API] ✅ 게시물 등록 성공:', postData.id);

    // 5. offers 테이블에 등록
    console.log('[Offers API] 2단계: offers 테이블에 티켓 요청 등록');
    const { data: offerData, error: offerError } = await supabase
      .from('offers')
      .insert({
        post_id: postData.id,
        offerer_id: user.id,
        seller_id: null,
        price: parseInt(maxPrice),
        original_price: parseInt(maxPrice),
        message: JSON.stringify({
          type: 'TICKET_REQUEST',
          concertTitle: concertTitle?.slice(0, 100) || '',
          concertDate,
          concertVenue: concertVenue?.slice(0, 100) || null,
          quantity: parseInt(quantity),
          sections: sections,  // ✅ sections 정보 추가
          description: description?.slice(0, 500) || '',
          requestedAt: new Date().toISOString()
        }),
        status: 'PENDING',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (offerError) {
      console.error('[Offers API] ❌ 티켓 요청 등록 실패:', {
        error: offerError,
        postId: postData.id,
        userId: user.id
      });
      return NextResponse.json({ 
        error: '티켓 요청 등록에 실패했습니다.',
        details: offerError.message
      }, { status: 500, headers: CORS_HEADERS });
    }

    console.log('[Offers API] ✅ 티켓 요청 등록 성공:', {
      offerId: offerData?.id,
      postId: postData.id
    });

    return NextResponse.json({ 
      success: true,
      message: '티켓 요청이 등록되었습니다!',
      postId: postData.id,
      offerId: offerData?.id
    }, { status: 201, headers: CORS_HEADERS });

  } catch (error) {
    console.error('[Offers API] 🔥 치명적 오류:', error);
    return NextResponse.json({ 
      error: '서버 내부 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500, headers: CORS_HEADERS });
  }
} 