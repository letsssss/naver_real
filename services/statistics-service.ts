import { getSupabaseClient, supabase } from "@/lib/supabase";

// 취켓팅 성공률 통계를 가져오는 함수
export async function fetchTicketingSuccessRate(sellerId?: string): Promise<number | string> {
  try {
    const supabaseClient = await getSupabaseClient() || supabase;

    // 특정 판매자의 성공률을 요청한 경우
    if (sellerId) {
      // 판매자 페이지와 동일한 방식으로 성공률 조회
      const { data, error } = await supabaseClient
        .from("cancellation_ticketing_stats_view")
        .select("confirmed_count, cancelled_count, cancellation_ticketing_rate")
        .eq("seller_id", sellerId)
        .maybeSingle();
      
      if (error || !data) {
        console.error(`판매자 ${sellerId}의 성공률 조회 오류:`, error);
        
        // seller_stats 테이블에서 직접 계산 시도
        try {
          const { data: statsData, error: statsError } = await supabaseClient
            .from("seller_stats")
            .select("cancellation_ticketing_success, cancellation_ticketing_total")
            .eq("seller_id", sellerId)
            .single();
          
          if (statsError || !statsData) {
            throw statsError || new Error("판매자 통계 데이터 없음");
          }
          
          const successCount = statsData.cancellation_ticketing_success || 0;
          const totalCount = statsData.cancellation_ticketing_total || 0;
          
          // 거래가 없는 경우만 "신규"로 표시
          if (totalCount === 0) {
            return "신규";
          }
          
          // 성공률 계산 (소수점 한 자리까지 표시)
          const successRate = parseFloat(((successCount / totalCount) * 100).toFixed(1));
          return successRate || "측정중"; // 계산 결과가 0이면 "측정중" 반환
        } catch (innerError) {
          console.error(`판매자 ${sellerId}의 대체 계산 방법 오류:`, innerError);
          return "정보없음"; // 데이터가 없는 경우
        }
      }
      
      // View에서 직접 성공률 필드 사용 (판매자 페이지와 동일)
      if (data.cancellation_ticketing_rate !== null && data.cancellation_ticketing_rate !== undefined) {
        return parseFloat(data.cancellation_ticketing_rate.toFixed(1));
      }
      
      // 직접 계산 (필드가 없을 경우)
      const confirmed = data.confirmed_count || 0;
      const cancelled = data.cancelled_count || 0;
      const total = confirmed + cancelled;
      
      // 거래가 없는 경우만 "신규"로 표시
      if (total === 0) {
        return "신규";
      }
      
      // 성공률 계산 (소수점 한 자리까지 표시)
      const successRate = parseFloat(((confirmed / total) * 100).toFixed(1));
      return successRate || "측정중"; // 계산 결과가 0이면 "측정중" 반환
    }
    
    // 전체 시스템 성공률 (기존 로직)
    const { data, error } = await supabaseClient
      .from("cancellation_ticketing_stats_all_view") // 실제 거래 통계 뷰
      .select("confirmed_count, cancelled_count, cancellation_ticketing_rate")
      .single();
    
    if (error || !data) {
      console.error("취켓팅 통계 조회 오류:", error);
      
      // stats 테이블에서 직접 계산 시도
      try {
        const { data: statsData, error: statsError } = await supabaseClient
          .from("seller_stats")
          .select("cancellation_ticketing_success, cancellation_ticketing_total")
          .single();
        
        if (statsError || !statsData) {
          throw statsError || new Error("통계 데이터 없음");
        }
        
        const successCount = statsData.cancellation_ticketing_success || 0;
        const totalCount = statsData.cancellation_ticketing_total || 0;
        
        // 거래가 없는 경우 - 아직 서비스 초기 단계
        if (totalCount === 0) {
          return 90; // 서비스 초기에는 기본 목표 성공률 표시
        }
        
        // 성공률 계산 (소수점 한 자리까지 표시)
        const successRate = parseFloat(((successCount / totalCount) * 100).toFixed(1));
        return successRate || 90; // 계산 결과가 0이면 기본 목표 성공률
      } catch (innerError) {
        console.error("대체 계산 방법 오류:", innerError);
        
        // 마지막 시도: 시스템 설정 테이블에서 기본값 조회
        try {
          const { data: configData } = await supabaseClient
            .from("system_config")
            .select("value")
            .eq("key", "default_success_rate")
            .single();
            
          if (configData && configData.value) {
            return parseInt(configData.value);
          }
        } catch (configError) {
          console.error("시스템 설정 조회 오류:", configError);
        }
        
        return 90; // 서비스 목표 성공률
      }
    }
    
    // View에서 직접 성공률 필드 사용 (판매자 페이지와 동일)
    if (data.cancellation_ticketing_rate !== null && data.cancellation_ticketing_rate !== undefined) {
      return parseFloat(data.cancellation_ticketing_rate.toFixed(1));
    }
    
    // 거래 통계 뷰에서 성공률 계산
    const confirmed = data.confirmed_count || 0;
    const cancelled = data.cancelled_count || 0;
    const total = confirmed + cancelled;
    
    // 거래가 없는 경우
    if (total === 0) {
      return 90; // 서비스 목표 성공률
    }
    
    // 성공률 계산 (소수점 한 자리까지 표시)
    const successRate = parseFloat(((confirmed / total) * 100).toFixed(1));
    return successRate || 90; // 계산 결과가 0이면 기본 목표 성공률
  } catch (error) {
    console.error("취켓팅 성공률 조회 중 오류 발생:", error);
    return 90; // 서비스 목표 성공률
  }
} 