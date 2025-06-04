import { createAdminClient } from '@/lib/supabase-admin';

/**
 * 사용자의 미납 수수료를 확인하는 함수
 * @param userId 사용자 ID
 * @returns 미납 수수료 정보
 */
export async function checkUnpaidFees(userId: string) {
  if (!userId) {
    return {
      hasUnpaidFees: false,
      unpaidFees: [],
      totalAmount: 0,
      oldestDueDate: null
    }
  }
  
  try {
    // 서버 API를 호출하여 미납 수수료 확인
    const response = await fetch('/api/unpaid-fees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`미납 수수료 확인 API 오류: ${response.status} ${errorData.error || ''}`);
    }
    
    const data = await response.json();
    
    // 미납 수수료가 없는 경우
    if (!data.hasUnpaidFees) {
      return {
        hasUnpaidFees: false,
        unpaidFees: [],
        totalAmount: 0,
        oldestDueDate: null
      }
    }
    
    // 미납 수수료가 있는 경우
    // 가장 오래된 납부기한이 있으면 Date 객체로 변환
    const oldestDueDate = data.oldestDueDate ? new Date(data.oldestDueDate) : null;
    
    const result = {
      hasUnpaidFees: data.hasUnpaidFees,
      unpaidFees: data.unpaidFees || [],
      totalAmount: data.totalAmount || 0,
      oldestDueDate
    };
    
    return result;
  } catch (error) {
    // 오류 발생 시에도 기본 응답 반환
    return {
      hasUnpaidFees: false,
      unpaidFees: [],
      totalAmount: 0,
      oldestDueDate: null
    };
  }
} 