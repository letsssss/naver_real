import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendTicketConfirmedNotification } from '@/services/kakao-notification-service';

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

  // 먼저 현재 구매 정보를 조회
  const { data: purchaseData, error: fetchError } = await supabase
    .from("purchases")
    .select(`
      *,
      post:posts(*),
      buyer:users!purchases_buyer_id_fkey(id, name, phone_number)
    `)
    .eq("id", id)
    .single();

  if (fetchError || !purchaseData) {
    console.error("구매 정보 조회 실패:", fetchError);
    return NextResponse.json({ error: "구매 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  // 상태 업데이트
  const { error } = await supabase
    .from("purchases")
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("상태 업데이트 실패:", error);
    return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  // 🔔 취켓팅 완료 시 구매자에게 알림톡 발송
  if (status === 'COMPLETED') {
    try {
      console.log("📱 취켓팅 완료 알림톡 발송 시작");
      
      const buyerData = purchaseData.buyer;
      const postData = purchaseData.post;
      
      if (buyerData && buyerData.phone_number) {
        const productName = postData?.title || postData?.event_name || '티켓';
        const orderNumber = purchaseData.order_number || purchaseData.id.toString();
        
        console.log(`📞 구매자 ${buyerData.name}(${buyerData.phone_number})에게 취켓팅 완료 알림톡 발송`);
        
        const result = await sendTicketConfirmedNotification(
          buyerData.phone_number,
          buyerData.name || '구매자',
          orderNumber,
          productName
        );
        
        if (result.success) {
          console.log("✅ 취켓팅 완료 알림톡 발송 성공");
        } else {
          console.error("❌ 취켓팅 완료 알림톡 발송 실패:", result.error);
        }
      } else {
        console.log("⚠️ 구매자 전화번호 없음: 취켓팅 완료 알림톡 발송 건너뜀");
      }
      
    } catch (kakaoError) {
      console.error("❌ 취켓팅 완료 알림톡 발송 중 오류:", kakaoError);
      // 알림톡 발송 실패해도 상태 업데이트는 성공으로 처리
    }
  }

  return NextResponse.json({ message: "상태가 성공적으로 업데이트되었습니다." });
} 