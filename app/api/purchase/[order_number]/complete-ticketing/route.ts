// 목적: 주문번호(order_number)로 특정 구매의 상태를 'COMPLETED'로 업데이트하는 Supabase 기반 API

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  const { order_number } = params;

  if (!order_number) {
    return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("purchases")
    .update({
      status: "COMPLETED",
      updated_at: new Date().toISOString(),
    })
    .eq("order_number", order_number);

  if (error) {
    console.error("취켓팅 완료 처리 중 오류:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
} 