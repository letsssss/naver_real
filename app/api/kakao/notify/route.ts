import { NextResponse } from 'next/server';
import axios from 'axios';

// 환경 변수에서 API 키 가져오기
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY!;
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET!;
const SOLAPI_SENDER_KEY = process.env.SOLAPI_SENDER_KEY || '';
const SOLAPI_TEMPLATE_CODE = process.env.SOLAPI_TEMPLATE_CODE || 'NEW_MESSAGE_01'; // 메시지 도착 알림용 템플릿 코드
const SENDER_PHONE = process.env.SENDER_PHONE || '07012345678'; // 등록된 발신 번호

export async function POST(request: Request) {
  try {
    // 요청 본문에서 데이터 추출
    const body = await request.json();
    const { to, name, message = '새 메시지가 도착했습니다.' } = body;
    
    // 전화번호 형식 검증
    if (!to || !/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(to)) {
      return NextResponse.json(
        { error: '유효하지 않은 전화번호 형식입니다.' },
        { status: 400 }
      );
    }
    
    // 전화번호에서 하이픈 제거
    const phoneNumber = to.replace(/-/g, '');
    
    console.log(`🔔 카카오 알림톡 전송 시도: ${name}님(${phoneNumber})에게 알림 발송`);
    
    // 알림톡 내용 구성
    const content = `${name}님, 이지티켓에 새로운 메시지가 도착했습니다. 확인해보세요!`;
    
    // Solapi API 호출을 위한 인증 헤더 생성
    const authorizationToken = Buffer.from(`${SOLAPI_API_KEY}:${SOLAPI_API_SECRET}`).toString('base64');
    
    // 카카오 알림톡 전송
    const response = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      {
        message: {
          to: phoneNumber,
          from: SENDER_PHONE,
          text: content,
          type: 'ATA', // 알림톡 타입
          kakaoOptions: {
            pfId: SOLAPI_SENDER_KEY,
            templateId: SOLAPI_TEMPLATE_CODE,
            disableSms: false // SMS 대체 발송 활성화
          }
        }
      },
      {
        headers: {
          Authorization: `Basic ${authorizationToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 카카오 알림톡 전송 성공:', response.data);
    
    return NextResponse.json({ 
      success: true, 
      message: '알림톡이 성공적으로 전송되었습니다.',
      recipient: { name, phone: phoneNumber }
    });
    
  } catch (error: any) {
    console.error('❌ 카카오 알림톡 전송 실패:', error);
    
    // 에러 응답 구성
    const errorMessage = error.response?.data?.message || error.message || '알 수 없는 오류';
    const statusCode = error.response?.status || 500;
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error.response?.data
      },
      { status: statusCode }
    );
  }
} 