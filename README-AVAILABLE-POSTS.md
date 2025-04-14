# Supabase 구매 가능 티켓 필터링 구현 가이드

이 문서는 Supabase 뷰를 사용하여 구매 가능한 티켓만 효율적으로 필터링하는 시스템의 구현 방법을 설명합니다.

## 개요

구현된 시스템은 `available_posts`라는 Supabase 데이터베이스 뷰를 사용하여 이미 구매된 상품을 자동으로 필터링합니다. 이 방식의 주요 장점은 다음과 같습니다:

- **단순한 쿼리:** 프론트엔드에서는 한 줄의 쿼리로 항상 구매 가능한 상품만 가져올 수 있습니다.
- **성능 최적화:** 데이터베이스 레벨에서 필터링이 이루어져 성능이 향상됩니다.
- **자동 동기화:** 새로운 구매가 이루어지면 뷰에서 자동으로 해당 상품이 제외됩니다.

## 구현 단계

### 1. Supabase SQL 스크립트 실행

Supabase SQL 에디터에서 다음 스크립트를 실행하여 `available_posts` 뷰를 생성합니다:

```sql
-- 구매 가능한 게시물만 필터링하는 뷰 생성
-- 이미 구매된 상품(purchases 테이블에 존재하는 post_id)은 제외됩니다.

-- 기존 뷰가 있으면 삭제 후 재생성
DROP VIEW IF EXISTS available_posts;

-- 새 뷰 생성
CREATE OR REPLACE VIEW available_posts AS
SELECT p.*
FROM posts p
LEFT JOIN purchases pur ON p.id = pur.post_id
WHERE pur.id IS NULL -- 구매 내역이 없는 상품
  AND p.status = 'ACTIVE' -- 활성 상태인 상품만
  AND (p.is_deleted IS NULL OR p.is_deleted = false); -- 삭제되지 않은 상품만

COMMENT ON VIEW available_posts IS '구매 가능한 판매 중인 티켓만 보여주는 뷰. 이미 구매된 상품은 제외됨.';
```

### 2. API 라우트 생성

`/app/api/available-posts/route.ts` 파일을 생성하여 구매 가능 티켓을 제공하는 API를 만듭니다:

```typescript
import { NextResponse, NextRequest } from "next/server";
import { adminSupabase, supabase } from "@/lib/supabase";

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

/**
 * 구매 가능한 상품 목록을 제공하는 API
 * available_posts 뷰를 활용하여 이미 구매된 상품은 자동으로 제외됨
 */
export async function GET(req: NextRequest) {
  try {
    // URL 쿼리 파라미터 추출
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const category = url.searchParams.get('category');
    const searchQuery = url.searchParams.get('search');

    console.log(`[Available Posts API] 요청 받음: page=${page}, limit=${limit}, category=${category}, search=${searchQuery}`);

    // 쿼리 시작
    // @ts-ignore - available_posts는 뷰이기 때문에 타입 정의가 없으므로 타입 검사 무시
    let query = adminSupabase
      .from('available_posts')
      .select('*', { count: 'exact' }) as any;

    // 카테고리 필터링
    if (category) {
      query = query.eq('category', category);
    }

    // 검색어 필터링
    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    // 페이지네이션 적용
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 최종 쿼리 실행
    const { data: posts, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[Available Posts API] 데이터 조회 오류:', error);
      return addCorsHeaders(NextResponse.json(
        { success: false, message: '구매 가능한 상품 목록을 조회하는 중 오류가 발생했습니다.' },
        { status: 500 }
      ));
    }

    // 응답 데이터 구성
    return addCorsHeaders(NextResponse.json({
      success: true,
      posts: posts || [],
      pagination: {
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page,
        pageSize: limit,
        hasMore: (from + (posts?.length || 0)) < (count || 0)
      }
    }));
  } catch (error) {
    console.error('[Available Posts API] 처리 중 오류 발생:', error);
    return addCorsHeaders(NextResponse.json(
      { success: false, message: '요청을 처리하는 중 오류가 발생했습니다.' },
      { status: 500 }
    ));
  }
}
```

### 3. 티켓 목록 페이지 업데이트

`app/tickets/page.tsx` 파일에 구매 가능한 티켓을 표시하는 기능을 추가합니다:

```typescript
// 구매 가능한 티켓 가져오기
const fetchAvailableTickets = async () => {
  try {
    console.log("구매 가능한 티켓 가져오기 시도...")
    const response = await fetch("/api/available-posts")
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log("구매 가능한 티켓 데이터:", data)
    
    if (!data.posts || !Array.isArray(data.posts)) {
      throw new Error("API 응답 형식이 올바르지 않습니다.")
    }
    
    // API 응답 데이터를 UI에 맞는 형식으로 변환
    const formattedTickets = data.posts.map((post: any) => ({
      id: post.id,
      title: post.title || post.event_name || "제목 없음",
      artist: post.event_name || post.title || "아티스트 정보 없음",
      date: post.event_date || new Date(post.created_at).toLocaleDateString(),
      time: "19:00", // 기본값
      venue: post.event_venue || "장소 정보 없음",
      price: post.ticket_price 
        ? `${Number(post.ticket_price).toLocaleString()}원` 
        : "가격 정보 없음",
      image: post.image_url || "/placeholder.svg",
      status: "판매중"
    }));
    
    setAvailableTickets(formattedTickets)
  } catch (error) {
    console.error("구매 가능한 티켓 가져오기 오류:", error)
    // 오류 발생 시 처리
    setAvailableTickets([])
  }
}
```

## 고급 활용 방법

### 1. 다양한 조건으로 필터링

Supabase 뷰 정의에서 조건을 추가하여 더 복잡한 필터링을 구현할 수 있습니다:

```sql
CREATE OR REPLACE VIEW available_concert_tickets AS
SELECT p.*
FROM posts p
LEFT JOIN purchases pur ON p.id = pur.post_id
WHERE pur.id IS NULL
  AND p.status = 'ACTIVE'
  AND p.category = 'CONCERT'  -- 콘서트 카테고리만 필터링
  AND p.event_date > CURRENT_DATE;  -- 미래 날짜 이벤트만
```

### 2. 추가 정보를 포함한 확장 뷰

관련 정보를 JOIN하여 더 풍부한 데이터를 제공하는 뷰를 생성할 수 있습니다:

```sql
CREATE OR REPLACE VIEW detailed_available_posts AS
SELECT 
  p.*,
  u.name as seller_name,
  u.profile_image as seller_image,
  COUNT(l.id) as likes_count
FROM posts p
LEFT JOIN purchases pur ON p.id = pur.post_id
LEFT JOIN users u ON p.author_id = u.id
LEFT JOIN likes l ON p.id = l.post_id
WHERE pur.id IS NULL
  AND p.status = 'ACTIVE'
  AND (p.is_deleted IS NULL OR p.is_deleted = false)
GROUP BY p.id, u.id;
```

## 정리

이 구현을 통해 다음과 같은 이점을 얻을 수 있습니다:

1. **코드 간소화**: 프론트엔드에서 복잡한 필터링 로직이 필요 없음
2. **성능 향상**: 데이터베이스 수준에서 최적화된 필터링 수행
3. **실시간 반영**: 구매 발생 시 자동으로 뷰에서 제외되어 항상 최신 정보 유지
4. **확장성**: 다양한 조건으로 필터링하거나 추가 정보를 포함하도록 쉽게 확장 가능

이 구현으로 사용자는 항상 구매 가능한 티켓만 볼 수 있어 더 나은 사용자 경험을 제공합니다. 