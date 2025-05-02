import { NextResponse } from 'next/server';
import axios from 'axios';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

// 초기 진입점 확인 로그
console.log('🌐 API 진입');
console.log('🔑 API_KEY:', process.env.SOLAPI_API_KEY);

// 카카오 알림톡 전송 함수
export async function POST(request: Request) {
  console.log('📣 POST 함수 호출됨:', new Date().toISOString());
  console.log('🔑 POST 내부 API_KEY:', process.env.SOLAPI_API_KEY);
  
  try {
    // 요청 파싱
    const body = await request.json();
    console.log('📩 요청 데이터:', JSON.stringify(body, null, 2));
    
    const { to, name } = body;
    if (!to) {
      return NextResponse.json({ 
        success: false, 
        error: '전화번호가 필요합니다.' 
      }, { status: 400 });
    }
    
    // 이름 검증 로그 추가
    console.log('🧪 name 변수 타입:', typeof name);
    console.log('🧪 name 변수 값:', name);
    console.log('🧪 name 변수 null/undefined 여부:', name === null ? 'null' : (name === undefined ? 'undefined' : 'has value'));
    
    // 전화번호 하이픈 제거
    const phoneNumber = to.replace(/-/g, '');
    
    // API 키 준비
    const apiKey = process.env.SOLAPI_API_KEY ?? "NCSLR9HLUEOHFVAK";
    const apiSecret = process.env.SOLAPI_API_SECRET ?? "Z4YNIAOR6RN5LO6VWNB8NA4LWSSOPHIE";
    const SOLAPI_SENDER_KEY = process.env.SOLAPI_SENDER_KEY || 'KA01PF2504270350090645hp8rQ1lvqL';
    const SOLAPI_TEMPLATE_CODE = process.env.SOLAPI_TEMPLATE_CODE || 'KA01TP230126085130773ZHcIHN4i674';
    const SENDER_PHONE = process.env.SENDER_PHONE || '01056183450';
    
    // 값 검증
    console.log('🔍 Solapi 필수 값 점검:');
    console.log('- API Key:', typeof apiKey, apiKey ? '설정됨' : '미설정');
    console.log('- API Secret:', typeof apiSecret, apiSecret ? '설정됨' : '미설정');
    console.log('- Sender Key:', SOLAPI_SENDER_KEY);
    console.log('- Template Code:', SOLAPI_TEMPLATE_CODE);
    console.log('- To:', phoneNumber);
    
    // [수정] 변수 처리 최적화
    const variables = {
      [`홍길동`]: String(name || '고객'),
      [`url`]: 'https://easyticket82.com/mypage'
    };
    
    // [추가] 변수 구조 검증 로그
    console.log('🧪 kakaoOptions.variables 타입:', typeof variables);
    console.log('🧪 kakaoOptions.variables 정확히:', JSON.stringify(variables));
    console.log('🧪 변수 키 확인:', Object.keys(variables));
    
    // API 요청 데이터 구성
    const apiRequestData = {
      apiKey: String(apiKey),
      apiSecret: String(apiSecret),
      message: {
        to: phoneNumber,
        from: SENDER_PHONE,
        type: 'ATA', // 알림톡 타입
        kakaoOptions: {
          pfId: SOLAPI_SENDER_KEY,
          templateId: SOLAPI_TEMPLATE_CODE,
          variables, // 최적화된 변수 사용
          disableSms: false // SMS 대체 발송 활성화
        }
      }
    };
    
    // 민감정보 마스킹
    const logData = {
      ...apiRequestData,
      apiKey: apiRequestData.apiKey.substring(0, 4) + '****',
      apiSecret: apiRequestData.apiSecret.substring(0, 4) + '****'
    };
    
    // [추가] API 요청 데이터 내 template 변수 확인
    console.log('🧪 최종 요청의 variables 구조:', JSON.stringify(apiRequestData.message.kakaoOptions.variables, null, 2));
    
    // API 요청 직전 로그
    console.log('📡 Solapi에 요청 직전:', JSON.stringify(logData, null, 2));
    console.log('📡 Solapi 요청 URL: https://api.solapi.com/messages/v4/send');
    
    // Solapi API 호출
    const response = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      apiRequestData,
      {
        headers: {
          Authorization: `HMAC-SHA256 ${String(apiKey)}:${String(apiSecret)}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // API 호출 직후 응답 로그
    console.log('📡 Solapi 응답 수신:', response.status, JSON.stringify(response.data, null, 2));
    
    // 응답 검증
    const hasGroupId = !!response.data?.groupId;
    const hasMessageId = !!response.data?.messageId;
    
    console.log('✅ 응답 검증:');
    console.log('- Status Code:', response.status);
    console.log('- Group ID:', hasGroupId ? response.data.groupId : '없음 ⚠️');
    console.log('- Message ID:', hasMessageId ? response.data.messageId : '없음 ⚠️');
    
    if (!hasGroupId && !hasMessageId) {
      console.warn('⚠️ 주의: Solapi 응답에 groupId와 messageId가 없습니다. 실제 발송되지 않았을 수 있습니다.');
    }
    
    // 정상 응답
    return NextResponse.json({ 
      success: true, 
      message: '알림톡 발송 요청 완료',
      verification: {
        hasGroupId,
        hasMessageId,
        status: response.status
      },
      data: response.data
    });
    
  } catch (error: any) {
    console.error('❌ 에러 발생:', error.message || error);
    
    // Axios 에러인 경우
    if (axios.isAxiosError(error)) {
      console.error('📡 Axios 에러 세부정보:');
      console.error('- Status:', error.response?.status);
      console.error('- Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('- Error Config:', error.config?.url, error.config?.method);
      
      // [추가] 요청 데이터 파싱 에러 확인
      if (error.response?.data?.message?.includes('variables')) {
        console.error('⚠️ variables 형식 오류 가능성 높음!');
        
        try {
          // 요청 데이터 파싱
          const reqData = JSON.parse(error.config?.data || '{}');
          console.error('🧪 요청 시 보낸 variables:', 
            JSON.stringify(reqData?.message?.kakaoOptions?.variables, null, 2));
        } catch (e) {
          console.error('🧪 요청 데이터 파싱 실패');
        }
      }
      
      const statusCode = error.response?.status || 500;
      return NextResponse.json({
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data
      }, { status: statusCode });
    }
    
    // 일반 에러
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 오류'
    }, { status: 500 });
  }
} 