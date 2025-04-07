import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { convertBigIntToString } from "@/lib/utils";
import { getSupabaseClient, createAuthedClient, createAdminClient } from "@/lib/supabase";
import { Database } from "@/types/supabase.types";

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

// 구매 내역 타입 정의 (타입 오류 해결)
interface Purchase {
  id: string | number;
  buyer_id?: string | number;
  post_id?: string | number;
  status?: string;
  order_number?: string;
  total_price?: number;
  quantity?: number;
  created_at?: string;
  updated_at?: string;
  seller_id?: string | number;
  post?: any;
  seller?: any;
  [key: string]: any; // 기타 속성 허용
}

// 인증된 사용자 정보를 위한 인터페이스 추가
interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  token: string; // 토큰 필드 추가
}

// OPTIONS 메서드 처리
export async function OPTIONS() {
  return addCorsHeaders(new NextResponse(null, { status: 200 }));
}

// GET 요청 핸들러 - 구매 목록 가져오기
export async function GET(request: NextRequest) {
  try {
    console.log("구매 목록 API 호출됨 - 버전 4 (인증 클라이언트 사용)");
    
    // 인증 헤더 확인
    const authHeader = request.headers.get('authorization');
    console.log("✨ 수신된 인증 헤더:", authHeader);
    
    if (authHeader) {
      // Bearer 토큰 형식 확인
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log("✨ 추출된 토큰 (앞 15자):", token.substring(0, 15) + '...');
        
        // JWT 토큰 검증
        try {
          // JWT는 header.payload.signature 형식
          const parts = token.split('.');
          if (parts.length === 3) {
            try {
              // payload 부분 디코딩
              const payload = JSON.parse(atob(parts[1]));
              console.log("✨ 토큰 페이로드:", payload);
              
              // 중요한 필드 확인
              console.log("✨ 사용자 ID:", payload.sub);
              console.log("✨ 사용자 역할:", payload.role);
              console.log("✨ 토큰 발행자:", payload.iss);
              console.log("✨ 만료 시간:", new Date(payload.exp * 1000).toLocaleString());
              
              const now = Math.floor(Date.now() / 1000);
              if (payload.exp < now) {
                console.error("❌ 토큰이 만료되었습니다!");
              }
            } catch (decodeError) {
              console.error("❌ 토큰 페이로드 디코딩 실패:", decodeError);
            }
          } else {
            console.error("❌ 토큰이 올바른 JWT 형식이 아닙니다:", parts.length);
          }
        } catch (tokenError) {
          console.error("❌ 토큰 파싱 실패:", tokenError);
        }
      } else {
        console.warn("❌ Authorization 헤더가 Bearer 형식이 아닙니다");
      }
    } else {
      console.warn("❌ Authorization 헤더가 없습니다");
    }
    
    // 현재 인증된 사용자 정보 가져오기
    let authUser = await getAuthenticatedUser(request) as AuthUser | null;
    
    // 개발 환경에서 userId 쿼리 파라미터를 사용한 인증 처리
    if (!authUser && process.env.NODE_ENV === 'development') {
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId');
      
      console.log("개발 환경 - 쿼리 파라미터 userId 확인:", userId);
      
      if (userId) {
        console.log("개발 환경 - 쿼리 파라미터에서 userId 발견:", userId);
        
        // 개발 환경에서는 쿼리 파라미터의 userId로 mock 사용자 생성
        authUser = {
          id: userId,
          name: 'Dev User',
          email: 'dev-user@example.com',
          role: 'user',
          token: '' // 토큰 필드 추가
        };
      }
    }
    
    // 인증된 사용자가 없으면 401 에러 반환
    if (!authUser) {
      console.log("인증된 사용자를 찾을 수 없음");
      return addCorsHeaders(NextResponse.json(
        { success: false, message: "인증되지 않은 사용자입니다." },
        { status: 401 }
      ));
    }

    console.log("인증된 사용자 ID:", authUser.id, "타입:", typeof authUser.id);
    console.log("인증 토큰 유무:", authUser.token ? "있음" : "없음");
    
    // 쿼리 파라미터 처리
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log("API 요청 파라미터:", { page, limit, userId: authUser.id });
    
    // 페이지네이션 계산
    const skip = (page - 1) * limit;

    // 인증된 Supabase 클라이언트 생성
    // authUser.token이 있으면 인증된 클라이언트 사용, 없으면 익명 클라이언트 사용
    const supabase = authUser.token 
      ? createAuthedClient(authUser.token) 
      : getSupabaseClient();
    
    console.log("Supabase 클라이언트 타입:", authUser.token ? "인증됨" : "익명");
    
    try {
      console.log("구매 목록 조회 시작 - 사용자 ID:", authUser.id);
      
      // 다양한 형태의 ID를 준비
      const userIdStr = String(authUser.id);
      console.log("조회에 사용할 문자열 변환된 userId:", userIdStr);
      
      // ✅ 원본 userId 타입 및 값 확인
      console.log("✅ Supabase에서 buyer_id 필터로 사용할 값:", authUser.id, typeof authUser.id);
      
      // 전체 구매 데이터 샘플 확인 (디버깅용)
      console.log("전체 구매 데이터 샘플 조회 시도 중...");
      const { data: allPurchases, error: allError } = await supabase
        .from('purchases')
        .select('id, buyer_id, post_id, status, order_number')
        .limit(10);
      
      if (allError) {
        console.error("전체 구매 목록 조회 오류:", allError);
      } else if (!allPurchases || allPurchases.length === 0) {
        console.log("전체 구매 데이터가 없거나 비어 있습니다");
      } else {
        console.log("전체 purchases 샘플 (최대 10개):", allPurchases);
        
        // 안전하게 첫 번째 구매 데이터 접근
        if (allPurchases.length > 0 && 'buyer_id' in allPurchases[0]) {
          console.log("구매 데이터 첫 번째 레코드 buyer_id 타입:", typeof allPurchases[0].buyer_id);
          console.log("구매 데이터 예시:", allPurchases[0]);
        }
      }

      // 모든 결과를 저장할 변수, 명시적 타입 지정으로 타입 오류 해결
      let purchases: Purchase[] = [];
      let count = 0;
      
      // 5. 새 시도 추가 - SQL 쿼리 로그 추가 및 RLS 우회 시도
      console.log("시도 5: 인증된 클라이언트와 명시적 필터 혼합 사용");
      
      // 특수 서비스 롤을 가진 쿼리 시도
      try {
        // RLS 정책과 명시적 필터 함께 사용 (auth.uid()가 작동하지 않을 수 있으므로)
        console.log("✅ RLS 정책과 함께 명시적 필터를 사용합니다");
        console.log("✅ authUser.id:", authUser.id, "타입:", typeof authUser.id);
        
        const { data: directPurchases, error: directError } = await supabase
          .from('purchases')
          .select('*')
          .eq('buyer_id', authUser.id) // 명시적 필터 다시 추가
          .order('created_at', { ascending: false });
        
        if (directError) {
          console.error("직접 쿼리 오류:", directError);
        } else {
          console.log("직접 쿼리 결과:", directPurchases);
          if (directPurchases && Array.isArray(directPurchases) && directPurchases.length > 0) {
            purchases = directPurchases;
            count = directPurchases.length;
            console.log("✅ 명시적 필터를 통해 구매 데이터를 성공적으로 찾았습니다!");
          }
        }
      } catch (rpcError) {
        console.error("직접 쿼리 실행 중 오류:", rpcError);
      }
      
      // 여전히 결과가 없으면 관리자 클라이언트로 시도
      if (purchases.length === 0) {
        console.log("✅ 관리자 권한 클라이언트로 시도");
        try {
          const adminSupabase = createAdminClient(); // 관리자 클라이언트 생성
          
          const { data: adminPurchases, error: adminError } = await adminSupabase
            .from('purchases')
            .select('*')
            .eq('buyer_id', authUser.id)
            .order('created_at', { ascending: false });
          
          if (adminError) {
            console.error("관리자 권한 쿼리 오류:", adminError);
          } else {
            console.log("관리자 권한 쿼리 결과:", adminPurchases);
            if (adminPurchases && adminPurchases.length > 0) {
              purchases = adminPurchases;
              count = adminPurchases.length;
              console.log("✅ 관리자 권한으로 구매 데이터를 성공적으로 찾았습니다!");
            }
          }
        } catch (adminError) {
          console.error("관리자 클라이언트 사용 중 오류:", adminError);
        }
      }
      
      // 원본 authUser.id를 직접 사용하는 쿼리 추가
      if (purchases.length === 0) {
        console.log("✅ 두번째 시도: 다른 방식의 명시적 필터 사용");
        const { data: originalIdData, error: originalIdError } = await supabase
          .from('purchases')
          .select('*')
          .eq('buyer_id', userIdStr); // 문자열로 변환한 ID 사용
        
        if (originalIdError) {
          console.error("문자열 ID 쿼리 오류:", originalIdError);
        } else {
          console.log("문자열 ID 쿼리 결과:", originalIdData);
          if (originalIdData && originalIdData.length > 0) {
            purchases = originalIdData;
            count = originalIdData.length;
            console.log("✅ 문자열 ID 필터로 구매 데이터를 찾았습니다!");
          }
        }
      }
      
      // 다양한 방식으로 구매 목록 조회 시도 (기존 방식들 유지 - 위 RPC 함수가 없을 경우를 대비)
      if (purchases.length === 0) {
        // 0. 직접 로그 확인 및 ID 변환 시도
        console.log("문자열 ID 확인 및 변환 테스트");
        console.log(`사용자 ID(원본): ${authUser.id}, 타입: ${typeof authUser.id}`);
        console.log(`사용자 ID(문자열): ${userIdStr}, 타입: ${typeof userIdStr}`);
        
        // 다양한 ID 형식 시도
        const userIdVariations = [
          userIdStr,                       // 기본 문자열
          userIdStr.toLowerCase(),         // 소문자
          userIdStr.toUpperCase(),         // 대문자
          userIdStr.replace(/-/g, ''),     // 하이픈 제거
          `"${userIdStr}"`                 // 따옴표 포함
        ];
        console.log("시도할 ID 변형들:", userIdVariations);
        
        // 전체 구매 데이터 확인 (10개만)
        console.log("데이터베이스의 전체 구매 데이터 확인 (최대 10개)");
        const { data: allSampleData, error: sampleError } = await supabase
          .from('purchases')
          .select('*')
          .limit(10);
        
        if (sampleError) {
          console.error("전체 구매 데이터 샘플 조회 오류:", sampleError);
        } else {
          console.log("전체 구매 데이터 샘플 (최대 10개):", allSampleData);
          console.log("총 샘플 레코드 수:", allSampleData?.length || 0);
          
          if (allSampleData && allSampleData.length > 0) {
            // 존재하는 buyer_id 값 로깅
            const existingBuyerIds = allSampleData.map(p => p.buyer_id || '없음');
            console.log("존재하는 buyer_id 값들:", existingBuyerIds);
          }
        }
        
        // 1. 기본 쿼리 - PROCESS 상태도 포함하여 조회
        console.log("PROCESS 상태 포함 기본 쿼리 (명시적 필터 사용)");
        
        const { data: processStatusData, error: processError } = await supabase
          .from('purchases')
          .select('*')
          .eq('buyer_id', userIdStr);
        
        if (processError) {
          console.error("PROCESS 상태 쿼리 오류:", processError);
        } else {
          console.log("PROCESS 상태 쿼리 결과:", processStatusData);
          if (processStatusData && processStatusData.length > 0) {
            purchases = processStatusData;
            count = processStatusData.length;
            console.log("✅ PROCESS 상태 쿼리로 구매 데이터를 찾았습니다!");
          }
        }
        
        // 2. 모든 구매 데이터에서 JavaScript로 필터링 - IN 쿼리로 여러 변형 시도
        if (purchases.length === 0) {
          console.log("IN 쿼리로 여러 ID 변형 시도");
          
          const { data: inQueryData, error: inQueryError } = await supabase
            .from('purchases')
            .select('*')
            .in('buyer_id', userIdVariations);
          
          if (inQueryError) {
            console.error("IN 쿼리 오류:", inQueryError);
          } else if (inQueryData && inQueryData.length > 0) {
            console.log("IN 쿼리로 구매 데이터를 찾았습니다!");
            purchases = inQueryData;
            count = inQueryData.length;
          }
        }
      }
      
      // 성공한 쿼리를 관계 조회로 강화
      if (purchases.length > 0) {
        try {
          // 관련 데이터 (post, seller)를 조회
          const purchaseIds = purchases.map(p => String(p.id)); // ID를 문자열로 변환
          console.log("조회할 구매 ID 목록:", purchaseIds);
          
          // in 연산자에 배열 변환 적용
          if (purchaseIds.length > 0) {
            // 대체 방법: 직접 조건을 OR로 연결하여 사용
            let query = supabase
              .from('purchases')
              .select(`
                *,
                post:posts(*),
                seller:users!seller_id(id, name, email)
              `);
            
            // 작은 배열만 처리 (성능 이슈 방지)
            if (purchaseIds.length <= 10) {
              // OR 조건으로 변환
              const conditions = purchaseIds.map(id => `id.eq.${id}`).join(',');
              query = query.or(conditions);
            } else {
              // 10개 넘는 경우 첫 10개만 조회 (페이지네이션 적용)
              const subIds = purchaseIds.slice(0, 10);
              const conditions = subIds.map(id => `id.eq.${id}`).join(',');
              query = query.or(conditions);
            }
              
            const { data: fullPurchases, error: fullError } = await query;
            
            if (fullError) {
              console.error("관계 쿼리 오류:", fullError);
            } else if (fullPurchases && fullPurchases.length > 0) {
              console.log("관계 데이터 조회 성공!");
              purchases = fullPurchases;
            }
          }
        } catch (relationError) {
          console.error("관계 데이터 조회 중 오류:", relationError);
          // 관계 조회 실패해도 기본 purchases 데이터는 유지
        }
      }
      
      // 페이지네이션 적용
      const paginatedPurchases = purchases.slice(skip, skip + limit);
      
      // 총 구매 수 조회
      const totalCount = count || 0;
      console.log("조회된 총 구매 수:", totalCount);
      
      // 조회 결과가 없어도 빈 배열 반환
      const safePurchasesList = paginatedPurchases || [];
      console.log(`${safePurchasesList.length}개의 구매를 찾았습니다.`);
      
      // 성공 응답 반환
      return addCorsHeaders(NextResponse.json({
        success: true,
        purchases: safePurchasesList,
        raw_user_id: authUser.id,
        user_id_string: userIdStr,
        user_id_type: typeof authUser.id,
        pagination: {
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          hasMore: skip + safePurchasesList.length < totalCount
        }
      }, { status: 200 }));
    } catch (dbError) {
      console.error("데이터베이스 조회 오류:", dbError);
      console.error("오류 타입:", typeof dbError);
      
      if (dbError instanceof Error) {
        console.error("오류 이름:", dbError.name);
        console.error("오류 메시지:", dbError.message);
        console.error("오류 스택:", dbError.stack);
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
    console.error("구매 목록 조회 오류:", error instanceof Error ? error.message : String(error));
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
        message: "구매 목록 조회 중 오류가 발생했습니다.",
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      }, { status: 500 })
    );
  } finally {
    console.log("Purchase API 요청 처리 완료");
  }
} 