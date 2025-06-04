import { getSupabaseClient } from "@/lib/supabase";

/**
 * 사용자 신고 함수
 * @param sellerId 신고할 판매자 ID
 * @param reason 신고 사유
 * @param reporterId 신고자 ID  
 * @returns 성공 여부
 */
export async function reportUser(sellerId: string, reason: string, reporterId: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseClient();
    
    const { data, error } = await supabase
      .from('reports')
      .insert({
        type: 'USER',
        reason: reason,
        seller_id: sellerId,
        reporter_id: reporterId,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      });
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 게시글 신고 함수
 * @param postId 신고할 게시글 ID
 * @param reason 신고 사유
 * @param reporterId 신고자 ID
 * @returns 성공 여부
 */
export async function reportPost(postId: number, reason: string, reporterId: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseClient();
    
    // 이미 신고한 기록이 있는지 확인
    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", reporterId)
      .eq("post_id", postId)
      .maybeSingle();

    if (existingReport) {
      throw new Error("이미 신고한 게시물입니다.");
    }
    
    const { data, error } = await supabase
      .from('reports')
      .insert({
        type: 'POST',
        reason: reason,
        post_id: postId,
        reporter_id: reporterId,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      });
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 사용자가 게시물을 이미 신고했는지 확인
 * @param postId 확인할 게시물 ID
 * @param userId 사용자 ID
 * @returns 신고 여부
 */
export async function hasReportedPost(postId: number, userId: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseClient();
    
    const { data } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", userId)
      .eq("post_id", postId)
      .maybeSingle();

    return !!data;
  } catch (error) {
    return false;
  }
} 