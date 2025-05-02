import { NextResponse } from 'next/server';
import axios from 'axios';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

// 런타임 확인 로그 (가장 먼저 확인)
console.log("✅ 현재 런타임은 Node.js입니다");
console.log("✅ 함수 진입 시점 확인", new Date().toISOString());

// 환경 변수 직접 로깅 (값과 타입 확인) - 더 명확한 로깅 포맷
console.log('✅ SOLAPI_API_KEY 타입:', typeof process.env.SOLAPI_API_KEY);
console.log('✅ SOLAPI_API_KEY 값:', JSON.stringify(process.env.SOLAPI_API_KEY));
console.log('✅ SOLAPI_API_SECRET 타입:', typeof process.env.SOLAPI_API_SECRET);
console.log('✅ SOLAPI_API_SECRET 값:', JSON.stringify(process.env.SOLAPI_API_SECRET));

// 환경 변수 초기 상태 확인
console.log('🔎 process.env 내 SOLAPI_API_KEY 키 존재 여부:', 'SOLAPI_API_KEY' in process.env);
console.log('🔎 process.env 내 SOLAPI_API_SECRET 키 존재 여부:', 'SOLAPI_API_SECRET' in process.env);

// 💡 Joi 테스트를 위한 변수 설정 방식 변경 (추가 안전장치)
let rawApiKey = process.env.SOLAPI_API_KEY;
let rawApiSecret = process.env.SOLAPI_API_SECRET;

console.log('🔍 rawApiKey 초기값:', typeof rawApiKey, JSON.stringify(rawApiKey));

// 환경 변수에서 API 키 가져오기 (가장 엄격한 타입 체크와 fallback 로직)
// 새로운 방식: null 병합 연산자(??)를 사용하여 undefined만 처리
const SOLAPI_API_KEY = rawApiKey ?? "NCSLR9HLUEOHFVAK"; 
const SOLAPI_API_SECRET = rawApiSecret ?? "Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE";

// 값이 빈 문자열인지 체크하고 필요시 대체
const finalApiKey = (typeof SOLAPI_API_KEY === 'string' && SOLAPI_API_KEY.trim() !== '')
  ? SOLAPI_API_KEY.trim()
  : "NCSLR9HLUEOHFVAK";

const finalApiSecret = (typeof SOLAPI_API_SECRET === 'string' && SOLAPI_API_SECRET.trim() !== '')
  ? SOLAPI_API_SECRET.trim()
  : "Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE";

// 실제 발신자 정보 설정
const SOLAPI_SENDER_KEY = process.env.SOLAPI_SENDER_KEY || 'KA01PF2504270350090645hp8rQ1lvqL';
const SOLAPI_TEMPLATE_CODE = process.env.SOLAPI_TEMPLATE_CODE || 'KA01TP230126085130773ZHcIHN4i674';
const SENDER_PHONE = process.env.SENDER_PHONE || '01056183450'; // 하이픈 제거된 형식

// ===== 타입 검증 및 로깅 강화 =====
// 모든 중간 변수 상태 확인
console.log('⚠️ 최초 추출값:', {
  rawApiKey: typeof rawApiKey,
  SOLAPI_API_KEY: typeof SOLAPI_API_KEY,
  finalApiKey: typeof finalApiKey
});

// Joi 검증 테스트 - apiKey가 string인지 직접 확인
console.log('✅ Joi 전달 전 apiKey:', typeof finalApiKey, JSON.stringify(finalApiKey));

// 타입이 문자열이 아니면 강제 변환
const stringApiKey = String(finalApiKey);
console.log('✅ String()으로 강제 변환 후:', typeof stringApiKey, JSON.stringify(stringApiKey));

// 타입 강제 확인
if (typeof stringApiKey !== 'string') {
  console.error('🚨 심각: stringApiKey가 문자열이 아닙니다!', typeof stringApiKey);
  throw new Error('stringApiKey is not a string');
}

if (typeof finalApiSecret !== 'string') {
  console.error('🚨 심각: finalApiSecret이 문자열이 아닙니다!', typeof finalApiSecret);
  throw new Error('finalApiSecret is not a string');
}

