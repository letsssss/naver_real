import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { validateRequestToken } from '@/lib/auth';
import { getSupabaseClient } from '@/lib/supabase'; // 싱글톤 패턴 사용
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // 제거
// import { cookies } from 'next/headers'; // 제거

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

    // ✅ 새로운 구조: posts와 offers를 조인해서 조회
    const { data: offers, error } = await adminSupabase
      .from('offers')
      .select(`
        *,
        posts!inner (
          id,
          title,
          content,
          category,
          event_name,
          event_date,
          event_venue,
          ticket_price,
          created_at,
          author_id
        ),
        users!offerer_id (
          id,
          name,
          email
        )
      `)
      .eq('status', 'PENDING')
      .is('seller_id', null) // 티켓 요청만 조회 (판매자가 아직 정해지지 않은 것)
      .eq('posts.category', 'TICKET_REQUEST') // posts의 카테고리가 TICKET_REQUEST인 것만
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Offers API] 조회 오류:', error);
      return NextResponse.json({ 
        error: '티켓 요청을 불러올 수 없습니다.' 
      }, { status: 500, headers: CORS_HEADERS });
    }

    // ✅ 새로운 응답 데이터 구성: posts 데이터를 메인으로 사용
    const ticketRequests = offers?.map(offer => {
      const post = offer.posts;
      let messageData: any = {};
      
      // message 필드의 JSON 파싱 (실패해도 계속 진행)
      try {
        messageData = JSON.parse(offer.message);
      } catch (parseError) {
        console.error('[Offers API] 메시지 파싱 오류:', parseError);
      }
      
      return {
        id: offer.id,
        postId: post.id, // ✅ post ID 추가
        // posts 테이블의 데이터를 메인으로 사용
        title: post.title,
        concertTitle: post.title, // 호환성을 위해 concertTitle도 제공
        eventName: post.event_name,
        eventDate: post.event_date,
        eventVenue: post.event_venue,
        description: post.content,
        ticketPrice: post.ticket_price,
        // offers 테이블의 데이터
        maxPrice: offer.price,
        quantity: messageData.quantity || 1,
        // 사용자 정보
        user: offer.users,
        // 상태 정보
        status: offer.status,
        expiresAt: offer.expires_at,
        createdAt: offer.created_at,
        // 추가 메타데이터
        category: post.category,
        authorId: post.author_id
      };
    }) || [];

    console.log(`[Offers API] ${ticketRequests.length}개의 티켓 요청 조회 성공`);

    return NextResponse.json({ 
      success: true, 
      requests: ticketRequests 
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

    // 1. Supabase 인증으로 사용자 확인
    // 서버 사이드에서는 adminSupabase를 사용하고, Authorization 헤더에서 토큰을 추출
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Offers API] Authorization 헤더가 없습니다');
      return NextResponse.json({ 
        error: '로그인이 필요합니다.' 
      }, { status: 401, headers: CORS_HEADERS });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 토큰으로 사용자 정보 확인
    const { data: { user }, error: sessionError } = await adminSupabase.auth.getUser(token);

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

    const { data: postData, error: postError } = await adminSupabase
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
    const { data: offerData, error: offerError } = await adminSupabase
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