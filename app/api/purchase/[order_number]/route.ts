import { NextResponse } from "next/server"
import { cookies } from 'next/headers'
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"

export async function GET(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  const { order_number } = params
  
  if (!order_number) {
    return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { status: 400 })
  }
  
  console.log(`[주문 조회 API] 주문번호로 조회 시작: ${order_number}`)
  
  // 서버 컴포넌트용 Supabase 클라이언트 생성
  const supabase = createServerComponentClient({ cookies })
  
  // 현재 로그인된 사용자 세션 확인
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('[주문 조회 API] 현재 사용자 세션:', { 
    userId: user?.id,
    email: user?.email,
    role: user?.role,
    error: userError
  })
  
  if (userError) {
    console.error("[주문 조회 API] 사용자 세션 오류:", userError)
    return NextResponse.json({ error: "인증 오류가 발생했습니다." }, { status: 401 })
  }

  // 먼저 purchases 테이블만 조회
  const { data: purchaseOnly, error: purchaseError } = await supabase
    .from("purchases")
    .select("*")
    .eq("order_number", order_number)
    .single()

  console.log('[주문 조회 API] purchases 테이블 조회 결과:', {
    success: !purchaseError,
    hasData: !!purchaseOnly,
    purchaseId: purchaseOnly?.id,
    error: purchaseError
  })

  // 전체 조인 쿼리 실행
  const { data, error } = await supabase
    .from("purchases")
    .select(`
      *,
      post:posts (
        *,
        author:author_id (
          id,
          name,
          profile_image
        )
      ),
      buyer:users!buyer_id (
        id,
        name,
        email
      ),
      seller:users!seller_id (
        id,
        name,
        email,
        profile_image
      )
    `)
    .eq("order_number", order_number)
    .single()
  
  console.log('[주문 조회 API] 전체 조인 쿼리 결과:', {
    success: !error,
    hasData: !!data,
    postData: data?.post,
    authorData: data?.post?.author,
    buyerData: data?.buyer,
    sellerData: data?.seller,
    error,
    orderNumber: order_number
  })
  
  if (error || !data) {
    console.error("[주문 조회 API] 주문번호 조회 오류:", error || "데이터 없음")
    return NextResponse.json({ 
      error: "해당 주문번호를 찾을 수 없습니다.",
      details: error?.message || "Unknown error"
    }, { status: 404 })
  }
  
  return NextResponse.json(data)
} 
