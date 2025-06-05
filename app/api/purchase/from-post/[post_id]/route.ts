import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ post_id: string }> }
) {
  const resolvedParams = await params;
  const postId = Number(resolvedParams.post_id);

  if (isNaN(postId)) {
    return NextResponse.json({ error: "post_id가 숫자가 아닙니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 먼저 purchases 테이블에서 조회
  const { data: purchaseData, error: purchaseError } = await supabase
    .from("purchases")
    .select("order_number")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (purchaseError) {
    console.error("❌ purchases 테이블 조회 오류:", purchaseError.message);
  }

  // purchases에서 찾았으면 반환
  if (purchaseData && purchaseData.order_number) {
    console.log(`✅ purchases에서 post_id ${postId} → 주문번호: ${purchaseData.order_number}`);
    return NextResponse.json({ order_number: purchaseData.order_number });
  }

  // purchases에서 못 찾았으면 proposal_transactions에서 조회
  const { data: proposalData, error: proposalError } = await supabase
    .from("proposal_transactions")
    .select("order_number")
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (proposalError) {
    console.error("❌ proposal_transactions 테이블 조회 오류:", proposalError.message);
    return NextResponse.json({ error: proposalError.message }, { status: 500 });
  }

  // proposal_transactions에서 찾았으면 반환
  if (proposalData && proposalData.order_number) {
    console.log(`✅ proposal_transactions에서 post_id ${postId} → 주문번호: ${proposalData.order_number}`);
    return NextResponse.json({ order_number: proposalData.order_number });
  }

  // 두 테이블 모두에서 못 찾은 경우
  console.warn(`❗ post_id ${postId}에 해당하는 주문번호가 양쪽 테이블에서 모두 없습니다.`);
  return NextResponse.json({ 
    order_number: null,
    message: "해당 게시물에 대한 구매 기록이 없습니다.",
    post_id: postId 
  }, { status: 200 });
} 