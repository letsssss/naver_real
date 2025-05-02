import { NextResponse } from 'next/server';

// Node.js 런타임으로 설정 (환경 변수 접근을 위해 필수)
// 정확한 런타임 문자열 사용: 'nodejs' 또는 'edge'(default)
export const runtime = 'nodejs';

// 더 명확한 설정 (Next.js 문서 기준)
export const maxDuration = 10; // 최대 실행 시간 (초)

// 단순 테스트용 함수
export async function POST(request: Request) {
  try {
    // 메모리 내 테스트 데이터
    const testData = {
      message: "This is a test message",
      timestamp: new Date().toISOString()
    };
    
    // 런타임 환경 체크 로그
    console.log("🔍 RUNTIME CHECK ============================");
    console.log("✅ 런타임 체크 - 현재 시간:", new Date().toISOString());
    console.log("✅ Node.js 버전:", process.version);
    console.log("✅ 실행 환경:", process.env.NODE_ENV);
    
    // 환경 변수 접근 테스트
    console.log("🔑 ENV VARIABLES CHECK ====================");
    console.log("✅ process.env.SOLAPI_API_KEY:", process.env.SOLAPI_API_KEY);
    console.log("✅ process.env.SOLAPI_API_KEY 타입:", typeof process.env.SOLAPI_API_KEY);
    
    // 모든 환경 변수 키 확인 (SOLAPI 포함된 것들만)
    const solapiKeys = Object.keys(process.env).filter(key => key.includes('SOLAPI'));
    console.log("✅ SOLAPI 관련 환경 변수 키:", solapiKeys);
    
    // fallback 테스트
    const testApiKey = process.env.SOLAPI_API_KEY ?? "FALLBACK_API_KEY";
    console.log("✅ testApiKey:", testApiKey);
    console.log("✅ testApiKey 타입:", typeof testApiKey);
    
    // 요청 정보 확인
    console.log("📩 REQUEST INFO ==========================");
    console.log("✅ 요청 URL:", request.url);
    console.log("✅ 요청 메서드:", request.method);
    
    // 정상 응답 반환
    return NextResponse.json({ 
      status: 'OK', 
      message: '테스트 완료', 
      runtime: 'nodejs',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        hasApiKey: !!process.env.SOLAPI_API_KEY,
        solapiKeysFound: solapiKeys.length,
        testData
      }
    });
  } catch (error) {
    console.error("❌ 에러 발생:", error);
    return NextResponse.json({ 
      status: 'ERROR', 
      message: '테스트 중 오류 발생', 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 