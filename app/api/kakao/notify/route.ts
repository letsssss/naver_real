import { NextResponse } from 'next/server';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

// 초간단 진입점 확인 로그
console.log('🌐 API 진입');
console.log('🔑 API_KEY:', process.env.SOLAPI_API_KEY);

// 가장 간단한 응답 함수
export async function POST() {
  console.log('📣 POST 함수 호출됨');
  console.log('🔑 POST 내부 API_KEY:', process.env.SOLAPI_API_KEY);
  
  return NextResponse.json({ 
    success: true, 
    message: 'API 호출 확인',
    env: {
      hasApiKey: !!process.env.SOLAPI_API_KEY,
      apiKeyType: typeof process.env.SOLAPI_API_KEY
    }
  });
} 