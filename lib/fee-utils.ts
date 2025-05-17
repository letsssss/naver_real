import { createAdminClient } from '@/lib/supabase';

/**
 * 사용자의 미납 수수료를 확인하는 함수
 * @param userId 사용자 ID
 * @returns 미납 수수료 정보
 */
export async function checkUnpaidFees(userId: string) {
  console.log("📌 checkUnpaidFees 함수 호출됨", { userId });
  
  if (!userId) {
    console.error("❌ userId가 없음");
    return {
      hasUnpaidFees: false,
      unpaidFees: [],
      totalAmount: 0,
      oldestDueDate: null
    }
  }
  
  try {
    const adminClient = createAdminClient();
    console.log("✅ 수수료 확인용 Supabase 클라이언트 생성됨");
    
    // 현재 시간
    const now = new Date().toISOString();
    console.log("📅 현재 시간:", now);
    
    // 미납 수수료 확인
    const { data, error } = await adminClient
      .from('purchases')
      .select('id, order_number, fee_amount, fee_due_at, total_price')
      .eq('seller_id', userId)
      .eq('is_fee_paid', false)  // 수수료가 지불되지 않은 것만 선택
      .lt('fee_due_at', now);    // 납부기한이 현재보다 이전인 것만 선택
    
    console.log("📊 Supabase 쿼리 결과:", { data, error, count: data?.length });
    
    if (error) {
      console.error("❌ Supabase 오류:", error);
      throw new Error(`미납 수수료 확인 중 오류가 발생했습니다: ${error.message}`);
    }
    
    // 미납 수수료가 없는 경우
    if (!data || data.length === 0) {
      console.log("✅ 미납 수수료 없음");
      return {
        hasUnpaidFees: false,
        unpaidFees: [],
        totalAmount: 0,
        oldestDueDate: null
      }
    }
    
    // 미납 수수료가 있는 경우
    console.log("⚠️ 미납 수수료 있음:", data.length, "건");
    
    // 총 금액 계산
    const totalAmount = data.reduce((sum, item) => sum + (item.fee_amount || 0), 0);
    console.log("💵 총 미납 금액:", totalAmount, "원");
    
    // 가장 오래된 납부기한 찾기
    const oldestDueDate = data.reduce<string | null>((oldest, item) => {
      if (!oldest || new Date(item.fee_due_at) < new Date(oldest)) {
        return item.fee_due_at;
      }
      return oldest;
    }, null);
    console.log("⏰ 가장 오래된 납부기한:", oldestDueDate);
    
    const result = {
      hasUnpaidFees: data.length > 0,
      unpaidFees: data,
      totalAmount,
      oldestDueDate: oldestDueDate ? new Date(oldestDueDate) : null
    };
    
    console.log("📊 최종 결과:", result);
    return result;
  } catch (error) {
    console.error("❌ 수수료 확인 중 예외 발생:", error);
    // 오류 발생 시에도 기본 응답 반환
    return {
      hasUnpaidFees: false,
      unpaidFees: [],
      totalAmount: 0,
      oldestDueDate: null
    };
  }
} 