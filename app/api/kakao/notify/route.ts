import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { sendNewMessageNotification } from '@/services/kakao-notification-service';

// 반환 타입을 정의하여 타입 에러 해결
interface KakaoNotificationResult {
  success: boolean;
  messageId?: any;
  data?: any;
  error?: string;
  reason?: 'cooldown'; // rate limiting을 위한 추가 필드
  debugInfo?: any;
}

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

// 초기 진입점 확인 로그
console.log('🌐 카카오 알림 API 진입');

// 카카오 알림톡 전송 함수
export async function POST(req: NextRequest) {
  console.log('📣 카카오 알림 POST 함수 호출됨:', new Date().toISOString());
  
  // 환경 변수 디버깅 정보 추가
  console.log('🔑 환경 변수 확인:');
  console.log('SOLAPI_API_KEY 존재:', !!process.env.SOLAPI_API_KEY);
  console.log('SOLAPI_API_KEY 길이:', process.env.SOLAPI_API_KEY?.length || 0);
  console.log('SOLAPI_API_SECRET 존재:', !!process.env.SOLAPI_API_SECRET);
  console.log('SOLAPI_API_SECRET 길이:', process.env.SOLAPI_API_SECRET?.length || 0);

  try {
    // 요청 파싱
    const body = await req.json();
    console.log('📩 요청 데이터:', JSON.stringify(body, null, 2));
    
    const { to, name, message } = body;
    if (!to) {
      return NextResponse.json({ 
        success: false, 
        error: '전화번호가 필요합니다.' 
      }, { status: 400 });
    }
    
    // 이름 검증 로그 추가
    console.log('🧪 name 변수 타입:', typeof name);
    console.log('🧪 name 변수 값:', name);
    console.log('🧪 message 미리보기:', message ? message.substring(0, 30) : '없음');
    
    // URL 변수 추가
    const url = 'www.easyticket82.com/ticket-cancellation';
    console.log('🔗 URL 변수 추가됨:', url);
    
    // 새 메시지 알림 서비스 호출 - 메시지 정보도 활용
    // sendNewMessageNotification는 message 파라미터를 받지 않으므로
    // 일단 API만 받고 서비스에 전달하지 않음
    const result = await sendNewMessageNotification(to, name || '고객') as KakaoNotificationResult;
    
    if (result.success) {
      // 성공 응답
      return NextResponse.json({ 
        success: true, 
        message: '알림톡 발송 요청 완료',
        data: result
      });
    } else if (result.reason === 'cooldown') {
      // 제한 응답 (10분에 1회) - 디버깅 정보 추가
      return NextResponse.json({
        success: false,
        error: '최근 10분 내 이미 알림톡이 발송되었습니다.',
        reason: 'cooldown',
        debug: result.debugInfo || {
          currentTime: new Date().toISOString(),
          tenMinutesAgo: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          phoneNumber: to.replace(/-/g, ''),
          messageType: 'NEW_MESSAGE'
        }
      }, { status: 429 }); // 429 Too Many Requests
    } else {
      // 서비스 실패 응답 - 반환 값 구조에 맞게 수정
      return NextResponse.json({
        success: false,
        error: result.error || '알림톡 발송 중 오류가 발생했습니다.'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('❌ 일반 오류:', error.message || error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 오류'
    }, { status: 500 });
  }
} 