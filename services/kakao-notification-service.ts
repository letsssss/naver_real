import { SolapiMessageService } from 'solapi';
import { canSendKakao, updateKakaoSendLog } from '@/lib/kakaoRateLimiter';

/**
 * 환경 변수에서 Solapi 관련 설정을 가져옵니다.
 */
const apiKey = process.env.SOLAPI_API_KEY!;
const apiSecret = process.env.SOLAPI_API_SECRET!;
const senderPhone = process.env.SENDER_PHONE || '01056183450';
const pfId = process.env.SOLAPI_SENDER_KEY || 'KA01PF2504270350090645hp8rQ1lvqL';

/**
 * 솔라피 메시지 서비스 인스턴스 생성
 */
const messageService = new SolapiMessageService(apiKey, apiSecret);

/**
 * 템플릿 ID 상수 정의
 */
export const TEMPLATE_IDS = {
  MESSAGE_RECEIVED: 'KA01TP250508063617110QiNaxKtR9hh', // 새 메시지 알림
  PURCHASE_COMPLETED: 'KA01TP250527062936945b1jw7p4JGYO', // 구매 완료 알림 (결제 완료)
  TICKET_CONFIRMED: 'KA01TP250527070141848BAQWt8wxefl', // 티켓 확정 알림 (취켓팅 완료)
  ORDER_CONFIRMED: 'KA01TP250527071135667PUs7RoqR0uY', // 주문 확정 알림 (구매 확정)
  ORDER_CANCELLED: 'KA01TP250527071405650QUS38avv00S', // 거래 취소 알림
};

/**
 * 기본 알림톡 발송 함수
 * @param to 수신자 전화번호
 * @param templateId 알림톡 템플릿 ID
 * @param variables 치환 변수
 * @returns 발송 결과
 */
export async function sendKakaoNotification(
  to: string,
  templateId: string,
  variables: Record<string, string> = {}
) {
  try {
    // 전화번호 하이픈 제거
    const phoneNumber = to.replace(/-/g, '');
    
    console.log(`📣 알림톡 발송: ${templateId} → ${phoneNumber}`);
    
    const response = await messageService.send({
      to: phoneNumber, 
      from: senderPhone,
      kakaoOptions: {
        pfId: pfId,
        templateId: templateId,
        variables: variables,
      },
    });
    
    console.log('✅ 발송 완료:', response);
    
    return {
      success: true,
      messageId: (response as any).messageId,
      data: response
    };
  } catch (error: any) {
    console.error('❌ 발송 실패:', error);
    
    return {
      success: false,
      error: error.message || '알 수 없는 오류'
    };
  }
}

/**
 * 새 메시지 알림톡 발송
 */
export async function sendNewMessageNotification(to: string, name: string) {
  const phoneNumber = to.replace(/-/g, '');

  const canSend = await canSendKakao(phoneNumber, 'NEW_MESSAGE');
  if (!canSend) {
    console.log('⏱️ [NEW_MESSAGE] 최근 10분 내 발송 기록 있음 → 생략');
    return { success: false, reason: 'cooldown' };
  }

  const result = await sendKakaoNotification(
    to,
    TEMPLATE_IDS.MESSAGE_RECEIVED,
    {
      '#{이름}': name || '고객',
      '#{url}': 'www.easyticket82.com/ticket-cancellation'
    }
  );

  if (result.success) {
    await updateKakaoSendLog(phoneNumber, 'NEW_MESSAGE');
  }

  return result;
}

/**
 * 구매 완료 알림톡 발송
 */
export async function sendPurchaseCompletedNotification(
  to: string,
  name: string,
  orderNumber: string,
  productName: string,
  price: string
) {
  return sendKakaoNotification(
    to,
    TEMPLATE_IDS.PURCHASE_COMPLETED,
    {
      '#{상품}': productName,
      '#{주문번호}': orderNumber
    }
  );
}

/**
 * 티켓 확정 알림톡 발송 (취켓팅 완료)
 */
export async function sendTicketConfirmedNotification(
  to: string,
  name: string,
  orderNumber: string,
  productName: string
) {
  return sendKakaoNotification(
    to,
    TEMPLATE_IDS.TICKET_CONFIRMED,
    {
      '#{상품}': productName,
      '#{주문번호}': orderNumber
    }
  );
}

/**
 * 주문 확정 알림톡 발송 (구매 확정)
 */
export async function sendOrderConfirmedNotification(
  to: string,
  name: string,
  orderNumber: string,
  productName: string
) {
  return sendKakaoNotification(
    to,
    TEMPLATE_IDS.ORDER_CONFIRMED,
    {
      '#{상품}': productName,
      '#{주문번호}': orderNumber
    }
  );
}

/**
 * 거래 취소 알림톡 발송
 */
export async function sendOrderCancelledNotification(
  to: string,
  name: string,
  orderNumber: string,
  productName: string
) {
  return sendKakaoNotification(
    to,
    TEMPLATE_IDS.ORDER_CANCELLED,
    {
      '#{상품}': productName,
      '#{주문번호}': orderNumber
    }
  );
} 