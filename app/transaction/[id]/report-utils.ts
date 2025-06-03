import { createBrowserClient } from "@/lib/supabase";

/**
 * 거래 신고 처리 함수
 * @param orderId 신고할 거래 주문번호
 * @param reason 신고 사유
 * @returns 성공 여부
 */
export const reportTransaction = async (orderId: string, reason: string): Promise<boolean> => {
  const supabase = createBrowserClient();
  
  // 인증된 사용자 확인
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user || !reason) {
    throw new Error("로그인이 필요하거나 신고 사유가 입력되지 않았습니다.");
  }

  // 이미 신고한 기록이 있는지 확인
  const { data: existingReport } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("order_number", orderId)
    .maybeSingle();

  if (existingReport) {
    throw new Error("이미 신고한 거래입니다.");
  }

  // 신고 저장
  const { error: insertError } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      order_number: orderId,
      reason,
      type: "transaction",
      status: "pending" // 기본 상태: 검토 대기중
    });

  if (insertError) {
    console.error("신고 처리 오류:", insertError);
    throw new Error("신고 접수 중 오류가 발생했습니다: " + insertError.message);
  }

  return true;
};

/**
 * 사용자가 거래를 이미 신고했는지 확인
 * @param orderId 확인할 거래 주문번호
 * @returns 신고 여부
 */
export const hasReportedTransaction = async (orderId: string): Promise<boolean> => {
  const supabase = createBrowserClient();
  
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) return false;

  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("order_number", orderId)
    .maybeSingle();

  return !!data;
}; 