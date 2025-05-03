import { SolapiMessageService } from 'solapi';

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
  MESSAGE_RECEIVED: 'KA01TP230126085130773ZHclHN4i674', // 새 메시지 알림
  PURCHASE_COMPLETED: 'KA01TP231103085130773ZHclHN4i674', // 구매 완료 알림
  TICKET_CONFIRMED: 'KA01TP230505085130773ZHclHN4i674', // 티켓 확정 알림
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
  return sendKakaoNotification(
    to,
    TEMPLATE_IDS.MESSAGE_RECEIVED,
    {
      '#{이름}': name || '고객'
    }
  );
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
      '#{이름}': name || '고객',
      '#{주문번호}': orderNumber,
      '#{상품명}': productName,
      '#{가격}': price
    }
  );
}

/**
 * 티켓 확정 알림톡 발송
 */
export async function sendTicketConfirmedNotification(
  to: string,
  name: string,
  ticketNumber: string,
  eventName: string,
  dateTime: string
) {
  return sendKakaoNotification(
    to,
    TEMPLATE_IDS.TICKET_CONFIRMED,
    {
      '#{이름}': name || '고객',
      '#{티켓번호}': ticketNumber,
      '#{공연명}': eventName,
      '#{일시}': dateTime
    }
  );
} 