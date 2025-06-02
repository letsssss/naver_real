import { createAdminClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

/**
 * 사용자의 미납 수수료를 확인하는 API 엔드포인트
 * POST 요청으로 userId를 받아 미납 수수료 정보를 반환합니다.
 * 시간 제한 없이 모든 미납 수수료를 확인합니다.
 */
export async function POST(req: Request) {
  try {
    // 요청 본문에서 userId 추출
    const { userId } = await req.json();
    
    // userId 검증
    if (!userId) {
      return NextResponse.json(
        {
          hasUnpaidFees: false,
          unpaidFees: [],
          totalAmount: 0,
          oldestDueDate: null,
          error: "userId가 제공되지 않았습니다."
        },
        { status: 400 }
      );
    }
    
    // 서버 측에서 관리자 클라이언트 생성
    const adminClient = createAdminClient();
    
    // 미납 수수료 확인 - 기한에 상관없이 모든 미납 수수료 확인
    const { data, error } = await adminClient
      .from('purchases')
      .select('id, order_number, fee_amount, fee_due_at, total_price')
      .eq('seller_id', userId)
      .eq('is_fee_paid', false);  // 수수료가 지불되지 않은 것만 선택 (시간 제한 없음)
    
    if (error) {
      console.error("❌ [API] Supabase 오류:", error);
      return NextResponse.json(
        {
          hasUnpaidFees: false,
          unpaidFees: [],
          totalAmount: 0,
          oldestDueDate: null,
          error: `미납 수수료 확인 중 오류가 발생했습니다: ${error.message}`
        },
        { status: 500 }
      );
    }
    
    // 미납 수수료가 없는 경우
    if (!data || data.length === 0) {
      return NextResponse.json({
        hasUnpaidFees: false,
        unpaidFees: [],
        totalAmount: 0,
        oldestDueDate: null
      });
    }
    
    // 총 금액 계산
    const totalAmount = data.reduce((sum, item) => sum + (item.fee_amount || 0), 0);
    
    // 가장 오래된 납부기한 찾기
    const oldestDueDate = data.reduce<string | null>((oldest, item) => {
      if (!oldest || new Date(item.fee_due_at) < new Date(oldest)) {
        return item.fee_due_at;
      }
      return oldest;
    }, null);
    
    return NextResponse.json({
      hasUnpaidFees: data.length > 0,
      unpaidFees: data,
      totalAmount,
      oldestDueDate: oldestDueDate,
      count: data.length
    });
  } catch (error) {
    console.error("❌ [API] 예외 발생:", error);
    return NextResponse.json(
      {
        hasUnpaidFees: false,
        unpaidFees: [],
        totalAmount: 0,
        oldestDueDate: null,
        error: `요청 처리 중 예외가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }
} 