// 환경 변수 값 자세히 로깅 (undefined 확인용)
console.log('✅ 환경 변수 확인', {
  rawApiKey: rawApiKey,
  apiKey: process.env.SOLAPI_API_KEY,
  apiSecret: process.env.SOLAPI_API_SECRET,
  senderKey: process.env.SOLAPI_SENDER_KEY,
  templateCode: process.env.SOLAPI_TEMPLATE_CODE,
  phone: process.env.SENDER_PHONE,
});

// 환경 변수 타입 디버깅
console.log('[DEBUG] rawApiKey:', typeof rawApiKey, rawApiKey);
console.log('[DEBUG] SOLAPI_API_KEY:', typeof SOLAPI_API_KEY, SOLAPI_API_KEY);
console.log('[DEBUG] finalApiKey:', typeof finalApiKey, finalApiKey);
console.log('[DEBUG] stringApiKey:', typeof stringApiKey, stringApiKey);

// 최종 사용 값 확인
console.log('🔐 최종 사용되는 SOLAPI_API_KEY:', stringApiKey);
console.log('🔐 최종 사용되는 SOLAPI_API_SECRET:', finalApiSecret);

export async function POST(request: Request) {
  try {
    // 가장 먼저 직접 환경변수 확인 - POST 함수 내부에서 확인
    console.log("🔍 [POST 함수 내부] process.env.SOLAPI_API_KEY =", process.env.SOLAPI_API_KEY);
    console.log("🔍 [POST 함수 내부] typeof process.env.SOLAPI_API_KEY =", typeof process.env.SOLAPI_API_KEY);
    
    // 직접 fallback 테스트
    const directApiKey = process.env.SOLAPI_API_KEY ?? "FALLBACK_API_KEY";
    console.log("🔍 [POST 함수 내부] typeof directApiKey =", typeof directApiKey, "value =", directApiKey);
    
    console.log('✉️ API 요청 수신:', new Date().toISOString());
    
    // 환경변수 유효성 검사
    if (!stringApiKey || typeof stringApiKey !== 'string') {
      console.error('❌ stringApiKey가 설정되지 않았거나 문자열이 아닙니다', stringApiKey);
      return NextResponse.json(
        { error: 'API 키가 올바르게 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    if (!finalApiSecret || typeof finalApiSecret !== 'string') {
      console.error('❌ finalApiSecret이 설정되지 않았거나 문자열이 아닙니다', finalApiSecret);
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
    console.log('🔑 API 키 확인:', !!stringApiKey, !!finalApiSecret, !!SOLAPI_SENDER_KEY, !!SOLAPI_TEMPLATE_CODE);
    
    // 요청 직전 API 키 최종 확인 - Joi 테스트 시뮬레이션
    console.log('✅ 최종 apiKey 타입:', typeof stringApiKey);
    console.log('✅ 최종 apiKey 값:', JSON.stringify(stringApiKey));
    console.log('✅ 최종 apiSecret 타입:', typeof finalApiSecret);
    
    // Joi 검증 상황 시뮬레이션
    const joiTestObj = {
      apiKey: stringApiKey,
      content: "테스트 메시지"
    };
    console.log('⚠️ Joi 검증 객체:', joiTestObj);
    console.log('⚠️ Joi apiKey 타입:', typeof joiTestObj.apiKey);
    
    // API 요청 데이터 구성 (본문에도 인증 정보 포함)
    // 최대한 안전하게 - String() 으로 한번 더 강제 변환
    const apiRequestData = {
      apiKey: String(stringApiKey),
      apiSecret: String(finalApiSecret),
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
    console.log('🔍 Solapi 요청 데이터 내 apiKey 타입:', typeof apiRequestData.apiKey);
    console.log('🔍 Solapi 요청 데이터 내 apiKey 값:', JSON.stringify(apiRequestData.apiKey));
    
    // 카카오 알림톡 전송 (헤더와 본문 모두에 인증 정보 포함)
    const response = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      apiRequestData,
      {
        headers: {
          Authorization: `HMAC-SHA256 ${String(stringApiKey)}:${String(finalApiSecret)}`,
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
      // Joi 에러인 경우 상세 정보 출력
      if (error.response?.data?.details) {
        console.error('🔎 Joi 검증 에러 상세:', JSON.stringify(error.response?.data?.details, null, 2));
      }
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