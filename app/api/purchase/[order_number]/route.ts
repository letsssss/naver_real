import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase"

export async function GET(req: Request, { params }: { params: { order_number: string } }) {
  try {
    const { order_number } = params
    
    if (!order_number) {
      console.error("주문번호가 제공되지 않았습니다.")
      return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { status: 400 })
    }
    
    console.log(`주문번호로 조회 시작: "${order_number}"`)
    
    // supabase 클라이언트 생성
    const supabaseAdmin = createAdminClient()
    console.log(`Supabase 클라이언트 생성 완료`)

    // 주문번호로 구매 내역 조회
    console.log(`purchases 테이블 조회 시작...`)
    const { data: purchase, error } = await supabaseAdmin
      .from('purchases')
      .select(`
        *,
        post:posts(*),
        buyer:users!buyer_id(*),
        seller:users!seller_id(*)
      `)
      .eq('order_number', order_number)
      .single()

    console.log(`쿼리 실행 결과:`, error ? `오류 발생: ${error.message}` : `데이터 조회 성공`)

    if (error) {
      console.error("Supabase 쿼리 오류:", error)
      return NextResponse.json({ error: `구매 내역 조회 오류: ${error.message}` }, { status: 500 })
    }

    if (!purchase) {
      console.log(`주문번호 "${order_number}"에 대한 구매 내역이 없습니다.`)
      return NextResponse.json({ error: "구매 내역이 존재하지 않습니다." }, { status: 404 })
    }

    console.log(`주문번호 "${order_number}" 데이터 반환 성공`)
    return NextResponse.json(purchase)
  } catch (err) {
    console.error("API 요청 처리 중 예외 발생:", err)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
} 
