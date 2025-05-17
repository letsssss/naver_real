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

  // 명시적으로 관계 지정해서 join (중복 관계 오류 해결)
  const { data, error } = await supabase
    .from("purchases")
    .select("*, post:posts(*), buyer:users!purchases_buyer_id_fkey(*)")
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

export async function POST(
  req: Request,
  { params }: { params: { order_number: string } }
) {
  const { order_number } = params
  
  if (!order_number) {
    return NextResponse.json({ error: "주문번호가 제공되지 않았습니다." }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "상태가 제공되지 않았습니다." }, { status: 400 })
    }

    // 유효한 상태값 검증
    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'CONFIRMED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태값입니다." }, { status: 400 })
    }

    const supabase = createAdminClient()
    
    // 주문 정보 조회
    const { data: purchase, error: queryError } = await supabase
      .from("purchases")
      .select("*")
      .eq("order_number", order_number)
      .single()

    if (queryError || !purchase) {
      console.error("주문 조회 오류:", queryError)
      return NextResponse.json({ error: "해당 주문을 찾을 수 없습니다." }, { status: 404 })
    }

    // 현재 상태와 동일한 상태로 업데이트하려는 경우
    if (purchase.status === status) {
      return NextResponse.json({ 
        message: "상태가 이미 동일합니다.",
        purchase
      })
    }

    // 상태 업데이트
    const { data: updatedPurchase, error: updateError } = await supabase
      .from("purchases")
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq("order_number", order_number)
      .select()
      .single()

    if (updateError) {
      console.error("상태 업데이트 오류:", updateError)
      return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 })
    }

    // 구매 확정(CONFIRMED) 상태일 때 수수료 정보 업데이트
    if (status === 'CONFIRMED') {
      try {
        console.log("✅ 예매 완료 → 수수료 계산 시작");
        console.log("🔑 purchase_id 확인:", purchase.id);
        console.log("🧾 order_number 확인:", order_number);
        
        if (!purchase.id) {
          console.error("❌ purchase.id 없음! 수수료 계산 불가");
        }
        
        // 총 가격 조회
        const totalPrice = purchase.total_price || 0;
        console.log("💰 total_price 확인:", totalPrice);
        
        // 수수료 계산 (총 가격의 10%, 소수점 버림)
        const feeAmount = Math.floor(totalPrice * 0.1);
        console.log("💸 feeAmount 계산 결과:", feeAmount);
        
        // 수수료 납부 기한 설정 (현재 시점 + 24시간)
        const feeDueAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
        
        console.log(`💰 수수료 계산: ${totalPrice} × 10% = ${feeAmount}원, 납부기한: ${feeDueAt.toISOString()}`);
        
        // 수수료 정보 업데이트
        const { data: updateResult, error: feeUpdateError } = await supabase
          .from('purchases')
          .update({
            fee_amount: feeAmount,
            fee_due_at: feeDueAt.toISOString(),
            // is_fee_paid는 기본값 false 유지
          })
          .eq('id', purchase.id)  // order_number 대신 id로 업데이트
          .select('id, fee_amount, fee_due_at, is_fee_paid');
        
        if (feeUpdateError) {
          console.error("❌ 수수료 정보 업데이트 실패:", feeUpdateError);
        } else {
          console.log("✅ 수수료 계산 및 저장 성공:", updateResult);
        }
      } catch (feeError) {
        console.error("❌ 수수료 처리 중 오류:", feeError);
        // 수수료 처리 실패해도 구매 확정은 완료된 것으로 처리
      }
    }

    return NextResponse.json({ 
      message: "상태가 성공적으로 업데이트되었습니다.",
      purchase: updatedPurchase
    })

  } catch (error) {
    console.error("요청 처리 오류:", error)
    return NextResponse.json({ error: "요청 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
} 
