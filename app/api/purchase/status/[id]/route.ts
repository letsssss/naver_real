import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const { status } = await req.json();

  if (!id || !status) {
    return NextResponse.json({ error: "ID 또는 상태가 제공되지 않았습니다." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("purchases")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("상태 업데이트 실패:", error);
    return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "상태가 성공적으로 업데이트되었습니다." });
} 