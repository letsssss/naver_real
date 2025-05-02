import { NextResponse } from 'next/server';
import axios from 'axios';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
// 정확한 런타임 문자열 사용: 'nodejs' 또는 'edge'(default)
export const runtime = 'nodejs';

// 더 명확한 설정 (Next.js 문서 기준)
export const maxDuration = 10; // 최대 실행 시간 (초)

// 단순 테스트용 함수
export async function POST(request: Request) {
  // 시작 시간 기록 (처리 시간 측정용)
  const startTime = new Date();
  console.log("🕒 요청 시작 시간:", startTime.toISOString());
  
  try {
    // Node.js 런타임 확인
    console.log("🔍 RUNTIME CHECK ============================");
    console.log("✅ 현재 런타임은 nodejs입니다");
    console.log("✅ Node.js 버전:", process.version);
    console.log("✅ 실행 환경:", process.env.NODE_ENV);
    
    // 환경 변수 확인
    console.log("🔑 ENV VARIABLES CHECK ====================");
    console.log("✅ process.env.SOLAPI_API_KEY:", process.env.SOLAPI_API_KEY);
    console.log("✅ process.env.SOLAPI_API_KEY 타입:", typeof process.env.SOLAPI_API_KEY);
    console.log("✅ process.env.SOLAPI_API_SECRET:", process.env.SOLAPI_API_SECRET);
    console.log("✅ process.env.SOLAPI_API_SECRET 타입:", typeof process.env.SOLAPI_API_SECRET);
    
    // SOLAPI 환경 변수 검색
    const solapiKeys = Object.keys(process.env).filter(key => key.includes('SOLAPI'));
    console.log("✅ SOLAPI 관련 환경 변수 키들:", solapiKeys);
    
    // API 키 값 설정 (환경 변수 또는 폴백 값 사용)
    const apiKey = process.env.SOLAPI_API_KEY ?? "NCSLR9HLUEOHFVAK";
    const apiSecret = process.env.SOLAPI_API_SECRET ?? "Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE";
    
    // API 키 값 타입 확인 및 검증
    console.log("🔐 API 키 값 확인 =======================");
    console.log("✅ apiKey 타입:", typeof apiKey);
    console.log("✅ apiKey 값:", apiKey);
    console.log("✅ apiSecret 타입:", typeof apiSecret);
    
    // 문자열 타입 보장 (String 생성자 사용)
    const stringApiKey = String(apiKey);
    const stringApiSecret = String(apiSecret);
    
    console.log("✅ 최종 사용 apiKey 타입:", typeof stringApiKey);
    console.log("✅ 최종 사용 apiSecret 타입:", typeof stringApiSecret);
    
    // 요청 본문 파싱
    const body = await request.json();
    console.log("📩 요청 데이터:", JSON.stringify(body, null, 2));
    
    const { to, name, message = '새 메시지가 도착했습니다.' } = body;
    
    // 전화번호 검증
    if (!to || !/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(to)) {
      console.error("❌ 유효하지 않은 전화번호:", to);
      return NextResponse.json(
        { error: '유효하지 않은 전화번호 형식입니다.' },
        { status: 400 }
      );
    }
    
    // 전화번호에서 하이픈 제거
    const phoneNumber = to.replace(/-/g, '');
    
    console.log(`🔔 카카오 알림톡 전송 시도: ${name}님(${phoneNumber})에게 알림 발송`);
    
    // 발신자 정보 설정
    const SOLAPI_SENDER_KEY = process.env.SOLAPI_SENDER_KEY || 'KA01PF2504270350090645hp8rQ1lvqL';
    const SOLAPI_TEMPLATE_CODE = process.env.SOLAPI_TEMPLATE_CODE || 'KA01TP230126085130773ZHcIHN4i674';
    const SENDER_PHONE = process.env.SENDER_PHONE || '01056183450';
    
    console.log("✅ SOLAPI_SENDER_KEY:", SOLAPI_SENDER_KEY);
    console.log("✅ SOLAPI_TEMPLATE_CODE:", SOLAPI_TEMPLATE_CODE);
    
    // API 요청 데이터 구성
    const apiRequestData = {
      apiKey: stringApiKey,
      apiSecret: stringApiSecret,
      message: {
        to: phoneNumber,
        from: SENDER_PHONE,
        type: 'ATA', // 알림톡 타입
        kakaoOptions: {
          pfId: SOLAPI_SENDER_KEY,
          templateId: SOLAPI_TEMPLATE_CODE,
          variables: {
            '홍길동': name || '고객',
            'url': 'https://easyticket82.com/mypage'
          },
          disableSms: false // SMS 대체 발송 활성화
        }
      }
    };
    
    // 요청 데이터 로깅 (민감 정보 일부 마스킹)
    const logData = {
      ...apiRequestData,
      apiKey: apiRequestData.apiKey.substring(0, 4) + '****',
      apiSecret: apiRequestData.apiSecret.substring(0, 4) + '****'
    };
    
    console.log('📝 Solapi 요청 데이터:', JSON.stringify(logData, null, 2));
    console.log('🔍 Solapi 요청 데이터 내 apiKey 타입:', typeof apiRequestData.apiKey);
    
    // 카카오 알림톡 전송
    const response = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      apiRequestData,
      {
        headers: {
          Authorization: `HMAC-SHA256 ${stringApiKey}:${stringApiSecret}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 전송 소요 시간 계산
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000; // 초 단위
    
    console.log(`✅ 카카오 알림톡 전송 성공 (소요시간: ${duration}초):`, JSON.stringify(response.data, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      message: '알림톡이 성공적으로 전송되었습니다.',
      recipient: { name, phone: phoneNumber },
      duration: `${duration}초`
    });
    
  } catch (error: any) {
    // 에러 발생 시간 계산
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000; // 초 단위
    
    console.error(`❌ 카카오 알림톡 전송 실패 (소요시간: ${duration}초):`, error);
    
    // Axios 에러 상세 분석
    if (axios.isAxiosError(error)) {
      console.error('🧪 Axios 에러 전체 응답:', JSON.stringify(error.toJSON(), null, 2));
      console.error('🧪 Axios 요청 설정:', JSON.stringify(error.config, null, 2));
      
      // 요청 바디 로깅 (민감 정보 마스킹)
      if (error.config?.data) {
        try {
          const reqData = JSON.parse(error.config.data);
          const maskedData = {
            ...reqData,
            apiKey: reqData.apiKey ? reqData.apiKey.substring(0, 4) + '****' : undefined,
            apiSecret: reqData.apiSecret ? reqData.apiSecret.substring(0, 4) + '****' : undefined
          };
          console.error('🧪 요청 데이터:', JSON.stringify(maskedData, null, 2));
        } catch (e) {
          console.error('🧪 요청 데이터 파싱 실패:', error.config.data);
        }
      }
    }
    
    console.error('🔍 에러 상세 정보:', error.response?.data);
    
    if (error.response?.data) {
      console.error('🔎 자세한 에러 메시지:', JSON.stringify(error.response.data, null, 2));
      console.error('🔎 에러 코드:', error.response.data.errorCode);
      console.error('🔎 에러 메시지:', error.response.data.errorMessage);
      
      // Solapi 에러 코드 해석
      const errorCode = error.response.data.errorCode;
      let errorDetail = '';
      
      if (errorCode === 'ValidationError') {
        errorDetail = '요청 데이터 검증 실패 (환경변수나 API 키를 확인하세요)';
      } else if (errorCode === 'AuthenticationError') {
        errorDetail = 'API 키 인증 실패 (API 키와 시크릿을 확인하세요)';
      } else if (errorCode === 'NotFoundError') {
        errorDetail = '리소스를 찾을 수 없음 (템플릿 ID 등을 확인하세요)';
      }
      
      console.error('🔎 에러 해석:', errorDetail || '알 수 없는 에러 코드');
      
      // Joi 검증 에러인 경우
      if (error.response.data.details) {
        console.error('🔎 Joi 검증 에러 상세:', JSON.stringify(error.response.data.details, null, 2));
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
        details: error.response?.data,
        errorType: axios.isAxiosError(error) ? 'AxiosError' : typeof error,
        duration: `${duration}초`
      },
      { status: statusCode }
    );
  }
} 