import { getSupabaseClient } from "@/lib/supabase";

/**
 * 게시물 신고 처리 함수
 * @param postId 신고할 게시물 ID
 * @param reason 신고 사유
 * @param reporterId 신고자 ID (optional, if not provided will get from auth)
 * @returns 성공 여부
 */
export const reportPost = async (postId: number, reason: string, reporterId?: string): Promise<boolean> => {
  const supabase = await getSupabaseClient();
  
  let userId = reporterId;
  
  // 신고자 ID가 제공되지 않은 경우 현재 사용자에서 가져오기
  if (!userId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      throw new Error("로그인이 필요합니다.");
    }
    userId = user.id;
  }

  if (!reason) {
    throw new Error("신고 사유가 입력되지 않았습니다.");
  }

  // 이미 신고한 기록이 있는지 확인
  const { data: existingReport } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  if (existingReport) {
    throw new Error("이미 신고한 게시물입니다.");
  }

  // 신고 저장
  const { error: insertError } = await supabase
    .from("reports")
    .insert({
      reporter_id: userId,
      post_id: postId,
      reason,
      status: "pending"
    });

  if (insertError) {
    throw new Error("신고 접수 중 오류가 발생했습니다: " + insertError.message);
  }

  return true;
};

/**
 * 사용자가 게시물을 이미 신고했는지 확인
 * @param postId 확인할 게시물 ID
 * @param userId 사용자 ID (optional, if not provided will get from auth)
 * @returns 신고 여부
 */
export const hasReportedPost = async (postId: number, userId?: string): Promise<boolean> => {
  const supabase = await getSupabaseClient();
  
  let checkUserId = userId;
  
  // 사용자 ID가 제공되지 않은 경우 현재 사용자에서 가져오기
  if (!checkUserId) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) return false;
    checkUserId = user.id;
  }

  const { data } = await supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", checkUserId)
    .eq("post_id", postId)
    .maybeSingle();

  return !!data;
}; 