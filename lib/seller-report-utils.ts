import { getSupabaseClient } from "@/lib/supabase";

/**
 * 판매자 신고 처리 함수
 * @param sellerId 신고할 판매자 ID
 * @param reason 신고 사유
 * @returns 성공 여부
 */
export const reportSeller = async (sellerId: string, reason: string): Promise<boolean> => {
  const supabase = await getSupabaseClient();
  
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
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (existingReport) {
    throw new Error("이미 신고한 판매자입니다.");
  }

  // 신고 저장
  const { error: insertError } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      seller_id: sellerId,
      reason,
      type: "seller",
      status: "pending" // 기본 상태: 검토 대기중
    });

  if (insertError) {
    throw new Error("신고 접수 중 오류가 발생했습니다: " + insertError.message);
  }

  return true;
};

/**
 * 사용자가 판매자를 이미 신고했는지 확인
 * @param sellerId 확인할 판매자 ID
 * @returns 신고 여부
 */
export const hasReportedSeller = async (sellerId: string): Promise<boolean> => {
  const supabase = await getSupabaseClient();
  
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) return false;

  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("seller_id", sellerId)
    .maybeSingle();

  return !!data;
}; 