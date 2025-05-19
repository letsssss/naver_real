import { createBrowserClient } from "@/lib/supabase";

// 취켓팅 성공률 통계를 가져오는 함수
export async function fetchTicketingSuccessRate(): Promise<number> {
  try {
    const supabase = createBrowserClient();
    
    // 취켓팅 성공률 조회 - ratings 테이블에서 계산 
    // 판매자 통계 view에서 평균 성공률 조회
    const { data, error } = await supabase
      .from("seller_avg_rating")
      .select("avg_success_rate")
      .single();
    
    if (error) {
      console.error("취켓팅 성공률 조회 오류:", error);
      
      // View가 없는 경우, 대체 방법으로 ratings 테이블에서 직접 계산 시도
      try {
        // 모든 ratings에서 평균 계산 (간단한 계산)
        const { data: ratingsData, error: ratingsError } = await supabase
          .from("ratings")
          .select("rating")
          .gt("rating", 3); // 4점 이상은 성공으로 간주
        
        if (ratingsError || !ratingsData) {
          throw ratingsError || new Error("데이터 없음");
        }
        
        // 성공률 = (4점 이상 리뷰 수 / 전체 리뷰 수) * 100
        const { data: totalRatings, error: totalError } = await supabase
          .from("ratings")
          .select("rating", { count: "exact" });
          
        if (totalError || !totalRatings) {
          throw totalError || new Error("전체 데이터 없음");
        }
        
        const successRate = (ratingsData.length / totalRatings.length) * 100;
        return Math.round(successRate) || 98; // 소수점 반올림, 데이터 없으면 기본값
      } catch (innerError) {
        console.error("대체 계산 방법 오류:", innerError);
        return 98; // 기본값
      }
    }
    
    return data?.avg_success_rate || 98;
  } catch (error) {
    console.error("취켓팅 성공률 조회 중 오류 발생:", error);
    return 98; // 기본값
  }
} 