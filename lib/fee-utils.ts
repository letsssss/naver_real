import { createAdminClient } from '@/lib/supabase';

/**
 * 사용자의 미납 수수료를 확인하는 함수
 * @param userId 사용자 ID
 * @returns 미납 수수료 정보
 */
export async function checkUnpaidFees(userId: string) {
  // 관리자 권한으로 Supabase 클라이언트 생성
  const supabase = createAdminClient();
  
  // 기간에 상관없이 모든 미납 수수료 조회 (기한 조건 제거)
  const { data, error } = await supabase
    .from('purchases')
    .select('id, order_number, fee_amount, fee_due_at, total_price')
    .eq('seller_id', userId)
    .eq('is_fee_paid', false)
    .eq('status', 'CONFIRMED');
  
  if (error) {
    console.error("미납 수수료 조회 오류:", error);
    throw error;
  }
  
  // 총 미납 금액 계산
  const totalUnpaidAmount = data?.reduce((sum, item) => sum + (item.fee_amount || 0), 0) || 0;
  
  return {
    hasUnpaidFees: data && data.length > 0,
    unpaidFees: data || [],
    totalAmount: totalUnpaidAmount,
    oldestDueDate: data && data.length > 0 
      ? new Date(data.sort((a, b) => new Date(a.fee_due_at).getTime() - new Date(b.fee_due_at).getTime())[0].fee_due_at)
      : null
  };
} 