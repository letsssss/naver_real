import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase"

export async function GET(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  const { order_number } = params
  
  if (!order_number) {
    return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { status: 400 })
  }
  
  console.log(`주문번호로 조회: ${order_number}`)
  
  const supabase = createAdminClient()
  
  const { data, error } = await supabase
    .from("purchases")
    .select("*, post:posts(*), buyer:users!buyer_id(*), seller:users!seller_id(*)")
    .eq("order_number", order_number)
    .maybeSingle()

  if (error || !data) {
    console.error("주문번호 조회 오류:", error || "데이터 없음")
    return NextResponse.json({ error: "해당 주문번호를 찾을 수 없습니다." }, { status: 404 })
  }
  
  return NextResponse.json(data)
} 
