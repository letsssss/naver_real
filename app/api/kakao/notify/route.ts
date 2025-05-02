import { NextResponse } from 'next/server';
import axios from 'axios';

// 환경 변수 직접 로깅 (값과 타입 확인)
console.log('✅ process.env.SOLAPI_API_KEY:', process.env.SOLAPI_API_KEY);
console.log('✅ typeof process.env.SOLAPI_API_KEY:', typeof process.env.SOLAPI_API_KEY);
console.log('✅ process.env.SOLAPI_API_SECRET:', process.env.SOLAPI_API_SECRET);
console.log('✅ typeof process.env.SOLAPI_API_SECRET:', typeof process.env.SOLAPI_API_SECRET);

// 환경 변수에서 API 키 가져오기 (비상 테스트용 fallback 값 설정)
// 주의: 이 값들은 테스트 후 반드시 제거하세요!
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || "NCSLR9HLUEOHFVAK"; // 테스트 후 제거 필수
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || "Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE"; // 테스트 후 제거 필수
// 실제 발신자 정보 설정
const SOLAPI_SENDER_KEY = process.env.SOLAPI_SENDER_KEY || 'KA01PF2504270350090645hp8rQ1lvqL';
const SOLAPI_TEMPLATE_CODE = process.env.SOLAPI_TEMPLATE_CODE || 'KA01TP230126085130773ZHcIHN4i674';
const SENDER_PHONE = process.env.SENDER_PHONE || '01056183450'; // 하이픈 제거된 형식

// 환경 변수 값 자세히 로깅 (undefined 확인용)
console.log('✅ 환경 변수 확인', {
  apiKey: process.env.SOLAPI_API_KEY,
  apiSecret: process.env.SOLAPI_API_SECRET,
  senderKey: process.env.SOLAPI_SENDER_KEY,
  templateCode: process.env.SOLAPI_TEMPLATE_CODE,
  phone: process.env.SENDER_PHONE,
});

// 환경 변수 타입 디버깅
console.log('[DEBUG] SOLAPI_API_KEY:', SOLAPI_API_KEY);
console.log('[DEBUG] typeof SOLAPI_API_KEY:', typeof SOLAPI_API_KEY);
console.log('[DEBUG] SOLAPI_API_SECRET:', SOLAPI_API_SECRET);
console.log('[DEBUG] typeof SOLAPI_API_SECRET:', typeof SOLAPI_API_SECRET);

// 최종 사용 값 확인
console.log('🔐 최종 사용되는 SOLAPI_API_KEY:', SOLAPI_API_KEY);
console.log('🔐 최종 사용되는 SOLAPI_API_SECRET:', SOLAPI_API_SECRET);

export async function POST(request: Request) {
  try {
    // 환경변수 유효성 검사
    if (!SOLAPI_API_KEY || typeof SOLAPI_API_KEY !== 'string') {
      console.error('❌ SOLAPI_API_KEY가 설정되지 않았거나 문자열이 아닙니다', SOLAPI_API_KEY);
      return NextResponse.json(
        { error: 'API 키가 올바르게 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (!SOLAPI_API_SECRET || typeof SOLAPI_API_SECRET !== 'string') {
      console.error('❌ SOLAPI_API_SECRET이 설정되지 않았거나 문자열이 아닙니다', SOLAPI_API_SECRET);
      return NextResponse.json(
        { error: 'API 시크릿이 올바르게 설정되지 않았습니다.' },
        { status: 500 }
      );
    }
    
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
    
    // API 요청 데이터 구성 (본문에도 인증 정보 포함)
    const apiRequestData = {
      apiKey: SOLAPI_API_KEY,
      apiSecret: SOLAPI_API_SECRET,
      message: {
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
      }
    };
    
    console.log('📝 Solapi 요청 데이터:', JSON.stringify(apiRequestData, null, 2));
    
    // 카카오 알림톡 전송 (헤더와 본문 모두에 인증 정보 포함)
    const response = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      apiRequestData,
      {
        headers: {
          Authorization: `HMAC-SHA256 ${SOLAPI_API_KEY}:${SOLAPI_API_SECRET}`,
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