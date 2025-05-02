import { NextResponse } from 'next/server';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
export const runtime = 'nodejs';

// 초간단 진입점 확인 로그
console.log('🌐 API 엔드포인트 진입 확인됨');
console.log('🔑 SOLAPI_API_KEY 확인:', typeof process.env.SOLAPI_API_KEY, process.env.SOLAPI_API_KEY);
console.log('🔑 process.env.SOLAPI_API_KEY가 undefined인지:', process.env.SOLAPI_API_KEY === undefined);
console.log('🔑 SOLAPI_API_SECRET 확인:', typeof process.env.SOLAPI_API_SECRET, process.env.SOLAPI_API_SECRET);

// 간단한 테스트 함수
export async function POST(request: Request) {
  console.log('📣 POST 함수 실행됨:', new Date().toISOString());
  console.log('🔑 POST 내부 SOLAPI_API_KEY 확인:', typeof process.env.SOLAPI_API_KEY, process.env.SOLAPI_API_KEY);
  
  try {
    // 요청 테스트
    const body = await request.json();
    console.log('📩 요청 데이터:', JSON.stringify(body, null, 2));
    
    // 환경변수 테스트
    const apiKey = process.env.SOLAPI_API_KEY ?? "FALLBACK_KEY";
    const hasApiKey = !!process.env.SOLAPI_API_KEY;
    
    // 응답 반환
    return NextResponse.json({ 
      success: true, 
      message: '진단 완료',
      diagnostics: {
        hasApiKey,
        apiKeyType: typeof process.env.SOLAPI_API_KEY,
        apiKeyExists: process.env.SOLAPI_API_KEY !== undefined,
        fallbackUsed: apiKey === "FALLBACK_KEY",
        nodeEnv: process.env.NODE_ENV,
        runtimeChecked: 'nodejs'
      }
    });
    
  } catch (error: any) {
    console.error('❌ 에러 발생:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '알 수 없는 오류',
      diagnostics: {
        errorType: typeof error,
        apiKeyType: typeof process.env.SOLAPI_API_KEY,
        apiKeyExists: process.env.SOLAPI_API_KEY !== undefined
      }
    }, { status: 500 });
  }
} 