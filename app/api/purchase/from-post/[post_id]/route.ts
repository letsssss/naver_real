import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: { post_id: string } }
) {
  const postId = Number(params.post_id);

  if (isNaN(postId)) {
    return NextResponse.json({ error: "post_id가 숫자가 아닙니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("purchases")
    .select("order_number")
    .eq("post_id", postId)
    .order("created_at", { ascending: false }) // 최신 구매 기준
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Supabase 오류:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || !data.order_number) {
    console.warn(`❗ post_id ${postId}에 해당하는 주문번호가 없습니다.`);
    return NextResponse.json({ error: "주문번호가 존재하지 않습니다" }, { status: 404 });
  }

  console.log(`✅ post_id ${postId} → 주문번호: ${data.order_number}`);

  return NextResponse.json({ order_number: data.order_number });
} 