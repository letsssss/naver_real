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
    // 서버 API를 호출하여 미납 수수료 확인
    console.log("🔄 미납 수수료 API 호출 시작");
    
    const response = await fetch('/api/unpaid-fees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ API 응답 오류:", response.status, errorData);
      throw new Error(`미납 수수료 확인 API 오류: ${response.status} ${errorData.error || ''}`);
    }
    
    const data = await response.json();
    console.log("📊 API 응답 데이터:", data);
    
    // 미납 수수료가 없는 경우
    if (!data.hasUnpaidFees) {
      console.log("✅ 미납 수수료 없음");
      return {
        hasUnpaidFees: false,
        unpaidFees: [],
        totalAmount: 0,
        oldestDueDate: null
      }
    }
    
    // 미납 수수료가 있는 경우
    console.log("⚠️ 미납 수수료 있음:", data.count, "건");
    console.log("💵 총 미납 금액:", data.totalAmount, "원");
    
    // 가장 오래된 납부기한이 있으면 Date 객체로 변환
    const oldestDueDate = data.oldestDueDate ? new Date(data.oldestDueDate) : null;
    console.log("⏰ 가장 오래된 납부기한:", oldestDueDate);
    
    const result = {
      hasUnpaidFees: data.hasUnpaidFees,
      unpaidFees: data.unpaidFees || [],
      totalAmount: data.totalAmount || 0,
      oldestDueDate
    };
    
    console.log("💥 최종 판단 - 미납 수수료 있음?", result.hasUnpaidFees);
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