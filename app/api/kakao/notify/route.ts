import { NextResponse } from 'next/server';
import axios from 'axios';

// 환경 변수에서 API 키 가져오기
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY!;
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET!;
// 실제 발신자 정보 설정
const SOLAPI_SENDER_KEY = process.env.SOLAPI_SENDER_KEY || 'KA01PF2504270350090645hp8rQ1lvqL';
const SOLAPI_TEMPLATE_CODE = process.env.SOLAPI_TEMPLATE_CODE || 'KA01TP230126085130773ZHcIHN4i674';
const SENDER_PHONE = process.env.SENDER_PHONE || '01056183450'; // 하이픈 제거된 형식

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
    
    // 환경 변수 확인
    console.log('🔑 API 키 확인:', !!SOLAPI_API_KEY, !!SOLAPI_API_SECRET, !!SOLAPI_SENDER_KEY, !!SOLAPI_TEMPLATE_CODE);
    
    // Solapi API 호출을 위한 인증 헤더 생성
    const authorizationToken = Buffer.from(`${SOLAPI_API_KEY}:${SOLAPI_API_SECRET}`).toString('base64');
    
    // API 요청 데이터 구성 (text 필드 제거하고 간소화)
    const apiRequestData = {
      to: phoneNumber,
      from: SENDER_PHONE,
      type: 'ATA', // 알림톡 타입
      kakaoOptions: {
        pfId: SOLAPI_SENDER_KEY,
        templateId: SOLAPI_TEMPLATE_CODE,
        variables: {
          '홍길동': name || '고객',
          'url': 'https://easyticket82.com/mypage' // 버튼에 사용되는 필수 URL 변수
        },
        disableSms: false // SMS 대체 발송 활성화
      }
    };
    
    console.log('📝 Solapi 요청 데이터:', JSON.stringify(apiRequestData, null, 2));
    
    // 카카오 알림톡 전송 (실제 템플릿 코드와 발신 프로필 키 사용)
    const response = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      apiRequestData,
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
    console.error('🔍 에러 상세 정보:', error.response?.data);
    
    if (error.response?.data) {
      console.error('🔎 자세한 에러 메시지:', JSON.stringify(error.response?.data, null, 2));
      console.error('🔎 에러 코드:', error.response?.data?.errorCode);
      console.error('🔎 에러 메시지:', error.response?.data?.errorMessage);
    }
    
    console.error('🔍 에러 상태 코드:', error.response?.status);
    console.error('🔍 에러 헤더:', error.response?.headers);
    
    // 에러 응답 구성
    const errorMessage = error.response?.data?.errorMessage || error.message || '알 수 없는 오류';
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