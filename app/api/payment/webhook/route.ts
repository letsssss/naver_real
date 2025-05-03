import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

export async function POST(request: Request) {
  console.log('📣 PortOne 웹훅 수신:', new Date().toISOString());
  
  try {
    // 웹훅 헤더 추출
    const webhookId = request.headers.get('webhook-id');
    const webhookSignature = request.headers.get('webhook-signature');
    const webhookTimestamp = request.headers.get('webhook-timestamp');
    
    // 헤더 검증
    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      console.error('❌ 웹훅 헤더 누락');
      return NextResponse.json({ success: false, error: '유효하지 않은 요청' }, { status: 400 });
    }
    
    // 요청 본문 추출
    const payload = await request.text();
    
    // 시그니처 검증
    if (!verifyWebhook(webhookId, webhookSignature, webhookTimestamp, payload)) {
      console.error('❌ 웹훅 시그니처 검증 실패');
      return NextResponse.json({ success: false, error: '유효하지 않은 시그니처' }, { status: 403 });
    }
    
    // 이벤트 데이터 파싱
    const data = JSON.parse(payload);
    console.log('📦 웹훅 데이터:', JSON.stringify(data, null, 2));
    
    // 이벤트 타입에 따른 처리
    const { type } = data;
    const paymentId = data.data?.paymentId;
    
    if (!paymentId) {
      console.error('❌ 결제 ID 누락');
      return NextResponse.json({ success: false, error: '결제 ID 누락' }, { status: 400 });
    }
    
    switch (type) {
      case 'Transaction.Paid':
        // TODO: 결제 완료 처리 (DB 업데이트 등)
        console.log('✅ 결제 완료:', paymentId);
        await handlePaymentSuccess(paymentId, data);
        break;
        
      case 'Transaction.Cancelled':
        // TODO: 결제 취소 처리
        console.log('🔄 결제 취소:', paymentId);
        await handlePaymentCancel(paymentId, data);
        break;
        
      case 'Transaction.Ready':
        console.log('🔍 결제창 오픈:', paymentId);
        break;
        
      default:
        console.warn('⚠️ 처리되지 않은 이벤트 타입:', type);
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ 웹훅 처리 오류:', error.message || error);
    return NextResponse.json({ success: false, error: error.message || '알 수 없는 오류' }, { status: 500 });
  }
}

/**
 * 웹훅 요청 검증
 */
function verifyWebhook(
  webhookId: string,
  actualSignature: string,
  timestamp: string,
  payload: string
): boolean {
  try {
    // 타임스탬프 검증 (5분 이내)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    
    if (Math.abs(now - requestTime) > 300) { // 5분 = 300초
      console.error('⏱️ 타임스탬프 만료:', now, requestTime);
      return false;
    }
    
    // 시그니처 생성 및 비교
    const secret = process.env.PORTONE_WEBHOOK_SECRET || '';
    if (!secret) {
      console.error('🔑 웹훅 시크릿 키가 설정되지 않음');
      return false;
    }
    
    const dataToSign = `${webhookId}.${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('base64');
      
    return expectedSignature === actualSignature;
  } catch (error) {
    console.error('🔐 시그니처 검증 오류:', error);
    return false;
  }
}

/**
 * 결제 성공 처리
 */
async function handlePaymentSuccess(paymentId: string, data: any) {
  // TODO: 데이터베이스에 결제 정보 업데이트
  // TODO: 검증을 위해 포트원 API 호출하여 결제 정보 확인
  console.log('💾 결제 성공 처리:', paymentId);
}

/**
 * 결제 취소 처리
 */
async function handlePaymentCancel(paymentId: string, data: any) {
  // TODO: 데이터베이스에 결제 취소 정보 업데이트
  console.log('💾 결제 취소 처리:', paymentId);
} 