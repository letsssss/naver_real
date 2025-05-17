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
        console.log("\n===== 수수료 계산 디버깅 시작 =====");
        console.log("✅ 예매 완료 → 수수료 계산 시작");
        
        // purchaseId 확인 및 검증
        const purchaseId = purchase.id;
        console.log("🔑 purchaseId:", purchaseId, typeof purchaseId);
        console.log("🧾 order_number:", order_number);
        
        if (!purchaseId) {
          console.error("❌ purchaseId 없음! 수수료 계산 불가");
          throw new Error("purchaseId가 없어 수수료 계산을 진행할 수 없습니다.");
        }
        
        // 별도 조회로 total_price 재확인
        console.log("🔍 total_price 재조회 시작...");
        const { data: verifiedPurchase, error: verifyError } = await supabase
          .from('purchases')
          .select('id, total_price')
          .eq('id', purchaseId)
          .single();
        
        // 조회 결과 검증
        if (verifyError) {
          console.error("❌ purchaseId로 데이터 조회 실패:", verifyError);
          console.log("📛 전달된 purchaseId:", purchaseId);
          throw new Error(`purchaseId(${purchaseId})로 데이터 조회 실패: ${verifyError.message}`);
        }
        
        if (!verifiedPurchase) {
          console.error("❌ purchaseId로 데이터 조회 결과 없음:", purchaseId);
          throw new Error(`purchaseId(${purchaseId})로 조회된 데이터가 없습니다.`);
        }
        
        console.log("✅ 구매 데이터 조회 성공:", verifiedPurchase);
        
        // 총 가격 조회 및 검증
        const totalPrice = verifiedPurchase.total_price || 0;
        console.log("💰 total_price 확인:", totalPrice, typeof totalPrice);
        
        if (!totalPrice || totalPrice <= 0) {
          console.warn("⚠️ total_price가 0 이하입니다:", totalPrice);
        }
        
        // 수수료 계산 (총 가격의 10%, 소수점 버림)
        const feeAmount = Math.floor(totalPrice * 0.1);
        console.log("💸 feeAmount 계산 결과:", feeAmount);
        
        if (feeAmount <= 0 && totalPrice > 0) {
          console.warn("⚠️ 계산된 수수료가 0 이하입니다. 계산 로직 확인 필요:", feeAmount);
        }
        
        // 수수료 납부 기한 설정 (현재 시점 + 24시간)
        const feeDueAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
        
        console.log(`💰 수수료 계산: ${totalPrice} × 10% = ${feeAmount}원, 납부기한: ${feeDueAt.toISOString()}`);
        
        // 수수료 정보 업데이트 (강제 테스트 값 12345 포함)
        console.log("📝 수수료 정보 업데이트 시작...");
        const updateData = {
          fee_amount: feeAmount,
          fee_due_at: feeDueAt.toISOString(),
          test_field: 12345, // 테스트용 필드 (업데이트 확인용)
        };
        
        console.log("📦 업데이트할 데이터:", updateData);
        
        const { data: updateResult, error: feeUpdateError } = await supabase
          .from('purchases')
          .update(updateData)
          .eq('id', purchaseId)
          .select('id, fee_amount, fee_due_at, is_fee_paid, test_field');
        
        if (feeUpdateError) {
          console.error("❌ 수수료 정보 업데이트 실패:", feeUpdateError);
          throw new Error(`수수료 정보 업데이트 실패: ${feeUpdateError.message}`);
        }
        
        if (!updateResult || updateResult.length === 0) {
          console.error("❌ 수수료 업데이트 결과 없음:", purchaseId);
          throw new Error("수수료 정보가 업데이트되었으나 결과가 반환되지 않았습니다.");
        }
        
        console.log("✅ 수수료 계산 및 저장 성공:", updateResult);
        console.log("===== 수수료 계산 디버깅 종료 =====\n");
      } catch (feeError) {
        console.error("❌ 수수료 처리 중 오류:", feeError);
        console.log("💥 오류 발생 지점 디버깅 정보:", { 
          order_number, 
          purchase_id: purchase?.id,
          total_price: purchase?.total_price 
        });
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
