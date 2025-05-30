import { NextResponse, NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { Database } from "@/types/supabase.types";

// 사용자 데이터 타입 정의
type UserData = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  [key: string]: any; // 추가 필드를 위한 인덱스 시그니처
};

// BigInt를 문자열로 변환하는 함수
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }
  
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertBigIntToString(obj[key]);
    }
    return newObj;
  }
  
  return obj;
}

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

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

// Supabase에서 인증된 사용자 정보 가져오기
async function getAuthUser(request: NextRequest) {
  try {
    console.log("\n===== 판매자 구매 API - 사용자 인증 시작 =====");
    console.log("요청 URL:", request.url);
    
    // Admin 클라이언트 사용
    const client = createAdminClient();
    
    // 모든 쿠키 정보 로깅
    console.log("요청에서 받은 모든 쿠키:");
    const allCookies = request.cookies.getAll();
    console.log(`총 ${allCookies.length}개의 쿠키 발견`);
    allCookies.forEach(cookie => {
      console.log(` - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
    });
    
    // 1. 먼저 Authorization 헤더 확인
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log("Authorization 헤더에서 토큰 발견");
      
      try {
        const { data: { user }, error } = await client.auth.getUser(token);
        
        if (!error && user) {
          console.log("Authorization 헤더의 토큰으로 사용자 인증 성공:", user.id);
          
          // 사용자 정보 가져오기
          const { data: userData, error: userError } = await client
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (!userError && userData) {
            // UserData 타입으로 변환
            const userDataTyped = userData as UserData;
            
            return {
              id: user.id,
              email: user.email || '',
              name: userDataTyped?.name || user.user_metadata?.name || "",
              role: userDataTyped?.role || user.user_metadata?.role || "USER"
            };
          }
        }
      } catch (tokenError) {
        console.error("토큰 검증 오류:", tokenError);
      }
    }
    
    // 2. Supabase 세션 쿠키 찾기
    const supabaseSessionCookie = request.cookies.get('sb-jdubrjczdyqqtsppojgu-auth-token');
    
    if (supabaseSessionCookie) {
      console.log("Supabase 세션 쿠키 발견:", supabaseSessionCookie.name);
      
      // 쿠키에서 직접 세션 정보 가져오기
      try {
        const cookieValue = supabaseSessionCookie.value;
        
        // URL 디코딩 및 JSON 파싱 전 로깅
        console.log("쿠키 값 (처음 30자):", cookieValue.substring(0, 30));
        
        // 먼저 JWT 토큰인지 확인 (eyJ로 시작)
        if (cookieValue.startsWith('eyJ')) {
          console.log("쿠키 값이 JWT 토큰 형식입니다");
          
          // 토큰으로 직접 사용자 인증
          try {
            const { data: { user }, error: sessionError } = await client.auth.getUser(cookieValue);
            
            if (!sessionError && user) {
              console.log("JWT 토큰으로 인증된 사용자 ID:", user.id);
              
              // 사용자 정보 가져오기
              const { data: userData, error: userError } = await client
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();
              
              if (!userError && userData) {
                // UserData 타입으로 변환
                const userDataTyped = userData as UserData;
                
                return {
                  id: user.id,
                  email: user.email || '',
                  name: userDataTyped?.name || user.user_metadata?.name || "",
                  role: userDataTyped?.role || user.user_metadata?.role || "USER"
                };
              }
            }
          } catch (jwtError) {
            console.error("JWT 토큰 검증 오류:", jwtError);
          }
        } else {
          // JSON 파싱 시도
          let sessionData;
          try {
            sessionData = JSON.parse(decodeURIComponent(cookieValue));
          } catch (parseError) {
            console.error("세션 데이터 파싱 실패:", parseError);
            
            // 다른 방법으로 다시 시도
            try {
              // URI 디코딩 없이 시도
              sessionData = JSON.parse(cookieValue);
              console.log("URI 디코딩 없이 파싱 성공");
            } catch (secondError) {
              console.error("두 번째 파싱 시도도 실패:", secondError);
              // 계속 다른 인증 방법 시도
            }
          }
          
          if (sessionData && sessionData.access_token) {
            console.log("세션 데이터에서 액세스 토큰 발견");
            
            // 세션 객체 생성
            const { data: { user }, error: sessionError } = await client.auth.getUser(
              sessionData.access_token
            );
            
            if (!sessionError && user) {
              console.log("인증된 사용자 ID:", user.id);
              
              // 사용자 정보 가져오기
              const { data: userData, error: userError } = await client
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();
              
              if (!userError && userData) {
                // UserData 타입으로 변환
                const userDataTyped = userData as UserData;
                
                return {
                  id: user.id,
                  email: user.email || '',
                  name: userDataTyped?.name || user.user_metadata?.name || "",
                  role: userDataTyped?.role || user.user_metadata?.role || "USER"
                };
              }
            }
          }
        }
      } catch (parseError) {
        console.error("세션 쿠키 파싱 오류:", parseError);
      }
    } else {
      console.log("Supabase 세션 쿠키를 찾을 수 없음");
    }
    
    // 3. access_token 쿠키 확인
    const accessTokenCookie = request.cookies.get('access_token');
    if (accessTokenCookie) {
      console.log("액세스 토큰 쿠키 발견");
      
      try {
        const token = accessTokenCookie.value;
        const { data: { user }, error } = await client.auth.getUser(token);
        
        if (!error && user) {
          console.log("액세스 토큰 쿠키로 사용자 인증 성공:", user.id);
          
          // 사용자 정보 가져오기
          const { data: userData, error: userError } = await client
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (!userError && userData) {
            // UserData 타입으로 변환
            const userDataTyped = userData as UserData;
            
            return {
              id: user.id,
              email: user.email || '',
              name: userDataTyped?.name || user.user_metadata?.name || "",
              role: userDataTyped?.role || user.user_metadata?.role || "USER"
            };
          }
        }
      } catch (tokenError) {
        console.error("액세스 토큰 쿠키 검증 오류:", tokenError);
      }
    }
    
    // 3-1. auth-token 쿠키 확인
    const authTokenCookie = request.cookies.get('auth-token');
    if (authTokenCookie) {
      console.log("auth-token 쿠키 발견");
      
      try {
        const token = authTokenCookie.value;
        const { data: { user }, error } = await client.auth.getUser(token);
        
        if (!error && user) {
          console.log("auth-token 쿠키로 사용자 인증 성공:", user.id);
          
          // 사용자 정보 가져오기
          const { data: userData, error: userError } = await client
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (!userError && userData) {
            // UserData 타입으로 변환
            const userDataTyped = userData as UserData;
            
            return {
              id: user.id,
              email: user.email || '',
              name: userDataTyped?.name || user.user_metadata?.name || "",
              role: userDataTyped?.role || user.user_metadata?.role || "USER"
            };
          }
        }
      } catch (tokenError) {
        console.error("auth-token 쿠키 검증 오류:", tokenError);
      }
    }
    
    // 4. 사용자 ID를 쿼리 파라미터로 받은 경우 (개발 환경에서만 허용)
    if (process.env.NODE_ENV === 'development') {
      // URL 객체로 파싱하여 더 안정적으로 쿼리 파라미터 추출
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      console.log("개발 환경 인증 검사 - URL:", url.toString());
      console.log("개발 환경 인증 검사 - userId 파라미터:", userId);
      
      if (userId && userId.length > 10) {  // 유효한 ID 형식인지 간단히 확인
        console.log("쿼리 파라미터에서 유효한 사용자 ID 발견:", userId);
        
        try {
          // 개발 환경에서는 사용자 ID가 존재하면 바로 인증 성공으로 처리
          // 데이터베이스 조회 대신 직접 사용자 정보 생성
          return {
            id: userId,
            email: 'dev-user@example.com',
            name: '개발 테스트 사용자',
            role: 'USER'
          };
        } catch (error) {
          console.error("개발 환경 인증 처리 중 오류:", error);
        }
      }
    }
    
    // 5. Supabase 세션 직접 확인 (마지막 수단)
    console.log("5. Supabase 직접 세션 확인 시도...");
    try {
      const { data: { session: supabaseSession } } = await client.auth.getSession();
      console.log("Supabase 직접 세션 결과:", supabaseSession ? "세션 있음" : "세션 없음");
      
      if (supabaseSession?.user) {
        console.log("Supabase 직접 세션으로 사용자 인증 성공:", supabaseSession.user.id);
        
        // 사용자 정보 가져오기
        const { data: userData, error: userError } = await client
          .from('users')
          .select('*')
          .eq('id', supabaseSession.user.id)
          .single();
        
        if (!userError && userData) {
          console.log("Supabase 직접 세션으로 사용자 정보 조회 성공");
          // UserData 타입으로 변환
          const userDataTyped = userData as UserData;
          
          return {
            id: supabaseSession.user.id,
            email: supabaseSession.user.email || '',
            name: userDataTyped?.name || supabaseSession.user?.user_metadata?.name || "",
            role: userDataTyped?.role || supabaseSession.user?.user_metadata?.role || "USER"
          };
        }
      }
    } catch (directSessionError) {
      console.error("Supabase 직접 세션 확인 중 오류:", directSessionError);
    }
    
    console.log("유효한 인증 정보를 찾을 수 없음");
    return null;
  } catch (e) {
    console.error("사용자 인증 오류:", e);
    return null;
  }
}

// GET 요청 핸들러 - 판매자의 상품에 대한 구매 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    console.log("\n===== 판매자 구매 목록 API 호출 시작 =====");
    console.log("요청 URL:", request.url);
    
    // 현재 인증된 사용자 정보 가져오기
    const authUser = await getAuthUser(request);
    
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 판매자 ID:", authUser.id);

    // 디버깅: 환경 출력
    console.log("NODE_ENV:", process.env.NODE_ENV);
    
    // 환경변수 로그
    console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10))

    const supabase = createAdminClient()

    try {
      // 1. 먼저 posts 테이블 구조 확인
      console.log("1. posts 테이블 구조 확인 중...");
      const { data: tableInfo, error: tableError } = await supabase
        .from('posts')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error("테이블 구조 확인 중 오류:", tableError);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "테이블 구조 확인 중 오류가 발생했습니다.", 
            error: process.env.NODE_ENV === 'development' ? tableError : undefined
          }, { status: 500 })
        );
      }
      
      // 테이블 컬럼 확인
      const tableColumns = tableInfo && tableInfo.length > 0 ? Object.keys(tableInfo[0]) : [];
      console.log("posts 테이블 컬럼:", tableColumns);

      // 2. 테이블 구조에 맞게 쿼리 작성
      console.log("2. 판매자 게시글 조회 중...");
      const hasAuthorIdField = tableColumns.includes('author_id');
      const hasUserIdField = tableColumns.includes('user_id');
      const hasIsDeletedField = tableColumns.includes('is_deleted');
      
      console.log("필드 확인: author_id=", hasAuthorIdField, "user_id=", hasUserIdField, "is_deleted=", hasIsDeletedField);
      
      // 쿼리 기본 준비
      let query = supabase.from('posts').select('id');
      
      // 적절한 ID 필드 사용
      if (hasAuthorIdField) {
        query = query.eq('author_id', authUser.id);
        console.log("author_id 필드로 필터링");
      } else if (hasUserIdField) {
        query = query.eq('user_id', authUser.id);
        console.log("user_id 필드로 필터링");
      } else {
        console.warn("사용자 ID에 해당하는 필드를 찾을 수 없음. author_id로 시도");
        query = query.eq('author_id', authUser.id);
      }
      
      // is_deleted 필드가 있으면 해당 조건 추가
      if (hasIsDeletedField) {
        query = query.eq('is_deleted', false);
        console.log("is_deleted 필드로 필터링 추가");
      }
      
      // 최종 쿼리 실행
      const { data: posts, error: postsError } = await query;
      
      if (postsError) {
        console.error("게시글 조회 오류:", postsError);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "데이터베이스 조회 중 오류가 발생했습니다.", 
            error: process.env.NODE_ENV === 'development' ? postsError : undefined 
          }, { status: 500 })
        );
      }
      
      const postIds = posts?.map((post: any) => post.id) || [];
      console.log("조회된 게시글 ID 목록:", postIds);
      
      if (postIds.length === 0) {
        console.log("판매자의 게시글이 없습니다.");
        return addCorsHeaders(NextResponse.json({
          success: true,
          purchases: []
        }, { status: 200 }));
      }
      
      // 3. purchases 테이블 구조 확인
      console.log("3. purchases 테이블 구조 확인 중...");
      const { data: purchaseInfo, error: purchaseTableError } = await supabase
        .from('purchases')
        .select('*')
        .limit(1);
      
      if (purchaseTableError) {
        console.error("purchases 테이블 구조 확인 중 오류:", purchaseTableError);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "구매 테이블 구조 확인 중 오류가 발생했습니다.",
            error: process.env.NODE_ENV === 'development' ? purchaseTableError : undefined
          }, { status: 500 })
        );
      }
      
      // purchases 테이블 컬럼 확인
      const purchaseColumns = purchaseInfo && purchaseInfo.length > 0 ? Object.keys(purchaseInfo[0]) : [];
      console.log("purchases 테이블 컬럼:", purchaseColumns);
      
      // post_id 또는 대체 필드 확인
      const postIdField = purchaseColumns.includes('post_id') ? 'post_id' : 
                          purchaseColumns.includes('postId') ? 'postId' : 'post_id';
      
      console.log(`구매 테이블의 게시글 ID 필드: ${postIdField}`);
      
      // 4. 판매자의 게시글에 대한 모든 구매 목록 조회
      console.log("4. 판매자 구매 목록 조회 중...");
      
      // 안전한 쿼리 작성
      let purchasesQuery = supabase.from('purchases').select(`
        *,
        post:posts(*),
        buyer:users!purchases_buyer_id_fkey(*)
      `);
      
      // postIds 배열이 비어있지 않을 때만 in 필터 적용
      if (postIds.length > 0) {
        purchasesQuery = purchasesQuery.in(postIdField, postIds);
      }
      
      // status 필드가 있을 경우에만 상태 필터 적용
      if (purchaseColumns.includes('status')) {
        purchasesQuery = purchasesQuery.in('status', ['PENDING', 'COMPLETED', 'PROCESSING', 'CONFIRMED']);
      }
      
      // updated_at 필드가 있을 경우에만 정렬 적용
      if (purchaseColumns.includes('updated_at')) {
        purchasesQuery = purchasesQuery.order('updated_at', { ascending: false });
      }
      
      console.log("Supabase 쿼리 실행 중 (foreign key 관계 명시: users!purchases_buyer_id_fkey)");
      const { data: purchases, error: purchasesError } = await purchasesQuery;
      
      if (purchasesError) {
        console.error("구매 목록 조회 오류:", purchasesError);
        return addCorsHeaders(
          NextResponse.json({ 
            success: false, 
            message: "데이터베이스 조회 중 오류가 발생했습니다.", 
            error: process.env.NODE_ENV === 'development' ? purchasesError : undefined
          }, { status: 500 })
        );
      }
      
      console.log(`판매자 ${authUser.id}의 판매 상품에 대한 구매 ${purchases?.length || 0}개 조회됨`);
      
      // 🔥 NEW: proposal_transactions에서 판매자 거래도 조회
      console.log("5. proposal_transactions에서 판매자 거래 조회 중...");
      
      const { data: proposalTransactions, error: proposalError } = await supabase
        .from('proposal_transactions')
        .select(`
          *,
          posts!proposal_transactions_post_id_fkey(*),
          buyer:users!proposal_transactions_buyer_id_fkey(*),
          seller:users!proposal_transactions_seller_id_fkey(*)
        `)
        .eq('seller_id', authUser.id)
        .in('status', ['PENDING', 'COMPLETED', 'PROCESSING', 'CONFIRMED'])
        .order('updated_at', { ascending: false });
      
      if (proposalError) {
        console.error("proposal_transactions 조회 오류:", proposalError);
        // 에러가 나도 기존 purchases는 반환
      } else {
        console.log(`판매자 ${authUser.id}의 제안 기반 거래 ${proposalTransactions?.length || 0}개 조회됨`);
      }
      
      // 🔥 두 데이터 결합: purchases + proposal_transactions
      const allSalesData = [];
      
      // 기존 purchases 추가
      if (purchases && purchases.length > 0) {
        const formattedPurchases = purchases.map((purchase: any) => ({
          ...purchase,
          transaction_type: 'direct_purchase', // 구분을 위한 필드
          postId: purchase.post_id || purchase.postId,
        }));
        allSalesData.push(...formattedPurchases);
      }
      
      // proposal_transactions를 purchases 형태로 변환하여 추가
      if (proposalTransactions && proposalTransactions.length > 0) {
        const formattedProposals = proposalTransactions.map((proposal: any) => ({
          id: proposal.id,
          order_number: proposal.order_number,
          buyer_id: proposal.buyer_id,
          seller_id: proposal.seller_id,
          post_id: proposal.post_id,
          postId: proposal.post_id,
          total_price: proposal.total_price,
          selected_seats: proposal.selected_seats,
          quantity: proposal.quantity,
          status: proposal.status,
          created_at: proposal.created_at,
          updated_at: proposal.updated_at,
          // 관련 데이터
          post: proposal.posts,
          buyer: proposal.buyer,
          seller: proposal.seller,
          // 구분을 위한 필드
          transaction_type: 'proposal_based',
        }));
        allSalesData.push(...formattedProposals);
      }
      
      // 시간순 정렬 (최신순)
      allSalesData.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at);
        const dateB = new Date(b.updated_at || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log(`✅ 총 판매 거래 수: ${allSalesData.length}개 (직접구매: ${purchases?.length || 0}, 제안기반: ${proposalTransactions?.length || 0})`);
      console.log("===== 판매자 구매 목록 API 호출 완료 =====\n");
      
      // 조회 결과가 없어도 빈 배열 반환
      const safePurchasesList = allSalesData || [];
      
      // 성공 응답 반환
      return addCorsHeaders(NextResponse.json({
        success: true,
        purchases: safePurchasesList
      }, { status: 200 }));
    } catch (dbError) {
      console.error("데이터베이스 조회 오류:", dbError);
      console.error("오류 타입:", typeof dbError);
      
      if (dbError instanceof Error) {
        console.error("오류 이름:", dbError.name);
        console.error("오류 메시지:", dbError.message);
      }
      
      return addCorsHeaders(
        NextResponse.json({ 
          success: false, 
          message: "데이터베이스 조회 중 오류가 발생했습니다.",
          error: process.env.NODE_ENV === 'development' ? String(dbError) : undefined
        }, { status: 500 })
      );
    }
  } catch (error) {
    console.error("판매자 구매 목록 조회 오류:", error instanceof Error ? error.message : String(error));
    console.error("상세 오류 스택:", error);
    console.error("오류 타입:", typeof error);
    
    if (error instanceof Error) {
      console.error("오류 이름:", error.name);
      console.error("오류 메시지:", error.message);
      console.error("오류 스택:", error.stack);
    }
    
    return addCorsHeaders(
      NextResponse.json({ 
        success: false, 
        message: "판매자 구매 목록 조회 중 오류가 발생했습니다.",
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }, { status: 500 })
    );
  }
} 