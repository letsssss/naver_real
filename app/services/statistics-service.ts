import { getSupabaseClient } from '@/lib/supabase';

export async function fetchTicketingSuccessRate(): Promise<number> {
  try {
    const supabaseClient = await getSupabaseClient();
    
    // 저장 프로시저를 통해 평균값 조회
    const { data, error } = await supabaseClient
      .from('cancellation_statistics')
      .select('cancellation_ticketing_rate');

    if (error) {
      console.error("성공률 조회 오류:", error);
      return 90; // 기본값 반환
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return 90; // 데이터가 없는 경우 기본값 반환
    }

    // 클라이언트에서 평균 계산
    const validRates = data
      .map(item => item.cancellation_ticketing_rate)
      .filter((rate): rate is number => typeof rate === 'number' && !isNaN(rate));

    if (validRates.length === 0) {
      return 90; // 유효한 데이터가 없는 경우 기본값 반환
    }

    const average = validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length;
    return Math.round(average);
  } catch (error) {
    console.error("성공률 계산 중 오류 발생:", error);
    return 90; // 오류 발생 시 기본값 반환
  }
} 