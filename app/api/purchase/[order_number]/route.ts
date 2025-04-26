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
  
  // 환경변수 로그
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10))

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("purchases")
    .select(`
      *,
      post:posts(*),
      buyer:users!buyer_id(*),
      seller:users!seller_id(*)
    `)
    .eq("order_number", order_number)
    .single()

  // 쿼리 결과 로그
  console.log('🧪 조회된 데이터:', data)
  console.log('❌ 에러 발생:', error)

  if (error || !data) {
    console.error("주문번호 조회 오류:", error || "데이터 없음")
    return NextResponse.json({ error: "해당 주문번호를 찾을 수 없습니다." }, { status: 404 })
  }
  
  return NextResponse.json(data)
} 
